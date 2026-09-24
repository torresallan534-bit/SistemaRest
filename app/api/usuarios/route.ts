import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const syntheticEmail = (username: string) => `${username.trim().toLowerCase()}@usuarios.restopos.app`;

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const authorization = request.headers.get('authorization');
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel. Después de agregarla, realiza un nuevo despliegue.' }, { status: 503 });
  }
  if (!supabaseUrl || !authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'La sesión no está disponible. Cierra sesión, vuelve a ingresar e inténtalo de nuevo.' }, { status: 401 });
  }

  const accessToken = authorization.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  const { data: { user: caller }, error: callerError } = await authClient.auth.getUser(accessToken);
  if (callerError || !caller) return NextResponse.json({ error: 'Sesión no autorizada.' }, { status: 401 });

  const body = await request.json() as { username?: string; password?: string };
  const username = body.username?.trim() || '';
  const password = body.password || '';
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username) || password.length < 6) {
    return NextResponse.json({ error: 'El usuario debe tener entre 3 y 40 caracteres y la clave mínimo seis.' }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership } = await adminClient
    .from('miembros_negocio')
    .select('owner_user_id')
    .eq('auth_user_id', caller.id)
    .eq('role', 'admin')
    .maybeSingle();
  const { data: ownerProfile } = await adminClient.from('perfiles').select('id').eq('id', caller.id).maybeSingle();
  const ownerId = membership?.owner_user_id || ownerProfile?.id;
  if (!ownerId) return NextResponse.json({ error: 'Solo el administrador puede crear usuarios.' }, { status: 403 });

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: syntheticEmail(username),
    password,
    email_confirm: true,
    user_metadata: { role: 'mesero', owner_user_id: ownerId },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message || 'No fue posible crear el usuario.' }, { status: 400 });
  }

  const { error: memberError } = await adminClient.from('miembros_negocio').insert({
    owner_user_id: ownerId,
    auth_user_id: created.user.id,
    username: username.toLowerCase(),
    role: 'mesero',
    activo: true,
  });
  if (memberError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ username: username.toLowerCase() }, { status: 201 });
}
