import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const syntheticEmail = (username: string) => `${username.trim().toLowerCase()}@usuarios.restopos.app`;

const getClients = (request: Request) => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get('authorization');

  if (!serviceRoleKey || !supabaseUrl || !anonKey) {
    return { error: NextResponse.json({ error: 'El servicio de usuarios no está configurado correctamente. Contacta al administrador.' }, { status: 503 }) };
  }
  if (!authorization?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'La sesión no está disponible. Cierra sesión e ingresa nuevamente.' }, { status: 401 }) };
  }

  return {
    authClient: createClient(supabaseUrl, anonKey),
    adminClient: createClient(supabaseUrl, serviceRoleKey),
    accessToken: authorization.slice('Bearer '.length),
  };
};

const readJson = async <T,>(request: Request): Promise<T | null> => {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const clients = getClients(request);
  if ('error' in clients) return clients.error;
  const { authClient, adminClient, accessToken } = clients;
  const { data: { user: caller }, error: callerError } = await authClient.auth.getUser(accessToken);
  if (callerError || !caller) return NextResponse.json({ error: 'La sesión expiró o no está autorizada. Ingresa nuevamente.' }, { status: 401 });

  const body = await readJson<{ username?: string; password?: string }>(request);
  if (!body) return NextResponse.json({ error: 'La solicitud no contiene datos válidos.' }, { status: 400 });
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username) || password.length < 6) {
    return NextResponse.json({ error: 'El usuario debe tener entre 3 y 40 caracteres (letras, números, punto, guion o guion bajo) y la clave mínimo seis.' }, { status: 400 });
  }

  const normalizedUsername = username.toLowerCase();
  const { data: membership, error: membershipError } = await adminClient
    .from('miembros_negocio')
    .select('owner_user_id, role, activo')
    .eq('auth_user_id', caller.id)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: `No fue posible verificar el rol administrador: ${membershipError.message}` }, { status: 500 });
  if (membership && (membership.role !== 'admin' || !membership.activo)) {
    return NextResponse.json({ error: 'Solo el administrador activo puede crear usuarios.' }, { status: 403 });
  }

  const { data: ownerProfile, error: ownerProfileError } = await adminClient.from('perfiles').select('id').eq('id', caller.id).maybeSingle();
  if (ownerProfileError) return NextResponse.json({ error: `No fue posible validar el negocio: ${ownerProfileError.message}` }, { status: 500 });
  const ownerId = membership?.owner_user_id || ownerProfile?.id;
  if (!ownerId) return NextResponse.json({ error: 'Solo una cuenta administradora asociada a un negocio puede crear usuarios.' }, { status: 403 });

  const { data: existingUsername, error: usernameLookupError } = await adminClient
    .from('miembros_negocio')
    .select('id')
    .eq('owner_user_id', ownerId)
    .eq('username', normalizedUsername)
    .maybeSingle();
  if (usernameLookupError) return NextResponse.json({ error: `No fue posible verificar el usuario: ${usernameLookupError.message}` }, { status: 500 });
  if (existingUsername) return NextResponse.json({ error: 'Ese nombre de usuario ya está registrado en este negocio.' }, { status: 409 });

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: syntheticEmail(normalizedUsername),
    password,
    email_confirm: true,
    user_metadata: { role: 'mesero', owner_user_id: ownerId },
  });
  if (createError || !created.user) {
    const message = createError?.message || 'No fue posible crear el usuario.';
    const usernameTaken = createError?.code === 'user_already_exists' || /already (exists|registered|been registered)/i.test(message);
    return NextResponse.json({
      error: usernameTaken
        ? 'Ese nombre de usuario ya está ocupado. Elige otro nombre de acceso.'
        : message,
    }, { status: 400 });
  }

  const { error: memberError } = await adminClient.from('miembros_negocio').insert({
    owner_user_id: ownerId,
    auth_user_id: created.user.id,
    username: normalizedUsername,
    role: 'mesero',
    activo: true,
  });
  if (memberError) {
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(created.user.id);
    const usernameTaken = memberError.code === '23505';
    return NextResponse.json({
      error: rollbackError
        ? `No se pudo completar la asociación del acceso al negocio (${memberError.message}) y falló la limpieza automática. Contacta soporte antes de volver a crear este usuario.`
        : usernameTaken
          ? 'Ese nombre de usuario ya está ocupado. Elige otro nombre de acceso.'
          : `No se pudo asociar el acceso al negocio: ${memberError.message}`,
    }, { status: 500 });
  }

  return NextResponse.json({ username: normalizedUsername }, { status: 201 });
}

export async function DELETE(request: Request) {
  const clients = getClients(request);
  if ('error' in clients) return clients.error;
  const { authClient, adminClient, accessToken } = clients;
  const { data: { user: caller }, error: callerError } = await authClient.auth.getUser(accessToken);
  if (callerError || !caller) {
    return NextResponse.json({ error: 'La sesión expiró o no está autorizada. Ingresa nuevamente.' }, { status: 401 });
  }

  const body = await readJson<{ userId?: string; authUserId?: string }>(request);
  if (!body) return NextResponse.json({ error: 'La solicitud no contiene datos válidos.' }, { status: 400 });
  const memberId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const authUserId = typeof body.authUserId === 'string' ? body.authUserId.trim() : '';

  if (!memberId || !authUserId) {
    return NextResponse.json({ error: 'Falta la referencia del usuario a eliminar.' }, { status: 400 });
  }

  const { data: memberToDelete, error: memberLookupError } = await adminClient
    .from('miembros_negocio')
    .select('id, owner_user_id, auth_user_id, role')
    .eq('id', memberId)
    .maybeSingle();

  if (memberLookupError || !memberToDelete) {
    return NextResponse.json({ error: 'No se encontró el acceso del usuario.' }, { status: 404 });
  }

  if (memberToDelete.auth_user_id !== authUserId) {
    return NextResponse.json({ error: 'La referencia del usuario no coincide con el acceso del negocio.' }, { status: 400 });
  }

  const { data: ownerMembership, error: ownerMembershipError } = await adminClient
    .from('miembros_negocio')
    .select('owner_user_id, role, activo')
    .eq('auth_user_id', caller.id)
    .maybeSingle();
  if (ownerMembershipError) return NextResponse.json({ error: `No fue posible verificar el rol administrador: ${ownerMembershipError.message}` }, { status: 500 });

  if (caller.id === authUserId) {
    return NextResponse.json({ error: 'No puedes eliminar tu propio acceso principal.' }, { status: 400 });
  }

  const { data: ownerProfile, error: ownerProfileError } = await adminClient.from('perfiles').select('id').eq('id', caller.id).maybeSingle();
  if (ownerProfileError) return NextResponse.json({ error: `No fue posible validar el negocio: ${ownerProfileError.message}` }, { status: 500 });
  const callerOwnerId = ownerMembership?.role === 'admin' && ownerMembership.activo
    ? ownerMembership.owner_user_id
    : ownerProfile?.id;
  if (!callerOwnerId || callerOwnerId !== memberToDelete.owner_user_id || memberToDelete.role !== 'mesero') {
    return NextResponse.json({ error: 'Solo el administrador puede eliminar accesos del negocio.' }, { status: 403 });
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(authUserId);
  if (deleteAuthError) {
    return NextResponse.json({ error: `No fue posible eliminar la cuenta de acceso: ${deleteAuthError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
