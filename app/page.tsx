'use client';

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import styles from './Calculadora.module.css';

interface Perfil { 
  id: string; 
  nombre_persona: string;
  nombre_local: string; 
  documento: string; 
  telefono: string; 
  direccion: string; 
}

interface Producto { id: string; nombre: string; precio: number; user_id?: string; }
interface Insumo { id: string; nombre: string; unidad: string; stock_actual: number; user_id?: string; }
interface RecetaItem { id: string; producto_id: string; insumo_id: string; cantidad_requerida: number; user_id?: string; }
interface LineaFactura { id: number; productoId: string; cantidad: number; }
interface ProductoVenta { nombre: string; cantidad: number; precioUnitario: number; subtotal: number; producto_id?: string; }
interface Venta { id: number; created_at: string; cliente: string; documento: string; metodo_pago: string; total: number; productos: ProductoVenta[]; cierre_id?: string; user_id?: string; jornada_id?: string; nombre_vendedor?: string; grupo_division_id?: string; }
type RolNegocio = 'admin' | 'mesero';
interface DivisionPago { id: number; nombre: string; metodo_pago: 'Efectivo' | 'Tarjeta' | 'Transferencia'; cantidades: Record<number, string>; }
interface Gasto { id: string; created_at: string; concepto: string; metodo_pago: 'Efectivo' | 'Tarjeta' | 'Transferencia'; monto: number; jornada_id?: string; cierre_id?: string; user_id?: string; }
interface Mesa { 
  id: string; 
  nombre: string; 
  estado: 'libre' | 'ocupada'; 
  pedidos: LineaFactura[]; 
  cliente_nombre?: string;
  cliente_documento?: string;
  comentarios?: string;
  pedido_creado_por?: string | null;
  pedido_creado_nombre?: string | null;
  user_id?: string; 
}
interface CierreCaja { id: string; fecha: string; jornada_id?: string; base_inicial: number; total_sistema: number; total_neto?: number; total_gastos?: number; efectivo_sistema: number; tarjeta_sistema: number; transferencia_sistema: number; gastos_efectivo?: number; gastos_tarjeta?: number; gastos_transferencia?: number; efectivo_real: number; tarjeta_real: number; transferencia_real: number; diferencia_efectivo: number; diferencia_tarjeta: number; diferencia_transferencia: number; user_id?: string; }
interface MiembroNegocio { id: string; username: string; role: 'mesero'; auth_user_id: string; activo: boolean; }
interface InventarioTurno {
  id: string;
  user_id: string;
  jornada_id: string;
  stock_inicial: Record<string, number>;
  entradas: Record<string, number>;
  conteo_final: Record<string, number>;
  consumo_esperado: Record<string, number>;
  diferencias: Record<string, number>;
  created_at: string;
}
interface EntradasInventarioTurno {
  id: string;
  user_id: string;
  jornada_id: string;
  stock_inicial: Record<string, number>;
  entradas: Record<string, number>;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
interface DiferenciaInventarioAnterior {
  insumo_id: string;
  nombre: string;
  unidad: string;
  diferencia: number;
}
interface ReportePdf {
  titulo: string;
  subtitulo: string;
  encabezados: string[];
  filas: string[][];
  resumen?: string;
  generado: string;
}

export default function Home() {
  // Autenticación y Perfil
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [propietarioId, setPropietarioId] = useState<string | null>(null);
  const [rolActual, setRolActual] = useState<RolNegocio>('admin');
  const [nombreUsuarioNegocio, setNombreUsuarioNegocio] = useState<string | null>(null);
  const [miembrosNegocio, setMiembrosNegocio] = useState<MiembroNegocio[]>([]);
  
  // Formulario Registro
  const [nombrePersonaInput, setNombrePersonaInput] = useState('');
  const [nombreLocalInput, setNombreLocalInput] = useState('');
  const [documentoLocalInput, setDocumentoLocalInput] = useState('');
  const [direccionLocalInput, setDireccionLocalInput] = useState('');
  const [telefonoLocalInput, setTelefonoLocalInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorAcceso, setErrorAcceso] = useState('');
  
  const [esRegistro, setEsRegistro] = useState(false);
  const [requiereCompletarPerfil, setRequiereCompletarPerfil] = useState(false);
  const [cargandoAuth, setCargandoAuth] = useState(true);

  // Navegación
  const [modulo, setModulo] = useState<'ventas' | 'produccion'>('ventas');
  const [subPestanaVentas, setSubPestanaVentas] = useState<'mesas' | 'caja' | 'gastos' | 'historial'>('mesas');
  const [subPestanaProduccion, setSubPestanaProduccion] = useState<'inventario' | 'recetas' | 'productos'>('inventario');
  const [subPestanaHistorial, setSubPestanaHistorial] = useState<'ventas' | 'cierres'>('ventas');

  // Datos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<RecetaItem[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  // Control Arqueo / Turno
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(false);
  const [baseEfectivoInput, setBaseEfectivoInput] = useState<string>('');
  const [baseEfectivoJornada, setBaseEfectivoJornada] = useState<number>(0);
  const [jornadaId, setJornadaId] = useState<string | null>(null);

  // Mesa activa y Comanda
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [lineasMesa, setLineasMesa] = useState<LineaFactura[]>([]);
  const [clienteNombreMesa, setClienteNombreMesa] = useState('');
  const [clienteDocMesa, setClienteDocMesa] = useState('');
  const [comentarioMesa, setComentarioMesa] = useState('');

  // Ticket de Comanda Cocina
  const [numComanda, setNumComanda] = useState<number>(1);
  const [comandaImprimir, setComandaImprimir] = useState<{
    numero: number;
    mesa: string;
    hora: string;
    cliente: string;
    tomadoPor: string;
    comentario: string;
    items: { nombre: string; cantidad: number }[];
  } | null>(null);

  // Modal Cobro y Factura
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [montoPagaCon, setMontoPagaCon] = useState<string>('');
  const [ventaConfirmadaTicket, setVentaConfirmadaTicket] = useState<Venta | null>(null);
  const [dividirCuenta, setDividirCuenta] = useState(false);
  const [divisionesCuenta, setDivisionesCuenta] = useState<DivisionPago[]>([]);
  const [divisionAbiertaId, setDivisionAbiertaId] = useState<number | null>(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [ticketsDivisionPendientes, setTicketsDivisionPendientes] = useState<Venta[]>([]);

  // Cierre
  const [efectivoReal, setEfectivoReal] = useState('');
  const [tarjetaReal, setTarjetaReal] = useState('');
  const [transferenciaReal, setTransferenciaReal] = useState('');
  const [procesandoCierre, setProcesandoCierre] = useState(false);
  const [conceptoGasto, setConceptoGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [metodoPagoGasto, setMetodoPagoGasto] = useState<Gasto['metodo_pago']>('Efectivo');

  // Formularios Producción
  const [prodRecetaSel, setProdRecetaSel] = useState('');
  const [lineasReceta, setLineasReceta] = useState<{ insumo_id: string; cantidad_requerida: string }[]>([{ insumo_id: '', cantidad_requerida: '' }]);
  const [recetaEditandoId, setRecetaEditandoId] = useState<string | null>(null);
  const [cantEditandoVal, setCantEditandoVal] = useState('');

  const [nuevoNombreMesa, setNuevoNombreMesa] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('');
  const [nuevoInsumoUnidad, setNuevoInsumoUnidad] = useState('g');
  const [nuevoInsumoStock, setNuevoInsumoStock] = useState('');
  const [entradasInventario, setEntradasInventario] = useState<Record<string, string>>({});
  const [conteosFinalesInventario, setConteosFinalesInventario] = useState<Record<string, string>>({});
  const [inventarioTurnoGuardado, setInventarioTurnoGuardado] = useState<InventarioTurno | null>(null);
  const [entradasTurnoGuardadas, setEntradasTurnoGuardadas] = useState<EntradasInventarioTurno | null>(null);
  const [editandoEntradasInventario, setEditandoEntradasInventario] = useState(false);
  const [consumoInventarioMesero, setConsumoInventarioMesero] = useState<Record<string, number>>({});
  const [consumoInventarioJornadaId, setConsumoInventarioJornadaId] = useState<string | null>(null);
  const [diferenciasInventarioAnterior, setDiferenciasInventarioAnterior] = useState<DiferenciaInventarioAnterior[]>([]);
  const [diferenciasInventarioJornadaId, setDiferenciasInventarioJornadaId] = useState<string | null>(null);
  const [jornadaInventarioCargadaId, setJornadaInventarioCargadaId] = useState<string | null>(null);
  const [guardandoInventario, setGuardandoInventario] = useState(false);

  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [reportePdf, setReportePdf] = useState<ReportePdf | null>(null);
  const [cierreFiltroSeleccionado, setCierreFiltroSeleccionado] = useState<string>('abierta');
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [personalizacionAbierta, setPersonalizacionAbierta] = useState(false);
  const [usuariosModalAbierto, setUsuariosModalAbierto] = useState(false);
  const [creandoMesero, setCreandoMesero] = useState(false);
  const [nuevoMeseroUsuario, setNuevoMeseroUsuario] = useState('');
  const [nuevoMeseroClave, setNuevoMeseroClave] = useState('');
  const [editarPerfilAbierto, setEditarPerfilAbierto] = useState(false);
  const [claveAdminEdicion, setClaveAdminEdicion] = useState('');
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [perfilEditando, setPerfilEditando] = useState({
    nombre_persona: '',
    nombre_local: '',
    documento: '',
    telefono: '',
    direccion: '',
  });
  const [colorApp, setColorApp] = useState(() => {
    if (typeof window === 'undefined') return '#2563eb';
    return window.localStorage.getItem('restopos-color-app') || '#2563eb';
  });

  useEffect(() => {
    window.localStorage.setItem('restopos-color-app', colorApp);
  }, [colorApp]);

  useEffect(() => {
    if (rolActual === 'admin' && propietarioId) {
      obtenerMiembrosNegocio(propietarioId);
    }
  // The loader is intentionally kept local to this component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolActual, propietarioId]);

  const cargarPerfil = async (userId: string) => {
    const { data } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle();
    if (data) setPerfil(data as Perfil);
  };

  const obtenerContextoUsuario = async (authUserId: string) => {
    const { data, error } = await supabase
      .from('miembros_negocio')
      .select('owner_user_id, role, activo, username')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw new Error(`No fue posible verificar el acceso al negocio: ${error.message}`);

    let role: RolNegocio = 'admin';
    if (data) {
      if (!data.activo) throw new Error('Este acceso está desactivado. Contacta al administrador del negocio.');
      if (data.role === 'mesero') {
        role = 'mesero';
        setNombreUsuarioNegocio(data.username);
      } else if (data.role === 'admin') {
        setNombreUsuarioNegocio(null);
      } else {
        throw new Error('El rol de este acceso no es válido.');
      }
    } else {
      setNombreUsuarioNegocio(null);
      const { data: profile, error: profileError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle();
      if (profileError) throw new Error(`No fue posible verificar el perfil administrador: ${profileError.message}`);
      if (!profile) throw new Error('No se encontró el perfil de este acceso. Contacta al administrador.');
    }

    const ownerId = data?.owner_user_id || authUserId;
    setRolActual(role);
    setPropietarioId(ownerId);
    return { ownerId, role };
  };

  const cargarTodo = async (userId?: string, role: RolNegocio = rolActual) => {
    const uId = userId || propietarioId || usuario?.id;
    if (!uId) return;

    if (role === 'mesero') {
      setInsumos([]);
      setRecetas([]);
      setVentas([]);
      setGastos([]);
      setCierres([]);
    }

    const cargas = [
      obtenerJornadaActiva(uId),
      obtenerProductos(uId),
      obtenerMesas(uId, role),
    ];
    if (role === 'admin') {
      cargas.push(
        obtenerInsumos(uId),
        obtenerRecetas(uId),
        obtenerVentas(uId),
        obtenerGastos(uId),
        obtenerCierres(uId),
      );
    } else {
      cargas.push(obtenerInsumos(uId));
    }
    await Promise.all(cargas);
  };

  const prepararCompletarPerfil = (authUser: User) => {
    setNombrePersonaInput(String(authUser.user_metadata.nombre_persona || ''));
    setNombreLocalInput(String(authUser.user_metadata.nombre_local || ''));
    setDocumentoLocalInput(String(authUser.user_metadata.documento || ''));
    setDireccionLocalInput(String(authUser.user_metadata.direccion || ''));
    setTelefonoLocalInput(String(authUser.user_metadata.telefono || ''));
    setUsuario(authUser);
    setRequiereCompletarPerfil(true);
    setErrorAcceso('');
  };

  const esPerfilAusente = (error: unknown) =>
    error instanceof Error && error.message === 'No se encontró el perfil de este acceso. Contacta al administrador.';

  // Inicialización de Sesión Persistente
  useEffect(() => {
    const inicializarSesion = async () => {
      setCargandoAuth(true);
      let usuarioSesion: User | null = null;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        usuarioSesion = session?.user || null;
        if (session?.user) {
          const { ownerId, role } = await obtenerContextoUsuario(session.user.id);
          setUsuario(session.user);
          await cargarPerfil(ownerId);
          await cargarTodo(ownerId, role);
        } else {
          setUsuario(null);
        }
      } catch (error) {
        if (usuarioSesion && esPerfilAusente(error)) {
          prepararCompletarPerfil(usuarioSesion);
        } else {
          setErrorAcceso(error instanceof Error ? error.message : 'No fue posible validar la sesión.');
          await supabase.auth.signOut();
          setUsuario(null);
          setPerfil(null);
          setPropietarioId(null);
        }
      }
      setCargandoAuth(false);
    };

    inicializarSesion();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (event === 'INITIAL_SESSION') return;
        try {
          const { ownerId, role } = await obtenerContextoUsuario(session.user.id);
          setUsuario(session.user);
          await cargarPerfil(ownerId);
          await cargarTodo(ownerId, role);
        } catch (error) {
          if (esPerfilAusente(error)) {
            prepararCompletarPerfil(session.user);
          } else {
            setErrorAcceso(error instanceof Error ? error.message : 'No fue posible validar el acceso al negocio.');
            await supabase.auth.signOut();
            setUsuario(null);
            setPerfil(null);
            setPropietarioId(null);
          }
        }
      } else {
        setUsuario(null);
        setPerfil(null);
        setPropietarioId(null);
        setRolActual('admin');
        setNombreUsuarioNegocio(null);
        setMiembrosNegocio([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  // La sesión se inicializa una sola vez; las suscripciones posteriores sincronizan los datos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const idJornada = jornadaId || cierres[0]?.jornada_id || null;
    if (rolActual !== 'admin' || !propietarioId || !idJornada) return;
    let cancelled = false;
    const cargarInventario = async () => {
      const { data, error } = await supabase
        .from('inventarios_turno')
        .select('*')
        .eq('jornada_id', idJornada)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        alert(`No fue posible cargar el inventario del turno: ${error.message}`);
        return;
      }
      setInventarioTurnoGuardado(data as InventarioTurno | null);
      if (data) {
        setEntradasInventario(data.entradas || {});
        setConteosFinalesInventario(Object.fromEntries(
          Object.entries(data.conteo_final || {}).map(([id, cantidad]) => [id, String(cantidad)]),
        ));
      } else {
        setInventarioTurnoGuardado(null);
        setEntradasInventario({});
        setConteosFinalesInventario({});
      }
    };
    void cargarInventario();
    return () => { cancelled = true; };
  // Load the active shift inventory or the latest closed shift inventory.
  }, [jornadaId, cierres, propietarioId, rolActual]);

  // CANAL EN TIEMPO REAL: Sincronización instantánea
  useEffect(() => {
    if (!usuario?.id) return;

    let canalSincronizacion = supabase
      .channel('sincronizacion-restopos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas', filter: `user_id=eq.${propietarioId || usuario.id}` },
        () => obtenerMesas(propietarioId || usuario.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jornadas', filter: `user_id=eq.${propietarioId || usuario.id}` },
        async () => {
          await obtenerJornadaActiva(usuario.id);
        }
      );
    if (rolActual === 'admin') {
      canalSincronizacion = canalSincronizacion
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ventas', filter: `user_id=eq.${propietarioId || usuario.id}` },
          () => {
            obtenerVentas(propietarioId || usuario.id);
            obtenerJornadaActiva(usuario.id);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'gastos', filter: `user_id=eq.${propietarioId || usuario.id}` },
          () => obtenerGastos(propietarioId || usuario.id)
        );
    }
    canalSincronizacion.subscribe();

    return () => {
      supabase.removeChannel(canalSincronizacion);
    };
  }, [usuario?.id, propietarioId, rolActual]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const identificadorAcceso = emailInput.trim();
    setErrorAcceso('');
    if (!identificadorAcceso || !passwordInput) return setErrorAcceso('Completa el correo o usuario y la contraseña.');

    if (esRegistro) {
      if (!nombrePersonaInput || !nombreLocalInput || !documentoLocalInput || !direccionLocalInput || !telefonoLocalInput) {
        return alert('Por favor completa todos los campos del registro');
      }

      const { data, error } = await supabase.auth.signUp({
        email: identificadorAcceso.toLowerCase(),
        password: passwordInput,
        options: {
          data: {
            tipo_cuenta: 'negocio',
            nombre_persona: nombrePersonaInput.trim(),
            nombre_local: nombreLocalInput.trim(),
            documento: documentoLocalInput.trim(),
            direccion: direccionLocalInput.trim(),
            telefono: telefonoLocalInput.trim(),
          },
        },
      });

      if (error) {
        setErrorAcceso(`No fue posible registrar el negocio: ${error.message}`);
        return;
      }
      if (!data.user) {
        setErrorAcceso('No se recibió una cuenta después del registro. Inténtalo de nuevo.');
        return;
      }
      if (!data.session) {
        setEsRegistro(false);
        setErrorAcceso('La cuenta fue creada. Confirma tu correo electrónico y luego inicia sesión para acceder al negocio.');
        return;
      }

      try {
        const { ownerId, role } = await obtenerContextoUsuario(data.user.id);
        setUsuario(data.user);
        await cargarPerfil(ownerId);
        await cargarTodo(ownerId, role);
        setErrorAcceso('');
        alert('Registro exitoso. Tu negocio fue creado con cinco mesas iniciales.');
      } catch (contextError) {
        await supabase.auth.signOut();
        setErrorAcceso(contextError instanceof Error
          ? `La cuenta se creó, pero no se pudo preparar el negocio: ${contextError.message}`
          : 'La cuenta se creó, pero no se pudo preparar el negocio. Contacta al administrador.');
      }
    } else {
      const correoAcceso = identificadorAcceso.includes('@')
        ? identificadorAcceso
        : `${identificadorAcceso.toLowerCase()}@usuarios.restopos.app`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correoAcceso,
        password: passwordInput,
      });

      if (error) {
        setErrorAcceso('No se pudo iniciar sesión. Verifica el usuario y la contraseña.');
        return;
      }
      if (!data.user) {
        setErrorAcceso('No se recibió un usuario autenticado. Inténtalo de nuevo.');
        return;
      }
      try {
        const { ownerId, role } = await obtenerContextoUsuario(data.user.id);
        setUsuario(data.user);
        await cargarPerfil(ownerId);
        await cargarTodo(ownerId, role);
      } catch (contextError) {
        const mensajeError = contextError instanceof Error
          ? contextError.message
          : 'No fue posible validar el acceso al negocio.';
        if (esPerfilAusente(contextError)) {
          prepararCompletarPerfil(data.user);
          return;
        }
        await supabase.auth.signOut();
        setErrorAcceso(mensajeError);
      }
    }
  };

  const completarPerfilNegocio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    const datosPerfil = {
      p_nombre_persona: nombrePersonaInput.trim(),
      p_nombre_local: nombreLocalInput.trim(),
      p_documento: documentoLocalInput.trim(),
      p_direccion: direccionLocalInput.trim(),
      p_telefono: telefonoLocalInput.trim(),
    };
    if (Object.values(datosPerfil).some((valor) => !valor)) {
      setErrorAcceso('Completa todos los datos del negocio.');
      return;
    }

    const { error } = await supabase.rpc('crear_perfil_negocio_actual', datosPerfil);
    if (error) {
      setErrorAcceso(`No fue posible completar el perfil del negocio: ${error.message}`);
      return;
    }

    try {
      const { ownerId, role } = await obtenerContextoUsuario(usuario.id);
      setRequiereCompletarPerfil(false);
      setErrorAcceso('');
      await cargarPerfil(ownerId);
      await cargarTodo(ownerId, role);
    } catch (contextError) {
      setErrorAcceso(contextError instanceof Error
        ? `El perfil se guardó, pero no fue posible cargar el negocio: ${contextError.message}`
        : 'El perfil se guardó, pero no fue posible cargar el negocio. Inténtalo de nuevo.');
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setPerfil(null);
    setRequiereCompletarPerfil(false);
    setMenuUsuarioAbierto(false);
  };

  const abrirEdicionPerfil = () => {
    if (!perfil) return;
    setPerfilEditando({
      nombre_persona: perfil.nombre_persona,
      nombre_local: perfil.nombre_local,
      documento: perfil.documento,
      telefono: perfil.telefono,
      direccion: perfil.direccion,
    });
    setClaveAdminEdicion('');
    setEditarPerfilAbierto(true);
    setMenuUsuarioAbierto(false);
  };

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || rolActual !== 'admin' || !usuario.email) return alert('Solo el administrador puede editar la información del negocio.');
    if (!claveAdminEdicion) return alert('Ingresa la contraseña del administrador para confirmar los cambios.');
    setGuardandoPerfil(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: usuario.email,
        password: claveAdminEdicion,
      });
      if (authError || authData.user?.id !== usuario.id) {
        return alert('No se pudo verificar la contraseña del administrador. Revisa la clave e inténtalo de nuevo.');
      }

      const { data, error } = await supabase
        .from('perfiles')
        .update(perfilEditando)
        .eq('id', usuario.id)
        .select()
        .single();
      if (error) {
        alert('No fue posible actualizar la información: ' + error.message);
        return;
      }
      setPerfil(data as Perfil);
      setEditarPerfilAbierto(false);
      setClaveAdminEdicion('');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const obtenerMiembrosNegocio = async (ownerId = propietarioId) => {
    if (!ownerId || rolActual !== 'admin') return;
    const { data, error } = await supabase
      .from('miembros_negocio')
      .select('id, username, role, auth_user_id, activo')
      .eq('owner_user_id', ownerId)
      .order('created_at', { ascending: true });
    if (error) {
      alert('No fue posible cargar los usuarios: ' + error.message);
      return;
    }
    setMiembrosNegocio((data || []) as MiembroNegocio[]);
  };

  const crearMesero = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = nuevoMeseroUsuario.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || nuevoMeseroClave.length < 6) {
      return alert('Escribe un usuario de 3 a 40 caracteres sin @ (letras, números, punto, guion o guion bajo) y una clave de mínimo seis caracteres.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('La sesión no está disponible.');
    setCreandoMesero(true);
    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ username, password: nuevoMeseroClave }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'No fue posible crear el usuario.');
        return;
      }
      setNuevoMeseroUsuario('');
      setNuevoMeseroClave('');
      await obtenerMiembrosNegocio(propietarioId || usuario?.id || undefined);
      alert(`Acceso creado. Inicia sesión con el usuario "${username}" y la clave definida.`);
    } catch (error) {
      alert(error instanceof Error ? `No fue posible conectar con el servicio de usuarios: ${error.message}` : 'No fue posible conectar con el servicio de usuarios.');
    } finally {
      setCreandoMesero(false);
    }
  };

  const eliminarUsuarioNegocio = async (miembro: MiembroNegocio) => {
    if (!usuario || !propietarioId) return;
    if (!confirm(`¿Deseas eliminar el acceso de ${miembro.username}? Esta acción también quitará el usuario de acceso.`)) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('La sesión no está disponible.');

    try {
      const response = await fetch('/api/usuarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: miembro.id, authUserId: miembro.auth_user_id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No fue posible eliminar el usuario.');
      }
      await obtenerMiembrosNegocio(propietarioId);
      alert(`El acceso de ${miembro.username} fue eliminado.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No fue posible eliminar el usuario.');
    }
  };

  // Obtener la jornada abierta
  async function obtenerJornadaActiva(uId: string) {
    if (!uId) return;

    const { data, error } = await supabase
      .from('jornadas')
      .select('*')
      .eq('user_id', uId)
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error al obtener jornada:', error.message);
      return;
    }

    if (data && data.length > 0) {
      const jornada = data[0];
      setCajaAbierta(true);
      setBaseEfectivoJornada(Number(jornada.base_inicial) || 0);
      setJornadaId(jornada.id);
    } else {
      setCajaAbierta(false);
      setBaseEfectivoJornada(0);
      setJornadaId(null);
    }
  };

  // Abrir caja/turno
  async function abrirCajaJornada() {
    if (!usuario?.id) return alert('No hay usuario autenticado');
    const baseNum = parseFloat(baseEfectivoInput) || 0;

    const { data, error } = await supabase
      .from('jornadas')
      .insert([
        { user_id: usuario.id, base_inicial: baseNum, estado: 'abierta' }
      ])
      .select()
      .single();

    if (error) {
      alert('Error de Supabase al abrir turno: ' + error.message);
    } else if (data) {
      setCajaAbierta(true);
      setBaseEfectivoJornada(baseNum);
      setJornadaId(data.id);
      setBaseEfectivoInput('');
      alert(`Turno iniciado con una base de $${baseNum.toLocaleString()}.`);
    }
  };

  const registrarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(montoGasto);
    if (!usuario?.id || !jornadaId) return alert('Debes tener un turno abierto para registrar un gasto.');
    if (!conceptoGasto.trim()) return alert('Ingresa el concepto del gasto.');
    if (!Number.isFinite(monto) || monto <= 0) return alert('Ingresa un monto de gasto válido.');

    const { error } = await supabase.from('gastos').insert([{
      concepto: conceptoGasto.trim(),
      monto,
      metodo_pago: metodoPagoGasto,
      jornada_id: jornadaId,
      user_id: usuario.id,
    }]);

    if (error) {
      alert('No fue posible registrar el gasto: ' + error.message);
      return;
    }

    setConceptoGasto('');
    setMontoGasto('');
    setMetodoPagoGasto('Efectivo');
    await obtenerGastos(propietarioId || usuario.id);
  };

  const eliminarGasto = async (id: string) => {
    if (!confirm('¿Deseas eliminar este gasto?')) return;
    const { error } = await supabase.from('gastos').delete().eq('id', id);
    if (error) {
      alert('No fue posible eliminar el gasto: ' + error.message);
      return;
    }
    if (usuario) await obtenerGastos(propietarioId || usuario.id);
  };

  async function obtenerProductos(uId: string) {
    const { data } = await supabase.from('productos').select('*').eq('user_id', uId).order('nombre', { ascending: true });
    if (data) setProductos(data as Producto[]);
  };

  async function obtenerInsumos(uId: string) {
    const { data, error } = await supabase.from('insumos').select('*').eq('user_id', uId).order('nombre', { ascending: true });
    if (error) {
      alert(`No fue posible cargar los insumos: ${error.message}`);
      return;
    }
    if (data) setInsumos(data as Insumo[]);
  };

  async function obtenerRecetas(uId: string) {
    const { data } = await supabase.from('recetas').select('*').eq('user_id', uId);
    if (data) setRecetas(data as RecetaItem[]);
  };

  async function obtenerVentas(uId: string) {
    const { data } = await supabase.from('ventas').select('*').eq('user_id', uId).order('created_at', { ascending: false });
    if (data) setVentas(data as Venta[]);
  };

  async function obtenerGastos(uId: string) {
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .eq('user_id', uId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error al obtener gastos:', error.message);
      return;
    }
    if (data) setGastos(data as Gasto[]);
  };

  async function obtenerMesas(uId: string, role: RolNegocio = rolActual) {
    const { data, error } = await supabase.from('mesas').select('*').eq('user_id', uId).order('nombre', { ascending: true });
    if (error) {
      alert(`No fue posible cargar las mesas: ${error.message}`);
      return;
    }

    if (data && data.length === 0) {
      if (role !== 'admin') {
        setMesas([]);
        return;
      }
      const mesasIniciales = [
        { nombre: 'Mesa 1', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 2', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 3', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 4', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 5', user_id: uId, estado: 'libre' },
      ];
      const { error: insertError } = await supabase.from('mesas').insert(mesasIniciales);
      if (insertError) {
        alert(`No fue posible crear las mesas iniciales: ${insertError.message}`);
        setMesas([]);
        return;
      }
      const { data: dataCreadas } = await supabase.from('mesas').select('*').eq('user_id', uId).order('nombre', { ascending: true });
      if (dataCreadas) setMesas(dataCreadas as Mesa[]);
    } else if (data) {
      setMesas(data as Mesa[]);
    }
  };

  async function obtenerCierres(uId: string) {
    const { data } = await supabase.from('cierres_caja').select('*').eq('user_id', uId).order('fecha', { ascending: false });
    if (data) setCierres(data as CierreCaja[]);
  };

  // AISLAMIENTO DE TURNO: Ventas que pertenecen EXCLUSIVAMENTE a la jornada activa actual
  const ventasJornadaActual = ventas.filter(
    (v) => v.jornada_id === jornadaId && !v.cierre_id
  );

  const totalHoy = ventasJornadaActual.reduce((acc, v) => acc + (v.total || 0), 0);
  const totalEfectivoHoy = ventasJornadaActual.filter((v) => (v.metodo_pago || 'Efectivo') === 'Efectivo').reduce((acc, v) => acc + (v.total || 0), 0);
  const totalTarjetaHoy = ventasJornadaActual.filter((v) => v.metodo_pago === 'Tarjeta').reduce((acc, v) => acc + (v.total || 0), 0);
  const totalTransferenciaHoy = ventasJornadaActual.filter((v) => v.metodo_pago === 'Transferencia').reduce((acc, v) => acc + (v.total || 0), 0);
  const gastosJornadaActual = gastos.filter((g) => g.jornada_id === jornadaId && !g.cierre_id);
  const totalGastosEfectivoHoy = gastosJornadaActual.filter((g) => g.metodo_pago === 'Efectivo').reduce((acc, g) => acc + (g.monto || 0), 0);
  const totalGastosTarjetaHoy = gastosJornadaActual.filter((g) => g.metodo_pago === 'Tarjeta').reduce((acc, g) => acc + (g.monto || 0), 0);
  const totalGastosTransferenciaHoy = gastosJornadaActual.filter((g) => g.metodo_pago === 'Transferencia').reduce((acc, g) => acc + (g.monto || 0), 0);

  // El efectivo del turno representa el valor neto operativo del turno para la vista general.
  // El mismo valor se usa solo como referencia para el conteo físico en la sección de cierre.
  const efectivoDeTurno = baseEfectivoJornada + totalEfectivoHoy - totalGastosEfectivoHoy;
  const efectivoEsperadoParaConteoCierre = efectivoDeTurno;

  const tarjetaSistemaNeto = totalTarjetaHoy - totalGastosTarjetaHoy;
  const transferenciaSistemaNeta = totalTransferenciaHoy - totalGastosTransferenciaHoy;
  const difEfectivo = efectivoReal !== '' ? Number(efectivoReal) - efectivoEsperadoParaConteoCierre : null;
  const difTarjeta = tarjetaReal !== '' ? Number(tarjetaReal) - tarjetaSistemaNeto : null;
  const difTransferencia = transferenciaReal !== '' ? Number(transferenciaReal) - transferenciaSistemaNeta : null;

  const seleccionarMesa = (m: Mesa) => {
    if (!cajaAbierta) {
      return alert(rolActual === 'admin'
        ? 'Debes abrir la caja antes de iniciar el turno.'
        : 'El administrador debe abrir la caja antes de que puedas atender mesas.');
    }
    setMesaSeleccionada(m);
    setLineasMesa(m.pedidos || []);
    setClienteNombreMesa(m.cliente_nombre || '');
    setClienteDocMesa(m.cliente_documento || '');
    setComentarioMesa(m.comentarios || '');
  };

  const agregarMesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rolActual !== 'admin' || !nuevoNombreMesa.trim() || !usuario) return;
    const { error } = await supabase.from('mesas').insert([{ nombre: nuevoNombreMesa, user_id: usuario.id, estado: 'libre' }]);
    if (error) {
      alert(`No fue posible agregar la mesa: ${error.message}`);
      return;
    }
    setNuevoNombreMesa('');
    obtenerMesas(propietarioId || usuario.id);
  };

  const eliminarMesa = async (id: string) => {
    if (rolActual !== 'admin') return;
    if (!confirm('¿Eliminar esta mesa?')) return;
    const { error } = await supabase.from('mesas').delete().eq('id', id);
    if (error) {
      alert(`No fue posible eliminar la mesa: ${error.message}`);
      return;
    }
    if (mesaSeleccionada?.id === id) setMesaSeleccionada(null);
    if (usuario) obtenerMesas(propietarioId || usuario.id);
  };

  const guardarPedidoMesa = async () => {
    if (!mesaSeleccionada || !usuario) return;

    const productosValidos = lineasMesa.filter((f) => f.productoId !== '');
    if (productosValidos.length === 0) return alert('Selecciona al menos un producto');

    const estado = 'ocupada';
    const tomadoPor = rolActual === 'mesero'
      ? nombreUsuarioNegocio || usuario.email || 'Mesero'
      : perfil?.nombre_persona || 'Administrador';
    const { error } = await supabase.from('mesas').update({
      pedidos: lineasMesa, 
      estado,
      cliente_nombre: clienteNombreMesa,
      cliente_documento: clienteDocMesa,
      comentarios: comentarioMesa,
      pedido_creado_por: usuario.id,
      pedido_creado_nombre: tomadoPor,
    }).eq('id', mesaSeleccionada.id);
    if (error) {
      alert(`No fue posible guardar el pedido: ${error.message}`);
      return;
    }

    const itemsCocina = productosValidos.map((item) => {
      const prod = productos.find((p) => p.id === item.productoId);
      return {
        nombre: prod ? prod.nombre : 'Producto',
        cantidad: item.cantidad
      };
    });

    const ticketCocina = {
      numero: numComanda,
      mesa: mesaSeleccionada.nombre,
      hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cliente: clienteNombreMesa || 'Cliente General',
      tomadoPor,
      comentario: comentarioMesa,
      items: itemsCocina
    };

    setNumComanda((prev) => prev + 1);
    setComandaImprimir(ticketCocina);
    obtenerMesas(propietarioId || usuario.id);
  };

  const abrirModalCobrar = () => {
    if (!mesaSeleccionada) return;
    const productosValidos = lineasMesa.filter((f) => f.productoId !== '');
    if (productosValidos.length === 0) return alert('No hay productos seleccionados en la mesa');

    setMontoPagaCon('');
    setMetodoPago('Efectivo');
    setDividirCuenta(false);
    setDivisionesCuenta([]);
    setMostrarModalCobro(true);
  };

  const agregarDivisionCuenta = () => {
    const id = Math.max(Date.now(), ...divisionesCuenta.map((division) => division.id + 1));
    setDivisionesCuenta((actuales) => [
      ...actuales,
      { id, nombre: `Persona ${actuales.length + 1}`, metodo_pago: 'Efectivo', cantidades: {} },
    ]);
    setDivisionAbiertaId(id);
  };

  const actualizarCantidadDivision = (divisionId: number, lineaId: number, cantidad: string) => {
    setDivisionesCuenta((actuales) => {
      const linea = lineasMesa.find((item) => item.id === lineaId);
      if (!linea) return actuales;
      const asignadoPorOtros = actuales
        .filter((division) => division.id !== divisionId)
        .reduce((total, division) => total + (Number(division.cantidades[lineaId]) || 0), 0);
      const maximoDisponible = Math.max(0, linea.cantidad - asignadoPorOtros);
      const cantidadNumerica = Number(cantidad);
      const cantidadAjustada = cantidad === '' || !Number.isFinite(cantidadNumerica)
        ? cantidad
        : String(Math.min(Math.max(cantidadNumerica, 0), maximoDisponible));
      return actuales.map((division) => division.id === divisionId
        ? { ...division, cantidades: { ...division.cantidades, [lineaId]: cantidadAjustada } }
        : division);
    });
  };

  const unidadesDisponiblesParaDivision = (divisionId: number, lineaId: number) => {
    const linea = lineasMesa.find((item) => item.id === lineaId);
    if (!linea) return 0;
    const asignadoPorOtros = divisionesCuenta
      .filter((division) => division.id !== divisionId)
      .reduce((total, division) => total + (Number(division.cantidades[lineaId]) || 0), 0);
    return Math.max(0, linea.cantidad - asignadoPorOtros);
  };

  const unidadesSinAsignar = (linea: LineaFactura) => Math.max(
    0,
    linea.cantidad - divisionesCuenta.reduce(
      (total, division) => total + (Number(division.cantidades[linea.id]) || 0),
      0,
    ),
  );

  const prepararPago = async (divisiones: { nombre: string; metodo_pago: DivisionPago['metodo_pago']; cantidades: Record<number, string> }[]) => {
    if (!mesaSeleccionada || !usuario || !jornadaId || !cajaAbierta) {
      return alert('El administrador debe abrir un turno antes de cobrar pedidos.');
    }
    const lineas = lineasMesa.filter((linea) => linea.productoId !== '');
    if (!lineas.length) return alert('No hay productos seleccionados en la mesa.');
    if (divisiones.some((division) => !Object.values(division.cantidades).some((cantidad) => Number(cantidad) > 0))) {
      return alert('Cada factura debe tener al menos un producto asignado.');
    }

    for (const linea of lineas) {
      const cantidadesAsignadas = divisiones.map((division) => Number(division.cantidades[linea.id]) || 0);
      if (cantidadesAsignadas.some((cantidad) => cantidad < 0 || !Number.isInteger(cantidad))) {
        return alert('Las cantidades asignadas deben ser números enteros iguales o mayores que cero.');
      }
      const asignado = cantidadesAsignadas.reduce((total, cantidad) => total + cantidad, 0);
      if (asignado !== linea.cantidad) {
        return alert(`Asigna las ${linea.cantidad} unidades de "${productos.find((producto) => producto.id === linea.productoId)?.nombre || 'un producto'}" una sola vez entre las facturas.`);
      }
    }

    setProcesandoPago(true);
    try {
      const { data, error } = await supabase.rpc('cobrar_mesa_dividida', {
        p_mesa_id: mesaSeleccionada.id,
        p_jornada_id: jornadaId,
        p_divisiones: divisiones.map((division) => ({
          nombre: division.nombre,
          metodo_pago: division.metodo_pago,
          items: lineas
            .map((linea) => ({
              linea_id: linea.id,
              producto_id: linea.productoId,
              cantidad: Number(division.cantidades[linea.id]) || 0,
            }))
            .filter((item) => item.cantidad > 0),
        })),
      });
      if (error) {
        alert('No fue posible registrar las facturas: ' + error.message);
        return;
      }

      const ventasGuardadas = (data || []) as Venta[];
      if (ventasGuardadas.length !== divisiones.length) {
        alert('La respuesta del sistema no coincide con las facturas solicitadas. Verifica el historial antes de volver a cobrar.');
        return;
      }
      setVentaConfirmadaTicket(ventasGuardadas[0]);
      setTicketsDivisionPendientes(ventasGuardadas.slice(1));
      setLineasMesa([]);
      setClienteNombreMesa('');
      setClienteDocMesa('');
      setComentarioMesa('');
      setMesaSeleccionada(null);
      setMostrarModalCobro(false);
      await cargarTodo(propietarioId || usuario.id);
      if (rolActual === 'mesero' && jornadaId) {
        const { data: consumo, error: consumoError } = await supabase.rpc('obtener_consumo_inventario_turno', {
          p_jornada_id: jornadaId,
        });
        if (consumoError) {
          alert(`Las facturas se registraron, pero no fue posible actualizar el consumo del inventario: ${consumoError.message}`);
        } else {
          setConsumoInventarioMesero((consumo || {}) as Record<string, number>);
          setConsumoInventarioJornadaId(jornadaId);
          setConsumoInventarioJornadaId(jornadaId);
        }
      }
    } finally {
      setProcesandoPago(false);
    }
  };

  const finalizarYCobrarVenta = async () => {
    if (!usuario || !mesaSeleccionada) return;
    const total = totalCalculadoMesa;
    if (!Number.isFinite(total) || total <= 0) return alert('El total del pedido debe ser mayor que cero.');
    if (metodoPago === 'Efectivo') {
      const recibido = Number(montoPagaCon);
      if (!Number.isFinite(recibido) || recibido < total) {
        return alert(`El monto ingresado debe cubrir el total de $${total.toLocaleString()}.`);
      }
    }
    const cantidades = Object.fromEntries(lineasMesa.map((linea) => [linea.id, String(linea.cantidad)]));
    await prepararPago([{ nombre: clienteNombreMesa || `Mesa: ${mesaSeleccionada.nombre}`, metodo_pago: metodoPago, cantidades }]);
  };

  const finalizarPagoDividido = async () => {
    if (divisionesCuenta.length < 2) return alert('Agrega al menos dos personas para dividir la cuenta.');
    await prepararPago(divisionesCuenta);
  };

  // CIERRE DE ARQUEO / TURNO DEFINITIVO
  const realizarCierreCaja = async () => {
    if (!usuario || !jornadaId || procesandoCierre) return;
    if (!confirm('¿Seguro de realizar el cierre de turno? El arqueo quedará congelado y guardado en el historial.')) return;

    const valoresReales = [efectivoReal, tarjetaReal, transferenciaReal].map(Number);
    if ([efectivoReal, tarjetaReal, transferenciaReal].some((valor) => valor.trim() === '')) {
      return alert('Ingresa el conteo real de efectivo, tarjeta y transferencia antes de cerrar el turno.');
    }
    if (valoresReales.some((valor) => !Number.isFinite(valor) || valor < 0)) {
      return alert('Los valores contados deben ser números válidos iguales o mayores que cero.');
    }

    const [efReal, tarReal, transReal] = valoresReales;

    const cierre = {
      jornada_id: jornadaId,
      base_inicial: baseEfectivoJornada,
      total_sistema: totalHoy,
      total_neto: totalHoy - (totalGastosEfectivoHoy + totalGastosTarjetaHoy + totalGastosTransferenciaHoy),
      efectivo_sistema: totalEfectivoHoy,
      tarjeta_sistema: totalTarjetaHoy,
      transferencia_sistema: totalTransferenciaHoy,
      gastos_efectivo: totalGastosEfectivoHoy,
      gastos_tarjeta: totalGastosTarjetaHoy,
      gastos_transferencia: totalGastosTransferenciaHoy,
      total_gastos: totalGastosEfectivoHoy + totalGastosTarjetaHoy + totalGastosTransferenciaHoy,
      efectivo_real: efReal,
      tarjeta_real: tarReal,
      transferencia_real: transReal,
      diferencia_efectivo: efReal - efectivoEsperadoParaConteoCierre,
      diferencia_tarjeta: tarReal - tarjetaSistemaNeto,
      diferencia_transferencia: transReal - transferenciaSistemaNeta,
      user_id: usuario.id,
    };

    setProcesandoCierre(true);
    try {
      const { data: cierreGuardado, error } = await supabase.rpc('cerrar_turno_atomic', {
        p_jornada_id: jornadaId,
        p_cierre: cierre,
      });

      if (error) {
        alert('No fue posible completar el cierre: ' + error.message);
      } else if (cierreGuardado) {
        alert('Arqueo completado y guardado en el historial.');

        // Resetear el estado local para dejar el sistema preparado para un nuevo turno en $0
        setCajaAbierta(false);
        setBaseEfectivoJornada(0);
        setJornadaId(null);
        setBaseEfectivoInput('');
        setEfectivoReal('');
        setTarjetaReal('');
        setTransferenciaReal('');
        setMesaSeleccionada(null);

        await cargarTodo(usuario.id);
      }
    } finally {
      setProcesandoCierre(false);
    }
  };

  const eliminarVenta = async (id: number) => {
    if (!confirm(`¿Eliminar la venta #${id}?`)) return;
    await supabase.from('ventas').delete().eq('id', id);
    if (usuario) obtenerVentas(propietarioId || usuario.id);
  };

  const eliminarCierre = async (cierreId: string) => {
    if (!confirm('¿Eliminar cierre de caja?')) return;
    await supabase.from('ventas').update({ cierre_id: null }).eq('cierre_id', cierreId);
    await supabase.from('cierres_caja').delete().eq('id', cierreId);
    if (usuario) cargarTodo(propietarioId || usuario.id);
  };

  const guardarRecetaMultiple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodRecetaSel || !usuario) return alert('Selecciona un producto');

    const inserciones = lineasReceta
      .filter((l) => l.insumo_id && l.cantidad_requerida)
      .map((l) => ({
        producto_id: prodRecetaSel,
        insumo_id: l.insumo_id,
        cantidad_requerida: parseFloat(l.cantidad_requerida),
        user_id: usuario.id,
      }));

    if (inserciones.length === 0) return alert('Agrega al menos un insumo');

    await supabase.from('recetas').insert(inserciones);
    setProdRecetaSel('');
    setLineasReceta([{ insumo_id: '', cantidad_requerida: '' }]);
    obtenerRecetas(propietarioId || usuario.id);
  };

  const editarCantidadReceta = async (id: string) => {
    if (!cantEditandoVal || !usuario) return;
    await supabase.from('recetas').update({ cantidad_requerida: parseFloat(cantEditandoVal) }).eq('id', id);
    setRecetaEditandoId(null); setCantEditandoVal('');
    obtenerRecetas(propietarioId || usuario.id);
  };

  const eliminarRecetaItem = async (id: string) => {
    if (!confirm('¿Eliminar ingrediente?')) return;
    await supabase.from('recetas').delete().eq('id', id);
    if (usuario) obtenerRecetas(propietarioId || usuario.id);
  };

  const guardarInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !propietarioId || rolActual !== 'admin') return;
    if (inventarioTurnoCargando) return alert('Espera a que se verifique el inventario del turno.');
    if (entradasTurnoGuardadas?.jornada_id === jornadaId || inventarioTurnoActual) {
      return alert('No puedes agregar insumos después de guardar las entradas del turno.');
    }
    const stock = Number(nuevoInsumoStock);
    if (!nuevoInsumoNombre.trim() || !Number.isFinite(stock) || stock < 0) return alert('Verifica el nombre y el stock inicial del insumo.');
    const { error } = await supabase.from('insumos').insert([{ nombre: nuevoInsumoNombre.trim(), unidad: nuevoInsumoUnidad, stock_actual: stock, user_id: propietarioId }]);
    if (error) return alert(`No fue posible registrar el insumo: ${error.message}`);
    setNuevoInsumoNombre(''); setNuevoInsumoStock('');
    await obtenerInsumos(propietarioId);
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    const precioNum = parseFloat(nuevoPrecio);
    if (productoEditando) {
      await supabase.from('productos').update({ nombre: nuevoNombre, precio: precioNum }).eq('id', productoEditando.id);
      setProductoEditando(null);
    } else {
      await supabase.from('productos').insert([{ nombre: nuevoNombre, precio: precioNum, user_id: usuario.id }]);
    }
    setNuevoNombre(''); setNuevoPrecio('');
    obtenerProductos(propietarioId || usuario.id);
  };

  const guardarEntradasInventarioTurno = async () => {
    const idJornada = jornadaId;
    if (!usuario || !propietarioId || !idJornada || !cajaAbierta) {
      return alert('Debe haber un turno abierto para guardar las entradas de inventario.');
    }
    if (inventarioTurnoCargando || guardandoInventario) return;
    if (inventarioTurnoActual) return alert('El inventario final ya se guardó y las entradas están bloqueadas.');
    if (entradasTurnoGuardadas?.jornada_id === idJornada && rolActual !== 'admin') {
      return alert('Solo el administrador puede autorizar cambios en las entradas ya guardadas.');
    }

    const entradas: Record<string, number> = {};
    for (const insumo of insumos) {
      const valor = entradasInventario[insumo.id] === undefined || entradasInventario[insumo.id] === ''
        ? 0
        : Number(entradasInventario[insumo.id]);
      if (!Number.isFinite(valor) || valor < 0) {
        return alert(`Ingresa una cantidad válida, igual o mayor que cero, para ${insumo.nombre}.`);
      }
      entradas[insumo.id] = valor;
    }

    setGuardandoInventario(true);
    try {
      const { data, error } = await supabase.rpc('guardar_entradas_inventario_turno', {
        p_jornada_id: idJornada,
        p_entradas: entradas,
      });
      if (error) {
        alert(`No fue posible guardar las entradas del turno: ${error.message}`);
        return;
      }
      const guardado = data as EntradasInventarioTurno;
      setEntradasTurnoGuardadas(guardado);
      setEntradasInventario(Object.fromEntries(
        Object.entries(guardado.entradas).map(([id, cantidad]) => [id, String(cantidad)]),
      ));
      setEditandoEntradasInventario(false);
      alert('Las entradas del turno quedaron guardadas. Solo el administrador podrá corregirlas antes del inventario final.');
    } finally {
      setGuardandoInventario(false);
    }
  };

  const guardarInventarioTurno = async () => {
    const idJornada = jornadaId || cierres[0]?.jornada_id || null;
    if (!usuario || !propietarioId || !idJornada) {
      return alert('No hay un turno disponible para guardar este inventario.');
    }
    if (inventarioTurnoCargando) return alert('Espera a que se verifique el inventario del turno.');
    if (inventarioTurnoActual) return alert('El inventario de este turno ya está guardado y no se puede modificar.');
    if (!entradasTurnoGuardadas || entradasTurnoGuardadas.jornada_id !== idJornada) {
      return alert('Guarda primero las entradas recibidas al inicio del turno.');
    }

    const conteos: Record<string, number> = {};
    for (const insumo of insumos) {
      if (conteosFinalesInventario[insumo.id] === undefined || conteosFinalesInventario[insumo.id] === '') {
        return alert(`Ingresa el conteo final de ${insumo.nombre}. Usa 0 si no queda stock.`);
      }
      const final = Number(conteosFinalesInventario[insumo.id]);
      if (!Number.isFinite(final) || final < 0) {
        return alert(`Ingresa cantidades válidas e iguales o mayores que cero para ${insumo.nombre}.`);
      }
      conteos[insumo.id] = final;
    }

    setGuardandoInventario(true);
    try {
      const { data, error } = await supabase.rpc('guardar_inventario_turno', {
        p_jornada_id: idJornada,
        p_entradas: entradasTurnoGuardadas.entradas,
        p_conteos: conteos,
      });
      if (error) {
        alert(`No fue posible guardar el inventario: ${error.message}`);
        return;
      }
      const guardado = data as InventarioTurno;
      setInventarioTurnoGuardado(guardado);
      setJornadaInventarioCargadaId(idJornada);
      setInsumos((actuales) => actuales.map((insumo) => ({
        ...insumo,
        stock_actual: guardado.conteo_final[insumo.id] ?? insumo.stock_actual,
      })));
      alert('Inventario del turno guardado. Quedó bloqueado para conservar el historial.');
    } finally {
      setGuardandoInventario(false);
    }
  };

  const formatearFecha = (fechaISO: string) => new Date(fechaISO).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const exportarVentasPdf = () => {
    setReportePdf({
      titulo: 'Ventas del turno',
      subtitulo: `${perfil?.nombre_local || 'Negocio'} · ${etiquetaTurnoSeleccionado}`,
      encabezados: ['Fecha y hora', 'Cliente', 'Método de pago', 'Atendió', 'Total'],
      filas: ventasFiltradasHistorial.map((venta) => [
        formatearFecha(venta.created_at),
        venta.cliente || 'Consumidor final',
        venta.metodo_pago,
        venta.nombre_vendedor || 'Administrador',
        `$${venta.total.toLocaleString('es-CO')}`,
      ]),
      resumen: `Ventas: ${ventasFiltradasHistorial.length} · Total: $${ventasFiltradasHistorial.reduce((total, venta) => total + venta.total, 0).toLocaleString('es-CO')}`,
      generado: new Date().toISOString(),
    });
  };

  const exportarGastosPdf = () => {
    setReportePdf({
      titulo: 'Gastos del turno',
      subtitulo: `${perfil?.nombre_local || 'Negocio'} · ${etiquetaTurnoSeleccionado}`,
      encabezados: ['Fecha y hora', 'Concepto', 'Método de pago', 'Monto'],
      filas: gastosFiltradosHistorial.map((gasto) => [
        formatearFecha(gasto.created_at),
        gasto.concepto,
        gasto.metodo_pago,
        `$${gasto.monto.toLocaleString('es-CO')}`,
      ]),
      resumen: `Gastos: ${gastosFiltradosHistorial.length} · Total: $${gastosFiltradosHistorial.reduce((total, gasto) => total + gasto.monto, 0).toLocaleString('es-CO')}`,
      generado: new Date().toISOString(),
    });
  };

  const exportarInventarioPdf = () => {
    if (!inventarioTurnoActual) return;
    setReportePdf({
      titulo: 'Inventario del turno',
      subtitulo: `${perfil?.nombre_local || 'Negocio'} · ${jornadaId ? 'Turno actual' : 'Último turno cerrado'}`,
      encabezados: ['Insumo', 'Unidad', 'Stock inicial', 'Entradas', 'Consumo esperado', 'Conteo final', 'Diferencia'],
      filas: insumos.map((insumo) => {
        const diferencia = Number(inventarioTurnoActual.diferencias[insumo.id] || 0);
        return [
          insumo.nombre,
          insumo.unidad,
          String(inventarioTurnoActual.stock_inicial[insumo.id] ?? 0),
          String(inventarioTurnoActual.entradas[insumo.id] ?? 0),
          String(inventarioTurnoActual.consumo_esperado[insumo.id] ?? 0),
          String(inventarioTurnoActual.conteo_final[insumo.id] ?? 0),
          `${diferencia > 0 ? '+' : ''}${diferencia}`,
        ];
      }),
      resumen: `Insumos: ${insumos.length} · ${formatearFecha(inventarioTurnoActual.created_at)}`,
      generado: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!reportePdf) return;
    document.body.classList.add('reportePdfActivo');
    let cancelado = false;
    const imprimirTrasRenderizar = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelado) window.print();
        });
      });
    };
    void document.fonts.ready.then(imprimirTrasRenderizar);
    const cerrarReporte = () => {
      document.body.classList.remove('reportePdfActivo');
      setReportePdf(null);
    };
    window.addEventListener('afterprint', cerrarReporte);
    return () => {
      cancelado = true;
      window.removeEventListener('afterprint', cerrarReporte);
      document.body.classList.remove('reportePdfActivo');
    };
  }, [reportePdf]);

  const avanzarTicketDivision = () => {
    if (ticketsDivisionPendientes.length > 0) {
      setVentaConfirmadaTicket(ticketsDivisionPendientes[0]);
      setTicketsDivisionPendientes((pendientes) => pendientes.slice(1));
      return;
    }
    setVentaConfirmadaTicket(null);
    setVentaSeleccionada(null);
  };

  const totalCalculadoMesa = lineasMesa.reduce((acc, f) => {
    const p = productos.find((prod) => prod.id === f.productoId);
    return acc + (p ? p.precio : 0) * f.cantidad;
  }, 0);
  const jornadaInventarioId = jornadaId || cierres[0]?.jornada_id || null;
  const inventarioTurnoCargando = Boolean(jornadaInventarioId && jornadaInventarioId !== jornadaInventarioCargadaId);
  const inventarioTurnoActual = inventarioTurnoGuardado?.jornada_id === jornadaInventarioId ? inventarioTurnoGuardado : null;
  const entradasTurnoActual = entradasTurnoGuardadas?.jornada_id === jornadaInventarioId ? entradasTurnoGuardadas : null;
  useEffect(() => {
    let cancelado = false;
    if (!jornadaInventarioId) return;

    const cargarInventarioGuardado = async () => {
      const [inventarioResult, entradasResult] = await Promise.all([
        supabase
          .from('inventarios_turno')
          .select('*')
          .eq('jornada_id', jornadaInventarioId)
          .maybeSingle(),
        supabase
          .from('inventario_entradas_turno')
          .select('*')
          .eq('jornada_id', jornadaInventarioId)
          .maybeSingle(),
      ]);
      if (cancelado) return;
      if (inventarioResult.error || entradasResult.error) {
        alert(`No fue posible consultar el inventario del turno: ${(inventarioResult.error || entradasResult.error)?.message}`);
      } else {
        const inventario = inventarioResult.data as InventarioTurno | null;
        const entradas = entradasResult.data as EntradasInventarioTurno | null;
        setInventarioTurnoGuardado(inventario);
        setEntradasTurnoGuardadas(entradas);
        setEntradasInventario(Object.fromEntries(
          Object.entries(entradas?.entradas || {}).map(([id, cantidad]) => [id, String(cantidad)]),
        ));
        setConteosFinalesInventario(Object.fromEntries(
          Object.entries(inventario?.conteo_final || {}).map(([id, cantidad]) => [id, String(cantidad)]),
        ));
        setEditandoEntradasInventario(false);
        if (jornadaId === jornadaInventarioId) {
          const { data: diferencias, error: diferenciasError } = await supabase.rpc('obtener_diferencias_inventario_anterior', {
            p_jornada_id: jornadaInventarioId,
          });
          if (cancelado) return;
          if (diferenciasError) {
            alert(`No fue posible consultar las diferencias del inventario anterior: ${diferenciasError.message}`);
          } else {
            setDiferenciasInventarioAnterior((diferencias || []) as DiferenciaInventarioAnterior[]);
            setDiferenciasInventarioJornadaId(jornadaInventarioId);
          }
        } else {
          setDiferenciasInventarioAnterior([]);
          setDiferenciasInventarioJornadaId(null);
        }
        if (rolActual === 'mesero' && jornadaId === jornadaInventarioId) {
          const { data: consumo, error: consumoError } = await supabase.rpc('obtener_consumo_inventario_turno', {
            p_jornada_id: jornadaInventarioId,
          });
          if (cancelado) return;
          if (consumoError) {
            alert(`No fue posible consultar el consumo esperado: ${consumoError.message}`);
          } else {
            setConsumoInventarioMesero((consumo || {}) as Record<string, number>);
            setConsumoInventarioJornadaId(jornadaInventarioId);
          }
        } else {
          setConsumoInventarioMesero({});
          setConsumoInventarioJornadaId(null);
        }
      }
      setJornadaInventarioCargadaId(jornadaInventarioId);
    };
    void cargarInventarioGuardado();

    return () => {
      cancelado = true;
    };
  }, [jornadaInventarioId, jornadaId, rolActual]);

  const consumoTeoricoInventario = (insumoId: string) => {
    if (rolActual === 'mesero') {
      return consumoInventarioJornadaId === jornadaInventarioId
        ? Number(consumoInventarioMesero[insumoId] || 0)
        : 0;
    }
    return ventas
    .filter((venta) => venta.jornada_id === jornadaInventarioId)
    .reduce((consumo, venta) => consumo + (venta.productos || []).reduce((total, item) => {
      const producto = item.producto_id
        ? productos.find((candidate) => candidate.id === item.producto_id)
        : productos.find((candidate) => candidate.nombre === item.nombre);
      const requerido = recetas
        .filter((receta) => receta.producto_id === producto?.id && receta.insumo_id === insumoId)
        .reduce((cantidad, receta) => cantidad + Number(receta.cantidad_requerida), 0);
      return total + requerido * Number(item.cantidad || 0);
    }, 0), 0);
  };

  const pagaConValor = parseFloat(montoPagaCon) || 0;
  const cambioEfectivo = pagaConValor - totalCalculadoMesa;

  // Lógica de filtrado dinámico para el Historial de Ventas por Arqueo/Turno
  const arqueoSeleccionado = cierres.find((c) => c.id === cierreFiltroSeleccionado);
  const jornadasRelacionadasAlArqueo = new Set(
    [
      arqueoSeleccionado?.jornada_id,
      ...ventas.filter((v) => v.cierre_id === cierreFiltroSeleccionado).map((v) => v.jornada_id),
      ...gastos.filter((g) => g.cierre_id === cierreFiltroSeleccionado).map((g) => g.jornada_id),
    ].filter(Boolean),
  );

  // Muestra las ventas buscando coincidencia directa por cierre_id o por jornada_id asociada
  const ventasFiltradasHistorial = cierreFiltroSeleccionado === 'abierta'
    ? ventas.filter((v) => v.jornada_id === jornadaId && !v.cierre_id)
    : ventas.filter((v) => v.cierre_id === cierreFiltroSeleccionado || (v.jornada_id && jornadasRelacionadasAlArqueo.has(v.jornada_id)));
  const gastosFiltradosHistorial = cierreFiltroSeleccionado === 'abierta'
    ? gastosJornadaActual
    : gastos.filter((g) => g.cierre_id === cierreFiltroSeleccionado || (g.jornada_id && jornadasRelacionadasAlArqueo.has(g.jornada_id)));
  const etiquetaTurnoSeleccionado = cierreFiltroSeleccionado === 'abierta'
    ? 'Turno activo'
    : arqueoSeleccionado
      ? `Turno cerrado el ${formatearFecha(arqueoSeleccionado.fecha)}`
      : 'Turno seleccionado';

  if (cargandoAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h3>Cargando sistema RestoPOS...</h3>
      </div>
    );
  }

  if (usuario && requiereCompletarPerfil) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9', fontFamily: 'sans-serif', padding: '20px 0' }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #cbd5e1', maxWidth: '460px', width: '90%', boxShadow: '0 12px 28px rgba(15,23,42,0.12)' }}>
          <h2 style={{ margin: '0 0 8px', color: '#0f172a', textAlign: 'center' }}>Completa el perfil del negocio</h2>
          <p style={{ margin: '0 0 20px', color: '#475569', textAlign: 'center', fontSize: '14px' }}>
            Esta cuenta no tiene un perfil asociado. Completa los datos para recuperar el acceso.
          </p>
          <form onSubmit={completarPerfilNegocio} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
              Nombre del propietario
              <input type="text" value={nombrePersonaInput} onChange={(e) => setNombrePersonaInput(e.target.value)} required style={{ width: '100%', marginTop: '4px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
              Nombre del negocio
              <input type="text" value={nombreLocalInput} onChange={(e) => setNombreLocalInput(e.target.value)} required style={{ width: '100%', marginTop: '4px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
              NIT o cédula
              <input type="text" value={documentoLocalInput} onChange={(e) => setDocumentoLocalInput(e.target.value)} required style={{ width: '100%', marginTop: '4px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
              Dirección del local
              <input type="text" value={direccionLocalInput} onChange={(e) => setDireccionLocalInput(e.target.value)} required style={{ width: '100%', marginTop: '4px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
              Teléfono
              <input type="tel" value={telefonoLocalInput} onChange={(e) => setTelefonoLocalInput(e.target.value)} required style={{ width: '100%', marginTop: '4px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
            </label>
            {errorAcceso && <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: '13px' }}>{errorAcceso}</p>}
            <button type="submit" style={{ background: '#2563eb', color: 'white', border: '1px solid #1d4ed8', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
              Guardar perfil y continuar
            </button>
          </form>
          <button type="button" onClick={cerrarSesion} style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#334155', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // LOGIN / REGISTRO
  if (!usuario) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a', fontFamily: 'sans-serif', padding: '20px 0' }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '2px solid #cbd5e1', maxWidth: '460px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
          <h2 style={{ margin: '0 0 6px', color: '#0f172a', textAlign: 'center' }}>RestoPOS Pro</h2>
          <p style={{ margin: '0 0 20px', color: '#475569', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>
            {esRegistro ? 'Completa los datos para la facturación' : 'Inicia sesión para continuar'}
          </p>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {esRegistro && (
              <>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Nombre de la Persona (Propietario)</label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Mendoza"
                    value={nombrePersonaInput}
                    onChange={(e) => setNombrePersonaInput(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Nombre del Negocio / Local</label>
                  <input
                    type="text"
                    placeholder="Ej: Hamburguesas El Valle"
                    value={nombreLocalInput}
                    onChange={(e) => setNombreLocalInput(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>NIT o Cédula</label>
                  <input
                    type="text"
                    placeholder="Ej: 901.234.567-1"
                    value={documentoLocalInput}
                    onChange={(e) => setDocumentoLocalInput(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Dirección del Local</label>
                  <input
                    type="text"
                    placeholder="Ej: Calle 45 # 12 - 34"
                    value={direccionLocalInput}
                    onChange={(e) => setDireccionLocalInput(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Número de Teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej: 300 123 4567"
                    value={telefonoLocalInput}
                    onChange={(e) => setTelefonoLocalInput(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                {esRegistro ? 'Correo Electrónico' : 'Correo electrónico o usuario'}
              </label>
              <input
                type={esRegistro ? 'email' : 'text'}
                inputMode={esRegistro ? 'email' : 'text'}
                autoComplete={esRegistro ? 'email' : 'username'}
                autoCapitalize="none"
                placeholder={esRegistro ? 'usuario@negocio.com' : 'Correo del administrador o usuario de mesero'}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                required
              />
            </div>
            {errorAcceso && <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: '13px' }}>{errorAcceso}</p>}

            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                required
              />
            </div>

            <button
              type="submit"
              style={{ background: '#2563eb', color: 'white', border: '2px solid #1d4ed8', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '6px' }}
            >
              {esRegistro ? 'Registrar Mi Negocio' : 'Iniciar Sesión'}
            </button>
          </form>

          <div style={{ marginTop: '18px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
            <button
              type="button"
              onClick={() => setEsRegistro(!esRegistro)}
              style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
            >
              {esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.contenedorApp} style={{ '--app-accent': colorApp } as React.CSSProperties}>
      {/* BARRA SUPERIOR */}
      <nav className={styles.barrasNavegacion}>
        <div className={styles.brandTitle}>
          {perfil?.nombre_local ? perfil.nombre_local : 'RestoPOS Pro'}
        </div>
        <div className={styles.botonesModulo}>
          <button className={`${styles.btnModulo} ${modulo === 'ventas' ? styles.activeModulo : ''}`} onClick={() => setModulo('ventas')}>
            Ventas y caja
          </button>
          <button
            className={`${styles.btnModulo} ${modulo === 'produccion' ? styles.activeModulo : ''}`}
            onClick={() => {
              setModulo('produccion');
              if (rolActual === 'mesero') setSubPestanaProduccion('inventario');
            }}
          >
            {rolActual === 'admin' ? 'Producción y costos' : 'Inventario'}
          </button>
          <div className={styles.menuUsuario}>
            <button
              type="button"
              className={styles.btnUsuario}
              onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
              aria-expanded={menuUsuarioAbierto}
              aria-haspopup="menu"
            >
              <span className={styles.avatarUsuario}>
                {(rolActual === 'mesero' ? nombreUsuarioNegocio || 'M' : perfil?.nombre_persona || usuario.email || 'U').charAt(0).toUpperCase()}
              </span>
              <span className={styles.identidadUsuario}>
                <strong>{rolActual === 'mesero' ? nombreUsuarioNegocio || 'Mesero' : perfil?.nombre_persona || 'Usuario'}</strong>
                <small>{usuario.email}</small>
              </span>
              <span className={styles.chevronUsuario}>{menuUsuarioAbierto ? '⌃' : '⌄'}</span>
            </button>

            {menuUsuarioAbierto && (
              <div className={styles.dropdownUsuario} role="menu">
                <div className={styles.encabezadoDropdown}>
                  <span className={styles.avatarGrande}>
                    {(rolActual === 'mesero' ? nombreUsuarioNegocio || 'M' : perfil?.nombre_persona || usuario.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>{rolActual === 'mesero' ? nombreUsuarioNegocio || 'Mesero' : perfil?.nombre_persona || 'Usuario'}</strong>
                    <span>{usuario.email}</span>
                  </div>
                </div>
                <div className={styles.opcionesUsuario} role="none">
                  {rolActual === 'admin' && (
                    <button
                      type="button"
                      className={styles.btnPersonalizar}
                      onClick={abrirEdicionPerfil}
                      role="menuitem"
                    >
                      Editar información
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.btnPersonalizar}
                    onClick={() => setPersonalizacionAbierta(!personalizacionAbierta)}
                    aria-expanded={personalizacionAbierta}
                    role="menuitem"
                  >
                    <span>Personalizar aplicación</span>
                    <span className={styles.indicadorPersonalizacion}>{personalizacionAbierta ? '⌃' : '›'}</span>
                  </button>
                  {rolActual === 'admin' && (
                    <button
                      type="button"
                      className={styles.btnPersonalizar}
                      onClick={() => {
                        setUsuariosModalAbierto(true);
                        setMenuUsuarioAbierto(false);
                        setPersonalizacionAbierta(false);
                      }}
                      aria-expanded={usuariosModalAbierto}
                      role="menuitem"
                    >
                      Usuarios
                    </button>
                  )}
                </div>
                {personalizacionAbierta && (
                  <div className={styles.panelPersonalizacion}>
                    <div className={styles.tituloPersonalizacion}>
                      <div>
                        <strong>Color de la aplicación</strong>
                        <span>Personaliza el color principal de tu espacio.</span>
                      </div>
                      <input
                        type="color"
                        value={colorApp}
                        onChange={(event) => setColorApp(event.target.value)}
                        aria-label="Elegir color principal"
                      />
                    </div>
                    <div className={styles.paletaColores}>
                      {[
                        ['Azul', '#2563eb'],
                        ['Violeta', '#7c3aed'],
                        ['Esmeralda', '#059669'],
                        ['Naranja', '#ea580c'],
                        ['Rosado', '#db2777'],
                      ].map(([nombre, color]) => (
                        <button
                          key={color}
                          type="button"
                          title={nombre}
                          aria-label={`Usar color ${nombre}`}
                          className={`${styles.muestraColor} ${colorApp === color ? styles.muestraColorActiva : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setColorApp(color)}
                        />
                      ))}
                    </div>
                    <button type="button" className={styles.btnRestaurarColor} onClick={() => setColorApp('#2563eb')}>
                      Restaurar color original
                    </button>
                  </div>
                )}
                <button type="button" className={styles.btnCerrarSesion} onClick={cerrarSesion} role="menuitem">
                  <span>↪</span> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* MÓDULO VENTAS */}
      {modulo === 'ventas' && (
        <div>
          <div className={styles.subBarra}>
            <button className={subPestanaVentas === 'mesas' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('mesas')}>Mesas y pedidos</button>
            {rolActual === 'admin' && <button className={subPestanaVentas === 'caja' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('caja')}>Cierre de caja</button>}
            {rolActual === 'admin' && <button className={subPestanaVentas === 'gastos' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('gastos')}>Gastos</button>}
            {rolActual === 'admin' && <button className={subPestanaVentas === 'historial' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('historial')}>Historial</button>}
          </div>

          {/* MESAS */}
          {subPestanaVentas === 'mesas' && (
            <div className={`${styles.layoutTresColumnas} ${rolActual === 'mesero' ? styles.layoutMesero : ''}`}>
              {rolActual === 'admin' && <div className={styles.widgetArqueoIzquierdo}>
                <div className={styles.cardArqueoHeader}>
                  <h4>Arqueo de turno</h4>
                  <span className={cajaAbierta ? styles.statusAbierta : styles.statusCerrada}>
                    {cajaAbierta ? 'Turno abierto' : 'Sin turno activo'}
                  </span>
                </div>

                {!cajaAbierta ? (
                  <div className={styles.aperturaBox}>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>Ingresa la base inicial para abrir el turno:</p>
                    <input
                      type="number"
                      placeholder="Base ($)"
                      className={styles.inputChico}
                      value={baseEfectivoInput}
                      onChange={(e) => setBaseEfectivoInput(e.target.value)}
                    />
                    <button onClick={abrirCajaJornada} className={styles.btnApertura}>
                      Abrir nuevo turno
                    </button>
                  </div>
                ) : (
                  <div className={styles.resumenArqueoBox}>
                    <div className={styles.filaResumen}><span>Base Inicial:</span><strong>${baseEfectivoJornada.toLocaleString()}</strong></div>
                    <div className={styles.filaResumen}><span>Ventas del turno:</span><strong>${totalHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumen}><span>Efectivo del turno:</span><strong>${totalEfectivoHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenNeto}><span>Tarjeta del turno:</span><strong>${totalTarjetaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenNeto}><span>Transferencia del turno:</span><strong>${totalTransferenciaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenTotal}><span>Total de ventas:</span><strong>${totalHoy.toLocaleString()}</strong></div>
                  </div>
                )}
              </div>}

              <div className={styles.seccionMesasGrid}>
                {rolActual === 'admin' && (
                  <div className={styles.headerConBoton}>
                    <form onSubmit={agregarMesa} style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <input type="text" placeholder="Nombre de mesa" className={styles.inputChico} value={nuevoNombreMesa} onChange={(e) => setNuevoNombreMesa(e.target.value)} required />
                      <button type="submit" className={styles.btnAgregarConBorde}>＋ Agregar Mesa</button>
                    </form>
                  </div>
                )}

                <div className={styles.reticulaMesas}>
                  {mesas.map((m) => (
                    <div
                      key={m.id}
                      className={`${styles.tarjetaMesa} ${m.estado === 'ocupada' ? styles.mesaOcupada : styles.mesaLibre} ${mesaSeleccionada?.id === m.id ? styles.mesaSeleccionada : ''}`}
                      onClick={() => seleccionarMesa(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          seleccionarMesa(m);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${m.nombre}, ${m.estado === 'ocupada' ? 'ocupada' : 'libre'}`}
                    >
                      <span className={styles.badgeEstado}>{m.estado.toUpperCase()}</span>
                      <h4>{m.nombre}</h4>
                      <p>{m.pedidos ? m.pedidos.length : 0} ítems</p>
                      {rolActual === 'admin' && <button aria-label={`Eliminar ${m.nombre}`} onClick={(e) => { e.stopPropagation(); eliminarMesa(m.id); }} className={styles.btnTrashMesa}>🗑️</button>}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.panelPedidoMesa}>
                {mesaSeleccionada ? (
                  <>
                    <h3>Atendiendo: {mesaSeleccionada.nombre}</h3>
                    <div className={styles.formClienteGrid}>
                      <input type="text" placeholder="Cliente" className={styles.inputChico} value={clienteNombreMesa} onChange={(e) => setClienteNombreMesa(e.target.value)} />
                      <input type="text" placeholder="Cédula/NIT" className={styles.inputChico} value={clienteDocMesa} onChange={(e) => setClienteDocMesa(e.target.value)} />
                    </div>

                    <div className={styles.listaProductosPedido}>
                      {lineasMesa.map((f, index) => (
                        <div key={f.id} className={styles.filaPedido}>
                          <select className={styles.selectChico} value={f.productoId} onChange={(e) => {
                            const n = [...lineasMesa];
                            n[index].productoId = e.target.value;
                            setLineasMesa(n);
                          }}>
                            <option value="">-- Producto --</option>
                            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} (${p.precio})</option>)}
                          </select>
                          <input type="number" min="1" value={f.cantidad} className={styles.cantInput} onChange={(e) => {
                            const n = [...lineasMesa];
                            n[index].cantidad = parseInt(e.target.value) || 1;
                            setLineasMesa(n);
                          }} />
                          <button onClick={() => setLineasMesa(lineasMesa.filter((item) => item.id !== f.id))} className={styles.btnTrash}>✕</button>
                        </div>
                      ))}
                    </div>

                    <button className={styles.btnAgregarLineaConBorde} onClick={() => setLineasMesa([...lineasMesa, { id: Date.now(), productoId: '', cantidad: 1 }])}>
                      ＋ Agregar Producto
                    </button>

                    <div style={{ marginTop: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                        Observaciones para cocina:
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Sin cebolla, carne término medio, salsa aparte..."
                        value={comentarioMesa}
                        onChange={(e) => setComentarioMesa(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div className={styles.footerTotalMesa}>
                      <span>Total Mesa:</span>
                      <strong>${totalCalculadoMesa.toLocaleString()}</strong>
                    </div>

                    <div className={styles.accionesMesa}>
                      <button className={styles.btnGuardarPedido} onClick={guardarPedidoMesa}>Guardar pedido</button>
                      <button className={styles.btnCobrar} onClick={abrirModalCobrar}>Cobrar y facturar</button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {subPestanaVentas === 'gastos' && (
            <div className={styles.seccionCaja}>
              <div className={styles.encabezadoSeccion}>
                <h2>Registro de gastos</h2>
                <p className={styles.descripcionSeccion}>
                Registra las salidas de dinero del turno y asócialas al medio de pago correspondiente.
                </p>
              </div>

              <div className={styles.gridMetricasCaja}>
                <div className={styles.cardMetrica}><span>Gastos del turno</span><h3>${(totalGastosEfectivoHoy + totalGastosTarjetaHoy + totalGastosTransferenciaHoy).toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Gastos en efectivo</span><h3>${totalGastosEfectivoHoy.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Gastos con tarjeta</span><h3>${totalGastosTarjetaHoy.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Gastos por transferencia</span><h3>${totalGastosTransferenciaHoy.toLocaleString()}</h3></div>
              </div>

              <form className={styles.formArqueoCaja} onSubmit={registrarGasto}>
                <h3>Registrar gasto</h3>
                <div className={styles.gridArqueoInputs}>
                  <div>
                    <label htmlFor="concepto-gasto">Concepto</label>
                    <input id="concepto-gasto" type="text" placeholder="Ejemplo: compra de insumos" value={conceptoGasto} onChange={(e) => setConceptoGasto(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="monto-gasto">Monto</label>
                    <input id="monto-gasto" type="number" min="0.01" step="0.01" placeholder="Ingrese el monto" value={montoGasto} onChange={(e) => setMontoGasto(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="metodo-gasto">Método de pago</label>
                    <select id="metodo-gasto" className={styles.selectChico} value={metodoPagoGasto} onChange={(e) => setMetodoPagoGasto(e.target.value as Gasto['metodo_pago'])}>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className={styles.btnAgregarConBorde} disabled={!cajaAbierta}>Registrar gasto</button>
                {!cajaAbierta && <p className={styles.mensajeAyuda}>Abre un turno para registrar gastos.</p>}
              </form>

              <div style={{ marginTop: '28px' }}>
                <h3>Gastos del turno actual ({gastosJornadaActual.length})</h3>
                <div className={styles.tablaResponsiveContainer}>
                  <table className={styles.tablaApp}>
                    <thead><tr><th>Fecha</th><th>Concepto</th><th>Método de pago</th><th>Monto</th><th>Acción</th></tr></thead>
                    <tbody>
                      {gastosJornadaActual.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No hay gastos registrados en el turno actual.</td></tr>
                      ) : gastosJornadaActual.map((gasto) => (
                        <tr key={gasto.id}>
                          <td>{formatearFecha(gasto.created_at)}</td>
                          <td>{gasto.concepto}</td>
                          <td>{gasto.metodo_pago}</td>
                          <td><strong>${gasto.monto.toLocaleString()}</strong></td>
                          <td><button aria-label={`Eliminar gasto ${gasto.concepto}`} onClick={() => eliminarGasto(gasto.id)} className={styles.btnEliminarConBorde}>🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CIERRE DE CAJA */}
          {subPestanaVentas === 'caja' && (
            <div className={styles.seccionCaja}>
              <h2>Control y Cierre de Arqueo (Turno Activo)</h2>

              <div className={styles.gridMetricasCaja}>
                <div className={styles.cardMetrica}><span>Efectivo de turno</span><h3 style={{ color: '#16a34a' }}>${efectivoDeTurno.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Tarjeta</span><h3 style={{ color: '#9333ea' }}>${tarjetaSistemaNeto.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Transferencia</span><h3 style={{ color: '#ea580c' }}>${transferenciaSistemaNeta.toLocaleString()}</h3></div>
              </div>
              <div className={styles.resumenGastosCierre}>
                <strong>Efectivo esperado para conteo</strong>
                <span>${efectivoEsperadoParaConteoCierre.toLocaleString()}</span>
                <span>Gastos descontados del turno: −${(totalGastosEfectivoHoy + totalGastosTarjetaHoy + totalGastosTransferenciaHoy).toLocaleString()}</span>
              </div>

              <div className={styles.formArqueoCaja}>
                <h3>Ingresar Conteo Físico Real del Turno</h3>
                <div className={styles.gridArqueoInputs}>
                  <div>
                    <label>Efectivo contado (incluye base)</label>
                    <input type="number" placeholder="Monto real" value={efectivoReal} onChange={(e) => setEfectivoReal(e.target.value)} />
                    {difEfectivo !== null && (
                      <span className={difEfectivo < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                        {difEfectivo === 0 ? 'Cuadre exacto' : difEfectivo < 0 ? `Falta: $${Math.abs(difEfectivo).toLocaleString()}` : `Sobra: $${difEfectivo.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <div>
                    <label>Tarjetas contadas</label>
                    <input type="number" placeholder="Monto real" value={tarjetaReal} onChange={(e) => setTarjetaReal(e.target.value)} />
                    {difTarjeta !== null && (
                      <span className={difTarjeta < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                        {difTarjeta === 0 ? 'Cuadre exacto' : difTarjeta < 0 ? `Falta: $${Math.abs(difTarjeta).toLocaleString()}` : `Sobra: $${difTarjeta.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <div>
                    <label>Transferencias verificadas</label>
                    <input type="number" placeholder="Monto real" value={transferenciaReal} onChange={(e) => setTransferenciaReal(e.target.value)} />
                    {difTransferencia !== null && (
                      <span className={difTransferencia < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                        {difTransferencia === 0 ? 'Cuadre exacto' : difTransferencia < 0 ? `Falta: $${Math.abs(difTransferencia).toLocaleString()}` : `Sobra: $${difTransferencia.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>

                <button className={styles.btnCierreAccion} onClick={realizarCierreCaja} disabled={!cajaAbierta || procesandoCierre}>
                  {procesandoCierre ? 'Guardando cierre...' : 'Cerrar y guardar arqueo'}
                </button>
              </div>

              <div style={{ marginTop: '28px' }}>
                <h3>Ventas del Turno Activo ({ventasJornadaActual.length})</h3>
                <div className={styles.tablaResponsiveContainer}>
                  <table className={styles.tablaApp}>
                    <thead>
                      <tr><th>Hora</th><th>Cliente</th><th>Método</th><th>Total</th><th>Acción</th></tr>
                    </thead>
                    <tbody>
                      {ventasJornadaActual.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No hay ventas registradas en el turno actual.</td></tr>
                      ) : (
                        ventasJornadaActual.map((v) => (
                          <tr key={v.id}>
                            <td>{formatearFecha(v.created_at)}</td>
                            <td>{v.cliente}</td>
                            <td>{v.metodo_pago}</td>
                            <td><strong>${v.total.toLocaleString()}</strong></td>
                            <td><button onClick={() => setVentaSeleccionada(v)} className={styles.btnVerConBorde}>Ver detalle</button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* HISTORIALES */}
          {subPestanaVentas === 'historial' && (
            <div className={styles.seccionHistoriales}>
              <div className={styles.subSubBarra}>
                <button className={subPestanaHistorial === 'ventas' ? styles.subSubActive : ''} onClick={() => setSubPestanaHistorial('ventas')}>Historial de Ventas por Arqueo</button>
                <button className={subPestanaHistorial === 'cierres' ? styles.subSubActive : ''} onClick={() => setSubPestanaHistorial('cierres')}>Historial de Arqueos / Turnos</button>
              </div>

              {subPestanaHistorial === 'ventas' ? (
                <div>
                  <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ fontWeight: 'bold' }}>Seleccionar Arqueo / Turno para ver detalle:</label>
                    <select 
                      className={styles.selectChico} 
                      style={{ maxWidth: '420px', width: '100%' }} 
                      value={cierreFiltroSeleccionado} 
                      onChange={(e) => setCierreFiltroSeleccionado(e.target.value)}
                    >
                      <option value="abierta">Turno activo</option>
                      {cierres.map((c) => (
                        <option key={c.id} value={c.id}>
                          Arqueo del {formatearFecha(c.fecha)} — Total: ${c.total_sistema.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <div className={styles.accionesExportacion}>
                      <button type="button" className={styles.btnVerConBorde} onClick={exportarVentasPdf}>
                        Guardar ventas como PDF
                      </button>
                      <button type="button" className={styles.btnVerConBorde} onClick={exportarGastosPdf}>
                        Guardar gastos como PDF
                      </button>
                    </div>
                  </div>

                  {/* Resumen dinámico al consultar un arqueo guardado del pasado */}
                  {cierreFiltroSeleccionado !== 'abierta' && arqueoSeleccionado && (
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 10px', color: '#0f172a' }}>
                        Resumen del arqueo — {formatearFecha(arqueoSeleccionado.fecha)}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '13px' }}>
                        <div><span>Base Inicial:</span><br/><strong>${(arqueoSeleccionado.base_inicial || 0).toLocaleString()}</strong></div>
                        <div><span>Total Ventas:</span><br/><strong style={{ color: '#2563eb' }}>${arqueoSeleccionado.total_sistema.toLocaleString()}</strong></div>
                        <div><span>Efectivo:</span><br/><strong>${((arqueoSeleccionado.base_inicial || 0) + arqueoSeleccionado.efectivo_sistema - (arqueoSeleccionado.gastos_efectivo || 0)).toLocaleString()}</strong></div>
                        <div><span>Tarjeta:</span><br/><strong>${(arqueoSeleccionado.tarjeta_sistema - (arqueoSeleccionado.gastos_tarjeta || 0)).toLocaleString()}</strong></div>
                        <div><span>Transferencia:</span><br/><strong>${(arqueoSeleccionado.transferencia_sistema - (arqueoSeleccionado.gastos_transferencia || 0)).toLocaleString()}</strong></div>
                        <div><span>Total gastos:</span><br/><strong style={{ color: '#b45309' }}>${(arqueoSeleccionado.total_gastos || 0).toLocaleString()}</strong></div>
                        <div><span>Total neto:</span><br/><strong>${(arqueoSeleccionado.total_neto || 0).toLocaleString()}</strong></div>
                        <div><span>Diferencia Cierre:</span><br/>
                          <strong style={{ color: (arqueoSeleccionado.diferencia_efectivo + arqueoSeleccionado.diferencia_tarjeta + arqueoSeleccionado.diferencia_transferencia) < 0 ? '#dc2626' : '#16a34a' }}>
                            ${(arqueoSeleccionado.diferencia_efectivo + arqueoSeleccionado.diferencia_tarjeta + arqueoSeleccionado.diferencia_transferencia).toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <h4>Gastos asociados ({gastosFiltradosHistorial.length})</h4>
                  <div className={styles.tablaResponsiveContainer}>
                    <table className={styles.tablaApp}>
                      <thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Monto</th></tr></thead>
                      <tbody>
                        {gastosFiltradosHistorial.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No se encontraron gastos asociados a este arqueo.</td></tr>
                        ) : gastosFiltradosHistorial.map((gasto) => (
                          <tr key={gasto.id}>
                            <td>{formatearFecha(gasto.created_at)}</td>
                            <td>{gasto.concepto}</td>
                            <td>{gasto.metodo_pago}</td>
                            <td><strong>${gasto.monto.toLocaleString()}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4>Ventas registradas en este arqueo ({ventasFiltradasHistorial.length})</h4>

                  <div className={styles.tablaResponsiveContainer}>
                    <table className={styles.tablaApp}>
                      <thead>
                        <tr><th>Hora/Fecha</th><th>Cliente</th><th>Método</th><th>Total</th><th>Acciones</th></tr>
                      </thead>
                      <tbody>
                        {ventasFiltradasHistorial.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                              No se encontraron ventas asociadas a este arqueo seleccionado.
                            </td>
                          </tr>
                        ) : (
                          ventasFiltradasHistorial.map((v) => (
                            <tr key={v.id}>
                              <td>{formatearFecha(v.created_at)}</td>
                              <td>{v.cliente}</td>
                              <td>{v.metodo_pago}</td>
                              <td><strong>${v.total.toLocaleString()}</strong></td>
                              <td>
                                <button onClick={() => setVentaSeleccionada(v)} className={styles.btnVerConBorde}>Ver ticket</button>
                                <button aria-label={`Eliminar venta ${v.id}`} onClick={() => eliminarVenta(v.id)} className={styles.btnEliminarConBorde} style={{ marginLeft: '6px' }}>🗑️</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className={styles.tablaResponsiveContainer}>
                  <table className={styles.tablaApp}>
                    <thead>
                      <tr><th>Fecha del arqueo</th><th>Base</th><th>Total del sistema</th><th>Ventas</th><th>Gastos</th><th>Diferencia</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {cierres.map((c) => (
                        <tr key={c.id}>
                          <td>{formatearFecha(c.fecha)}</td>
                          <td>${c.base_inicial?.toLocaleString() || 0}</td>
                          <td>${c.total_sistema.toLocaleString()}</td>
                          <td>{ventas.filter((v) => v.cierre_id === c.id).length}</td>
                          <td>{gastos.filter((g) => g.cierre_id === c.id).length}</td>
                          <td style={{ color: (c.diferencia_efectivo + c.diferencia_tarjeta + c.diferencia_transferencia) < 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                            ${(c.diferencia_efectivo + c.diferencia_tarjeta + c.diferencia_transferencia).toLocaleString()}
                          </td>
                          <td>
                            <button onClick={() => { setCierreFiltroSeleccionado(c.id); setSubPestanaHistorial('ventas'); }} className={styles.btnVerConBorde}>Ver registros</button>
                            <button aria-label="Eliminar arqueo" onClick={() => eliminarCierre(c.id)} className={styles.btnEliminarConBorde}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MÓDULO PRODUCCIÓN */}
      {modulo === 'produccion' && (
        <div>
          <div className={styles.subBarra}>
            <button className={subPestanaProduccion === 'inventario' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('inventario')}>Inventario de insumos</button>
            {rolActual === 'admin' && <button className={subPestanaProduccion === 'recetas' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('recetas')}>Recetas y costos</button>}
            {rolActual === 'admin' && <button className={subPestanaProduccion === 'productos' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('productos')}>Productos y precios</button>}
          </div>

          {/* INVENTARIO */}
          {subPestanaProduccion === 'inventario' && (
            <div className={styles.paddingBloque}>
              <div className={styles.formArqueoCaja} style={{ marginBottom: '20px' }}>
                <h3>Inventario del turno</h3>
                <p>{jornadaInventarioId
                  ? `Turno asociado: ${cierres.find((cierre) => cierre.jornada_id === jornadaInventarioId) ? formatearFecha(cierres.find((cierre) => cierre.jornada_id === jornadaInventarioId)!.fecha) : 'turno activo'}`
                  : 'Abre o cierra un turno de caja para registrar su inventario.'}</p>
                <p>Registra las entradas recibidas y el conteo físico al final del turno. El sistema compara el final esperado (stock inicial + entradas - consumo según recetas) con el conteo final.</p>
                {inventarioTurnoCargando && <strong>Verificando el inventario del turno...</strong>}
                {entradasTurnoActual && (
                  <strong>
                    Entradas del turno guardadas el {formatearFecha(entradasTurnoActual.updated_at)}.
                    {rolActual === 'mesero' && !inventarioTurnoActual && ' Solo el administrador puede corregirlas.'}
                  </strong>
                )}
                {inventarioTurnoActual && <strong>Inventario guardado y bloqueado el {formatearFecha(inventarioTurnoActual.created_at)}.</strong>}
                {inventarioTurnoActual && (
                  <button type="button" className={styles.btnVerConBorde} onClick={exportarInventarioPdf}>
                    Guardar inventario como PDF
                  </button>
                )}
              </div>
              {jornadaId
                && diferenciasInventarioJornadaId === jornadaId
                && diferenciasInventarioAnterior.length > 0 && (
                <aside className={styles.alertaInventarioAnterior} role="status">
                  <strong>Revisa las diferencias del inventario anterior</strong>
                  <ul>
                    {diferenciasInventarioAnterior.map((item) => (
                      <li key={item.insumo_id}>
                        {item.diferencia < 0 ? 'Faltante' : 'Sobrante'} de {item.nombre}:{' '}
                        {Math.abs(item.diferencia).toLocaleString()} {item.unidad}
                      </li>
                    ))}
                  </ul>
                </aside>
              )}

              {rolActual === 'admin' && (
                <form onSubmit={guardarInsumo} className={styles.formStandard}>
                  <h3>Registrar materia prima</h3>
                  <div className={styles.grid3Campos}>
                    <input type="text" placeholder="Nombre insumo" value={nuevoInsumoNombre} onChange={(e) => setNuevoInsumoNombre(e.target.value)} required />
                    <select value={nuevoInsumoUnidad} onChange={(e) => setNuevoInsumoUnidad(e.target.value)}>
                      <option value="g">Gramos (g)</option><option value="kg">Kilos (kg)</option><option value="ml">Ml</option><option value="unidades">Unidades</option>
                    </select>
                    <input type="number" placeholder="Stock inicial" value={nuevoInsumoStock} onChange={(e) => setNuevoInsumoStock(e.target.value)} required />
                  </div>
                  <button
                    type="submit"
                    className={styles.btnAgregarConBorde}
                    disabled={entradasTurnoGuardadas?.jornada_id === jornadaId || Boolean(inventarioTurnoActual) || inventarioTurnoCargando}
                  >
                    Guardar insumo
                  </button>
                </form>
              )}

              <section className={styles.entradasInventarioPanel} aria-labelledby="titulo-entradas-inventario">
                <div>
                  <h3 id="titulo-entradas-inventario">Entradas al inicio del turno</h3>
                  <p>Registra una vez los insumos recibidos. Después de guardar, solo el administrador puede corregir las cantidades antes de cerrar el inventario.</p>
                </div>
                {rolActual === 'admin' && jornadaId && entradasTurnoActual && !inventarioTurnoActual && !editandoEntradasInventario && (
                  <button type="button" className={styles.btnVerConBorde} onClick={() => setEditandoEntradasInventario(true)}>
                    Autorizar edición de entradas
                  </button>
                )}
                {editandoEntradasInventario && (
                  <button
                    type="button"
                    className={styles.btnEliminarConBorde}
                    onClick={() => {
                      setEntradasInventario(Object.fromEntries(
                        Object.entries(entradasTurnoActual?.entradas || {}).map(([id, cantidad]) => [id, String(cantidad)]),
                      ));
                      setEditandoEntradasInventario(false);
                    }}
                  >
                    Cancelar edición
                  </button>
                )}
                {entradasTurnoActual && rolActual === 'mesero' && !inventarioTurnoActual && (
                  <p role="status">Las entradas están bloqueadas. Solicita al administrador que inicie sesión para corregirlas.</p>
                )}
                {!entradasTurnoActual && !jornadaId && (
                  <p>Abre un turno para registrar las entradas de inventario.</p>
                )}
              </section>
              {(!entradasTurnoActual || editandoEntradasInventario) && (
                <button
                  type="button"
                  onClick={guardarEntradasInventarioTurno}
                  className={styles.btnGuardarInventario}
                  disabled={!jornadaId || Boolean(inventarioTurnoActual) || inventarioTurnoCargando || guardandoInventario}
                >
                  {guardandoInventario ? 'Guardando entradas...' : entradasTurnoActual ? 'Guardar cambios de entradas' : 'Guardar entradas del turno'}
                </button>
              )}

              <div className={styles.tablaResponsiveContainer}>
                <table className={styles.tablaApp}>
                  <thead>
                    <tr><th>Insumo</th><th>Stock inicial</th><th>Entradas recibidas</th><th>Consumo según recetas</th><th>Final esperado</th><th>Conteo final</th></tr>
                  </thead>
                  <tbody>
                    {insumos.map((i) => (
                      <tr key={i.id}>
                        <td><strong>{i.nombre}</strong></td>
                        <td>{inventarioTurnoActual?.stock_inicial[i.id] ?? entradasTurnoActual?.stock_inicial[i.id] ?? i.stock_actual} {i.unidad}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            className={styles.cantInput}
                            value={entradasInventario[i.id] ?? ''}
                            onChange={(e) => setEntradasInventario((actuales) => ({ ...actuales, [i.id]: e.target.value }))}
                            disabled={
                              Boolean(inventarioTurnoActual)
                              || inventarioTurnoCargando
                              || !jornadaId
                              || Boolean(entradasTurnoActual && (rolActual !== 'admin' || !editandoEntradasInventario))
                            }
                            aria-label={`Entradas de ${i.nombre}`}
                          />
                        </td>
                        <td>{inventarioTurnoActual?.consumo_esperado[i.id] ?? consumoTeoricoInventario(i.id)} {i.unidad}</td>
                        <td>{(
                          (inventarioTurnoActual?.stock_inicial[i.id] ?? entradasTurnoActual?.stock_inicial[i.id] ?? i.stock_actual)
                          + Number(entradasTurnoActual?.entradas[i.id] ?? entradasInventario[i.id] ?? 0)
                          - (inventarioTurnoActual?.consumo_esperado[i.id] ?? consumoTeoricoInventario(i.id))
                        ).toLocaleString()} {i.unidad}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Conteo físico"
                            className={styles.cantInput}
                            value={conteosFinalesInventario[i.id] ?? ''}
                            onChange={(e) => setConteosFinalesInventario((actuales) => ({ ...actuales, [i.id]: e.target.value }))}
                            disabled={Boolean(inventarioTurnoActual) || inventarioTurnoCargando || !jornadaInventarioId || !entradasTurnoActual}
                            aria-label={`Conteo final de ${i.nombre}`}
                          />
                          {inventarioTurnoActual && (inventarioTurnoActual.diferencias[i.id] || 0) !== 0 && (
                            <small style={{ display: 'block', color: '#b91c1c' }}>
                              Diferencia: {inventarioTurnoActual.diferencias[i.id].toLocaleString()} {i.unidad}
                            </small>
                          )}
                          {!inventarioTurnoActual && conteosFinalesInventario[i.id] !== undefined && conteosFinalesInventario[i.id] !== '' && (
                            (() => {
                              const esperado = (entradasTurnoActual?.stock_inicial[i.id] ?? i.stock_actual)
                                + Number(entradasTurnoActual?.entradas[i.id] ?? 0)
                                - consumoTeoricoInventario(i.id);
                              const diferencia = Number(conteosFinalesInventario[i.id]) - esperado;
                              return diferencia === 0 ? null : <small style={{ display: 'block', color: '#b91c1c' }}>Diferencia: {diferencia.toLocaleString()} {i.unidad}</small>;
                            })()
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={guardarInventarioTurno}
                className={styles.btnGuardarInventario}
                disabled={!jornadaInventarioId || !entradasTurnoActual || Boolean(inventarioTurnoActual) || inventarioTurnoCargando || guardandoInventario || insumos.length === 0}
              >
                {guardandoInventario ? 'Guardando inventario final...' : inventarioTurnoActual ? 'Inventario final guardado' : 'Guardar inventario final'}
              </button>
            </div>
          )}

          {/* RECETAS */}
          {subPestanaProduccion === 'recetas' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={guardarRecetaMultiple} className={styles.formStandard}>
                <h3>Crear receta</h3>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Producto del Menú:</label>
                  <select className={styles.selectChico} style={{ maxWidth: '350px' }} value={prodRecetaSel} onChange={(e) => setProdRecetaSel(e.target.value)} required>
                    <option value="">-- Seleccionar Producto --</option>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Insumos que requiere:</label>
                {lineasReceta.map((linea, index) => (
                  <div key={index} className={styles.filaPedido} style={{ marginBottom: '8px' }}>
                    <select className={styles.selectChico} value={linea.insumo_id} onChange={(e) => {
                      const n = [...lineasReceta];
                      n[index].insumo_id = e.target.value;
                      setLineasReceta(n);
                    }}>
                      <option value="">-- Insumo --</option>
                      {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                    </select>

                    <input type="number" step="any" placeholder="Cantidad por venta" className={styles.cantInput} value={linea.cantidad_requerida} onChange={(e) => {
                      const n = [...lineasReceta];
                      n[index].cantidad_requerida = e.target.value;
                      setLineasReceta(n);
                    }} />

                    {lineasReceta.length > 1 && (
                      <button type="button" onClick={() => setLineasReceta(lineasReceta.filter((_, idx) => idx !== index))} className={styles.btnTrash}>✕</button>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button type="button" className={styles.btnAgregarLineaConBorde} onClick={() => setLineasReceta([...lineasReceta, { insumo_id: '', cantidad_requerida: '' }])}>
                    ＋ Agregar otro insumo
                  </button>
                  <button type="submit" className={styles.btnAgregarConBorde}>Guardar receta</button>
                </div>
              </form>

              <h3 style={{ marginTop: '28px' }}>Recetas registradas</h3>
              <div className={styles.tablaResponsiveContainer}>
                <table className={styles.tablaApp}>
                  <thead>
                    <tr><th>Producto</th><th>Insumo Consumido</th><th>Cantidad Requerida</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {recetas.map((r) => {
                      const prod = productos.find((p) => p.id === r.producto_id);
                      const ins = insumos.find((i) => i.id === r.insumo_id);

                      return (
                        <tr key={r.id}>
                          <td><strong>{prod ? prod.nombre : 'Producto no encontrado'}</strong></td>
                          <td>{ins ? `${ins.nombre} (${ins.unidad})` : 'Insumo no encontrado'}</td>
                          <td>
                            {recetaEditandoId === r.id ? (
                              <input
                                type="number"
                                step="any"
                                className={styles.cantInput}
                                value={cantEditandoVal}
                                onChange={(e) => setCantEditandoVal(e.target.value)}
                              />
                            ) : (
                              `${r.cantidad_requerida} ${ins ? ins.unidad : ''}`
                            )}
                          </td>
                          <td>
                            {recetaEditandoId === r.id ? (
                              <button onClick={() => editarCantidadReceta(r.id)} className={styles.btnAgregarConBorde}>Guardar</button>
                            ) : (
                              <button onClick={() => { setRecetaEditandoId(r.id); setCantEditandoVal(r.cantidad_requerida.toString()); }} className={styles.btnVerConBorde}>Editar</button>
                            )}
                            <button aria-label="Eliminar receta" onClick={() => eliminarRecetaItem(r.id)} className={styles.btnEliminarConBorde} style={{ marginLeft: '6px' }}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PRODUCTOS */}
          {subPestanaProduccion === 'productos' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={guardarProducto} className={styles.formStandard}>
                <h3>{productoEditando ? 'Editar producto' : 'Nuevo producto'}</h3>
                <div className={styles.grid2Campos}>
                  <input type="text" placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
                  <input type="number" placeholder="Precio ($)" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} required />
                </div>
                <button type="submit" className={styles.btnAgregarConBorde}>{productoEditando ? 'Guardar Cambios' : 'Agregar Al Menú'}</button>
              </form>

              <div className={styles.tablaResponsiveContainer}>
                <table className={styles.tablaApp}>
                  <thead><tr><th>Producto</th><th>Precio</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {productos.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>${p.precio.toLocaleString()}</td>
                        <td>
                          <button onClick={() => { setProductoEditando(p); setNuevoNombre(p.nombre); setNuevoPrecio(p.precio.toString()); }} className={styles.btnVerConBorde}>Editar</button>
                          <button aria-label={`Eliminar producto ${p.nombre}`} onClick={async () => { await supabase.from('productos').delete().eq('id', p.id); if (usuario) obtenerProductos(usuario.id); }} className={styles.btnEliminarConBorde} style={{ marginLeft: '6px' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL TICKET DE COMANDA PARA COCINA */}
      {usuariosModalAbierto && rolActual === 'admin' && (
        <div className={styles.overlayModal} onClick={() => setUsuariosModalAbierto(false)}>
          <section className={styles.modalPantallaCompleta} onClick={(e) => e.stopPropagation()} aria-labelledby="usuarios-title" role="dialog" aria-modal="true">
            <header className={styles.encabezadoModalPagina}>
              <div>
                <span className={styles.etiquetaModal}>Administración del negocio</span>
                <h2 id="usuarios-title">Usuarios y accesos</h2>
                <p>Crea y administra los accesos del personal que trabaja en {perfil?.nombre_local || 'tu negocio'}.</p>
              </div>
              <button type="button" className={styles.btnCerrarModal} onClick={() => setUsuariosModalAbierto(false)} aria-label="Cerrar usuarios">×</button>
            </header>
            <div className={styles.contenidoModalPagina}>
              <div className={styles.tarjetaGestionUsuarios}>
                <span className={styles.iconoGestion}>+</span>
                <div>
                  <h3>Crear acceso de mesero</h3>
                  <p>El mesero entra desde el login principal y solo tiene acceso a mesas y pedidos.</p>
                </div>
                <form onSubmit={crearMesero} className={styles.formUsuarioCompleto}>
                  <label htmlFor="usuario-mesero">Usuario de acceso</label>
                  <input id="usuario-mesero" value={nuevoMeseroUsuario} onChange={(e) => setNuevoMeseroUsuario(e.target.value)} placeholder="Ejemplo: areparamesero1" pattern="[A-Za-z0-9._-]+" required />
                  <small>Escribe el usuario sin @. Ejemplo: areparamesero1. Se ingresa así desde el login principal.</small>
                  <label htmlFor="clave-mesero">Clave temporal</label>
                  <input id="clave-mesero" type="password" value={nuevoMeseroClave} onChange={(e) => setNuevoMeseroClave(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
                  <small>La clave se define aquí y se usa al iniciar sesión desde la pantalla principal.</small>
                  <button type="submit" className={styles.btnAgregarConBorde} disabled={creandoMesero}>
                    {creandoMesero ? 'Creando acceso...' : 'Crear usuario mesero'}
                  </button>
                </form>
              </div>
              <div className={styles.listaGestionUsuarios}>
                <div className={styles.tituloListaUsuarios}>
                  <div><h3>Usuarios registrados</h3><p>{miembrosNegocio.length} acceso(s) configurado(s)</p></div>
                  <span className={styles.badgeRol}>Administrador</span>
                </div>
                {miembrosNegocio.length === 0 ? (
                  <div className={styles.estadoVacioUsuarios}><strong>Aún no hay meseros registrados</strong><span>Crea el primer acceso para tu equipo.</span></div>
                ) : miembrosNegocio.map((miembro) => (
                  <div key={miembro.id} className={styles.filaUsuarioCompleta}>
                    <span className={styles.avatarUsuarioLista}>{miembro.username.charAt(0).toUpperCase()}</span>
                    <div><strong>{miembro.username}</strong><span>Acceso de mesero</span></div>
                    <div className={styles.accionesUsuarioLista}>
                      <span className={miembro.activo ? styles.estadoActivo : styles.estadoInactivo}>{miembro.activo ? 'Activo' : 'Inactivo'}</span>
                      <button type="button" className={styles.btnEliminarConBorde} onClick={() => eliminarUsuarioNegocio(miembro)} aria-label={`Eliminar usuario ${miembro.username}`}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {editarPerfilAbierto && (
        <div className={styles.overlayModal} onClick={() => { setEditarPerfilAbierto(false); setClaveAdminEdicion(''); }}>
          <form className={styles.modalPerfil} onClick={(e) => e.stopPropagation()} onSubmit={guardarPerfil}>
            <div className={styles.encabezadoModalFormulario}><div><span className={styles.etiquetaModal}>Configuración del negocio</span><h2>Editar información</h2><p>Mantén actualizados los datos que identifican tu restaurante.</p></div><button type="button" className={styles.btnCerrarModal} onClick={() => setEditarPerfilAbierto(false)} aria-label="Cerrar edición">×</button></div>
            <div className={styles.formularioPerfil}>
              <label htmlFor="perfil-nombre">Nombre completo<input id="perfil-nombre" value={perfilEditando.nombre_persona} onChange={(e) => setPerfilEditando({ ...perfilEditando, nombre_persona: e.target.value })} required /></label>
              <label htmlFor="perfil-negocio">Nombre del negocio<input id="perfil-negocio" value={perfilEditando.nombre_local} onChange={(e) => setPerfilEditando({ ...perfilEditando, nombre_local: e.target.value })} required /></label>
              <label htmlFor="perfil-documento">Documento<input id="perfil-documento" value={perfilEditando.documento} onChange={(e) => setPerfilEditando({ ...perfilEditando, documento: e.target.value })} required /></label>
              <label htmlFor="perfil-telefono">Teléfono<input id="perfil-telefono" value={perfilEditando.telefono} onChange={(e) => setPerfilEditando({ ...perfilEditando, telefono: e.target.value })} required /></label>
              <label htmlFor="perfil-direccion" className={styles.campoCompleto}>Dirección<input id="perfil-direccion" value={perfilEditando.direccion} onChange={(e) => setPerfilEditando({ ...perfilEditando, direccion: e.target.value })} required /></label>
              <label htmlFor="clave-admin-edicion" className={styles.campoCompleto}>Contraseña actual del administrador<input id="clave-admin-edicion" type="password" autoComplete="current-password" value={claveAdminEdicion} onChange={(e) => setClaveAdminEdicion(e.target.value)} required /></label>
            </div>
            <div className={styles.accionesModal}><button type="button" className={styles.btnCancelarModal} onClick={() => { setEditarPerfilAbierto(false); setClaveAdminEdicion(''); }}>Cancelar</button><button type="submit" className={styles.btnAgregarConBorde} disabled={guardandoPerfil}>{guardandoPerfil ? 'Verificando...' : 'Guardar información'}</button></div>
          </form>
        </div>
      )}

      {comandaImprimir && (
        <div className={styles.overlayModal} onClick={() => setComandaImprimir(null)}>
          <div className={styles.modalContentTicket} onClick={(e) => e.stopPropagation()}>
            <div className={styles.ticketImpresionArea}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #0f172a', paddingBottom: '8px', marginBottom: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Pedido de cocina</h2>
                <h3 style={{ margin: '4px 0 0', fontSize: '18px' }}>COMANDA #{comandaImprimir.numero}</h3>
                <p style={{ margin: '2px 0', fontSize: '12px' }}><strong>MESA:</strong> {comandaImprimir.mesa}</p>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#475569' }}>Hora Entrada: {comandaImprimir.hora}</p>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#475569' }}><strong>Tomó el pedido:</strong> {comandaImprimir.tomadoPor}</p>
              </div>

              <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                <p style={{ margin: '2px 0' }}><strong>Cliente:</strong> {comandaImprimir.cliente}</p>
              </div>

              <table className={styles.tablaTicketPreview}>
                <thead>
                  <tr><th>Cant.</th><th>Producto</th></tr>
                </thead>
                <tbody>
                  {comandaImprimir.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold', fontSize: '15px' }}>{item.cantidad}x</td>
                      <td style={{ fontSize: '14px', fontWeight: 'bold' }}>{item.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {comandaImprimir.comentario && (
                <div style={{ marginTop: '12px', background: '#f1f5f9', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', color: '#0f172a' }}>Observaciones:</span>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>
                    {comandaImprimir.comentario}
                  </p>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => { window.print(); setComandaImprimir(null); }} className={styles.btnCobrar} style={{ flex: 1 }}>
                Imprimir pedido
              </button>
              <button onClick={() => setComandaImprimir(null)} className={styles.btnAgregarConBorde}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRO CON ENCABEZADO DE FACTURA COMPLETO */}
      {mostrarModalCobro && mesaSeleccionada && (
        <div className={styles.overlayModal} onClick={() => setMostrarModalCobro(false)}>
          <div className={styles.modalCobroGrandote} onClick={(e) => e.stopPropagation()}>
            <div className={styles.columnaPreviewFactura}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #cbd5e1', paddingBottom: '8px', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{perfil?.nombre_local || 'Mi Negocio'}</h3>
                <p style={{ margin: '2px 0', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Propietario: {perfil?.nombre_persona || 'Administrador'}</p>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#475569' }}>NIT / CC: {perfil?.documento || 'N/A'}</p>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#475569' }}>Dir: {perfil?.direccion || 'N/A'} | Tel: {perfil?.telefono || 'N/A'}</p>
              </div>

              <p style={{ fontSize: '13px', margin: '4px 0' }}><strong>Mesa:</strong> {mesaSeleccionada.nombre}</p>
              <p style={{ fontSize: '13px', margin: '4px 0' }}><strong>Cliente:</strong> {clienteNombreMesa || 'Consumidor Final'}</p>

              <table className={styles.tablaTicketPreview}>
                <thead>
                  <tr><th>Cant.</th><th>Producto</th><th>P.Unit</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                  {lineasMesa
                    .filter((f) => f.productoId !== '')
                    .map((f) => {
                      const prod = productos.find((p) => p.id === f.productoId);
                      return (
                        <tr key={f.id}>
                          <td>{f.cantidad}</td>
                          <td>{prod?.nombre}</td>
                          <td>${prod?.precio.toLocaleString()}</td>
                          <td>${((prod?.precio || 0) * f.cantidad).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', borderTop: '2px dashed #0f172a', paddingTop: '8px', marginTop: '12px' }}>
                <span>Total a pagar:</span>
                <strong style={{ color: '#16a34a' }}>${totalCalculadoMesa.toLocaleString()}</strong>
              </div>
            </div>

            <div className={styles.columnaOpcionesCobro}>
              <h3>Opciones de pago</h3>

              <button
                type="button"
                className={styles.btnVerConBorde}
                onClick={() => {
                  if (dividirCuenta) {
                    setDivisionesCuenta([]);
                    setDivisionAbiertaId(null);
                    setDividirCuenta(false);
                    return;
                  }
                  const personaUnoId = Date.now();
                  setDivisionesCuenta([
                    { id: personaUnoId, nombre: 'Persona 1', metodo_pago: 'Efectivo', cantidades: {} },
                    { id: personaUnoId + 1, nombre: 'Persona 2', metodo_pago: 'Efectivo', cantidades: {} },
                  ]);
                  setDivisionAbiertaId(personaUnoId);
                  setDividirCuenta(true);
                }}
                style={{ width: '100%', marginBottom: '12px' }}
              >
                {dividirCuenta ? 'Volver al pago único' : 'Dividir cuenta por productos'}
              </button>

              {!dividirCuenta ? (
                <>
              <div style={{ margin: '12px 0' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Método de pago:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['Efectivo', 'Tarjeta', 'Transferencia'] as const).map((m) => (
                    <button
                      key={m}
                      className={metodoPago === m ? styles.metodoSel : ''}
                      onClick={() => setMetodoPago(m)}
                      style={{ flex: 1, padding: '10px', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {metodoPago === 'Efectivo' && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', margin: '12px 0' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Monto pagado por el cliente:</label>
                  <input
                    type="number"
                    placeholder="Ej: 50000"
                    value={montoPagaCon}
                    onChange={(e) => setMontoPagaCon(e.target.value)}
                    className={styles.inputChico}
                    style={{ fontSize: '18px', fontWeight: 'bold' }}
                  />

                  {montoPagaCon !== '' && (
                    <div style={{ marginTop: '10px' }}>
                      {cambioEfectivo >= 0 ? (
                        <div style={{ color: '#15803d', fontWeight: 'bold', fontSize: '16px', background: '#dcfce7', padding: '8px', borderRadius: '6px' }}>
                          Cambio a entregar: ${cambioEfectivo.toLocaleString()}
                        </div>
                      ) : (
                        <div style={{ color: '#b91c1c', fontWeight: 'bold', fontSize: '14px', background: '#fef2f2', padding: '8px', borderRadius: '6px' }}>
                          Faltan: ${Math.abs(cambioEfectivo).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={finalizarYCobrarVenta} className={styles.btnCobrar} style={{ width: '100%', fontSize: '16px' }} disabled={procesandoPago}>
                  {procesandoPago ? 'Registrando venta...' : 'Finalizar y registrar venta'}
                </button>
                <button onClick={() => setMostrarModalCobro(false)} className={styles.btnEliminarConBorde} style={{ width: '100%' }} disabled={procesandoPago}>
                  Cancelar
                </button>
              </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>Asigna cada unidad del pedido a una sola persona. Se generará una factura independiente por persona.</p>
                  <p className={styles.resumenUnidadesPendientes}>
                    Unidades por asignar:{' '}
                    <strong>
                      {lineasMesa
                        .filter((linea) => linea.productoId !== '')
                        .reduce((total, linea) => total + unidadesSinAsignar(linea), 0)}
                    </strong>
                  </p>
                  {divisionesCuenta.map((division, index) => {
                    const totalDivision = lineasMesa.reduce((total, linea) => {
                      const producto = productos.find((item) => item.id === linea.productoId);
                      return total + (producto?.precio || 0) * (Number(division.cantidades[linea.id]) || 0);
                    }, 0);
                    const unidadesAsignadas = Object.values(division.cantidades)
                      .reduce((total, cantidad) => total + (Number(cantidad) || 0), 0);
                    return (
                      <details key={division.id} className={styles.personaPagoDropdown} open={divisionAbiertaId === division.id}>
                        <summary onClick={(event) => {
                          event.preventDefault();
                          setDivisionAbiertaId((actual) => actual === division.id ? null : division.id);
                        }}>
                          <span>
                            <strong>{division.nombre || `Persona ${index + 1}`}</strong>
                            <small>{unidadesAsignadas} unidades asignadas</small>
                          </span>
                          <strong>${totalDivision.toLocaleString()}</strong>
                        </summary>
                        <div className={styles.personaPagoContenido}>
                          <label className={styles.campoPersonaPago}>
                            Nombre
                            <input
                              value={division.nombre}
                              onChange={(event) => setDivisionesCuenta((actuales) => actuales.map((item) => item.id === division.id ? { ...item, nombre: event.target.value } : item))}
                              className={styles.inputChico}
                              aria-label={`Nombre de ${division.nombre}`}
                            />
                          </label>
                          <label className={styles.campoPersonaPago}>
                            Método de pago
                            <select
                              value={division.metodo_pago}
                              onChange={(event) => setDivisionesCuenta((actuales) => actuales.map((item) => item.id === division.id ? { ...item, metodo_pago: event.target.value as DivisionPago['metodo_pago'] } : item))}
                              className={styles.selectChico}
                            >
                              <option value="Efectivo">Efectivo</option>
                              <option value="Tarjeta">Tarjeta</option>
                              <option value="Transferencia">Transferencia</option>
                            </select>
                          </label>
                          <div className={styles.listaProductosPersona}>
                            {lineasMesa.filter((linea) => linea.productoId !== '').map((linea) => {
                              const producto = productos.find((item) => item.id === linea.productoId);
                              const disponible = unidadesDisponiblesParaDivision(division.id, linea.id);
                              return (
                                <label key={linea.id} className={styles.filaProductoDivision}>
                                  <span>
                                    <strong>{producto?.nombre || 'Producto'}</strong>
                                    <small>
                                      Máximo para esta persona: {disponible}
                                      {' · '}
                                      {unidadesSinAsignar(linea)} por asignar
                                    </small>
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={disponible}
                                    step="1"
                                    value={division.cantidades[linea.id] || ''}
                                    onChange={(event) => actualizarCantidadDivision(division.id, linea.id, event.target.value)}
                                    className={styles.cantInput}
                                    aria-label={`Unidades disponibles de ${producto?.nombre || 'producto'} para ${division.nombre}`}
                                  />
                                </label>
                              );
                            })}
                          </div>
                          <div className={styles.piePersonaPago}>
                            <strong>Total de {division.nombre || `Persona ${index + 1}`}: ${totalDivision.toLocaleString()}</strong>
                            {divisionesCuenta.length > 2 && (
                              <button type="button" className={styles.btnEliminarConBorde} onClick={() => {
                                const restantes = divisionesCuenta.filter((item) => item.id !== division.id);
                                setDivisionesCuenta(restantes);
                                if (divisionAbiertaId === division.id) setDivisionAbiertaId(restantes[0]?.id ?? null);
                              }}>
                                Quitar persona
                              </button>
                            )}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                  <strong className={styles.totalCuentaDividida}>Total pedido: ${totalCalculadoMesa.toLocaleString()}</strong>
                  <button type="button" className={styles.btnVerConBorde} onClick={agregarDivisionCuenta}>Agregar persona</button>
                  <button type="button" onClick={finalizarPagoDividido} className={styles.btnCobrar} disabled={procesandoPago}>
                    {procesandoPago ? 'Generando facturas...' : 'Generar facturas por separado'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET CONFIRMADO PARA IMPRESIÓN */}
      {(ventaConfirmadaTicket || ventaSeleccionada) && (
        <div className={styles.overlayModal} onClick={ventaConfirmadaTicket ? avanzarTicketDivision : () => setVentaSeleccionada(null)}>
          <div className={styles.modalContentTicket} onClick={(e) => e.stopPropagation()}>
            <div className={styles.ticketImpresionArea}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #0f172a', paddingBottom: '8px', marginBottom: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>{perfil?.nombre_local || 'Mi Negocio'}</h2>
                <p style={{ margin: '2px 0', fontSize: '12px', fontWeight: 'bold' }}>Propietario: {perfil?.nombre_persona || 'Administrador'}</p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>NIT / CC: {perfil?.documento || 'N/A'}</p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>Dir: {perfil?.direccion || 'N/A'} | Tel: {perfil?.telefono || 'N/A'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{formatearFecha((ventaConfirmadaTicket || ventaSeleccionada)!.created_at)}</p>
              </div>

              <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                <p style={{ margin: '2px 0' }}><strong>Ticket #:</strong> {(ventaConfirmadaTicket || ventaSeleccionada)!.id}</p>
                <p style={{ margin: '2px 0' }}><strong>Cliente:</strong> {(ventaConfirmadaTicket || ventaSeleccionada)!.cliente}</p>
                <p style={{ margin: '2px 0' }}><strong>Método de Pago:</strong> {(ventaConfirmadaTicket || ventaSeleccionada)!.metodo_pago}</p>
                {(ventaConfirmadaTicket || ventaSeleccionada)!.nombre_vendedor && <p style={{ margin: '2px 0' }}><strong>Atendió:</strong> {(ventaConfirmadaTicket || ventaSeleccionada)!.nombre_vendedor}</p>}
              </div>

              <table className={styles.tablaTicketPreview}>
                <thead>
                  <tr><th>Cant.</th><th>Producto</th><th>P.Unit</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                  {(ventaConfirmadaTicket || ventaSeleccionada)!.productos.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.cantidad}</td>
                      <td>{item.nombre}</td>
                      <td>${item.precioUnitario?.toLocaleString()}</td>
                      <td>${item.subtotal?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', borderTop: '2px dashed #0f172a', paddingTop: '8px', marginTop: '10px' }}>
                <span>TOTAL:</span>
                <span>${(ventaConfirmadaTicket || ventaSeleccionada)!.total.toLocaleString()}</span>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => { window.print(); if (ventaConfirmadaTicket) avanzarTicketDivision(); else setVentaSeleccionada(null); }} className={styles.btnCobrar} style={{ flex: 1 }}>
                Imprimir ticket
              </button>
              <button onClick={ventaConfirmadaTicket ? avanzarTicketDivision : () => setVentaSeleccionada(null)} className={styles.btnAgregarConBorde}>
                {ventaConfirmadaTicket && ticketsDivisionPendientes.length > 0 ? 'Siguiente factura' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {reportePdf && (
        <section className={styles.reporteImpresion} aria-label={reportePdf.titulo}>
          <header className={styles.encabezadoReporte}>
            <p>{perfil?.nombre_local || 'Negocio'}</p>
            <h1>{reportePdf.titulo}</h1>
            <p>{reportePdf.subtitulo}</p>
            <small>Generado el {formatearFecha(reportePdf.generado)}</small>
          </header>
          <table className={styles.tablaReporte}>
            <thead>
              <tr>{reportePdf.encabezados.map((encabezado) => <th key={encabezado}>{encabezado}</th>)}</tr>
            </thead>
            <tbody>
              {reportePdf.filas.length === 0 ? (
                <tr><td colSpan={reportePdf.encabezados.length}>No hay registros para este turno.</td></tr>
              ) : reportePdf.filas.map((fila, index) => (
                <tr key={`${index}-${fila[0]}`}>
                  {fila.map((celda, celdaIndex) => <td key={`${index}-${celdaIndex}`}>{celda}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {reportePdf.resumen && <p className={styles.resumenReporte}>{reportePdf.resumen}</p>}
          <footer>Documento interno · {perfil?.nombre_local || 'Negocio'}</footer>
        </section>
      )}
    </div>
  );
}