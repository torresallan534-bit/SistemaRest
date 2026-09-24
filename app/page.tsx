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
interface ProductoVenta { nombre: string; cantidad: number; precioUnitario: number; subtotal: number; }
interface Venta { id: number; created_at: string; cliente: string; documento: string; metodo_pago: string; total: number; productos: ProductoVenta[]; cierre_id?: string; user_id?: string; jornada_id?: string; }
interface Gasto { id: string; created_at: string; concepto: string; metodo_pago: 'Efectivo' | 'Tarjeta' | 'Transferencia'; monto: number; jornada_id?: string; cierre_id?: string; user_id?: string; }
interface Mesa { 
  id: string; 
  nombre: string; 
  estado: 'libre' | 'ocupada'; 
  pedidos: LineaFactura[]; 
  cliente_nombre?: string;
  cliente_documento?: string;
  comentarios?: string;
  user_id?: string; 
}
interface CierreCaja { id: string; fecha: string; jornada_id?: string; base_inicial: number; total_sistema: number; total_neto?: number; total_gastos?: number; efectivo_sistema: number; tarjeta_sistema: number; transferencia_sistema: number; gastos_efectivo?: number; gastos_tarjeta?: number; gastos_transferencia?: number; efectivo_real: number; tarjeta_real: number; transferencia_real: number; diferencia_efectivo: number; diferencia_tarjeta: number; diferencia_transferencia: number; user_id?: string; }
interface MiembroNegocio { id: string; username: string; role: 'mesero'; auth_user_id: string; activo: boolean; }

export default function Home() {
  // Autenticación y Perfil
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [propietarioId, setPropietarioId] = useState<string | null>(null);
  const [rolActual, setRolActual] = useState<'admin' | 'mesero'>('admin');
  const [miembrosNegocio, setMiembrosNegocio] = useState<MiembroNegocio[]>([]);
  
  // Formulario Registro
  const [nombrePersonaInput, setNombrePersonaInput] = useState('');
  const [nombreLocalInput, setNombreLocalInput] = useState('');
  const [documentoLocalInput, setDocumentoLocalInput] = useState('');
  const [direccionLocalInput, setDireccionLocalInput] = useState('');
  const [telefonoLocalInput, setTelefonoLocalInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  const [esRegistro, setEsRegistro] = useState(false);
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
    comentario: string;
    items: { nombre: string; cantidad: number }[];
  } | null>(null);

  // Modal Cobro y Factura
  const [mostrarModalCobro, setMostrarModalCobro] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [montoPagaCon, setMontoPagaCon] = useState<string>('');
  const [ventaConfirmadaTicket, setVentaConfirmadaTicket] = useState<Venta | null>(null);

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
  const [conteosFisicos, setConteosFisicos] = useState<{ [key: string]: string }>({});

  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [cierreFiltroSeleccionado, setCierreFiltroSeleccionado] = useState<string>('abierta');
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [personalizacionAbierta, setPersonalizacionAbierta] = useState(false);
  const [usuariosAbierto, setUsuariosAbierto] = useState(false);
  const [nuevoMeseroUsuario, setNuevoMeseroUsuario] = useState('');
  const [nuevoMeseroClave, setNuevoMeseroClave] = useState('');
  const [editarPerfilAbierto, setEditarPerfilAbierto] = useState(false);
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
    const { data } = await supabase
      .from('miembros_negocio')
      .select('owner_user_id, role')
      .eq('auth_user_id', authUserId)
      .eq('activo', true)
      .maybeSingle();
    const ownerId = data?.owner_user_id || authUserId;
    setPropietarioId(ownerId);
    setRolActual(data?.role === 'mesero' ? 'mesero' : 'admin');
    return ownerId;
  };

  const cargarTodo = async (userId?: string) => {
    const uId = userId || propietarioId || usuario?.id;
    if (!uId) return;

    await Promise.all([
      obtenerJornadaActiva(uId),
      obtenerProductos(uId),
      obtenerInsumos(uId),
      obtenerRecetas(uId),
      obtenerVentas(uId),
      obtenerGastos(uId),
      obtenerMesas(uId),
      obtenerCierres(uId),
    ]);
  };

  // Inicialización de Sesión Persistente
  useEffect(() => {
    const inicializarSesion = async () => {
      setCargandoAuth(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUsuario(session.user);
        const ownerId = await obtenerContextoUsuario(session.user.id);
        await cargarPerfil(ownerId);
        await cargarTodo(ownerId);
      } else {
        setUsuario(null);
      }
      setCargandoAuth(false);
    };

    inicializarSesion();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUsuario(session.user);
        const ownerId = await obtenerContextoUsuario(session.user.id);
        await cargarPerfil(ownerId);
        await cargarTodo(ownerId);
      } else {
        setUsuario(null);
        setPerfil(null);
        setPropietarioId(null);
        setRolActual('admin');
        setMiembrosNegocio([]);
        setPropietarioId(null);
        setRolActual('admin');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  // La sesión se inicializa una sola vez; las suscripciones posteriores sincronizan los datos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CANAL EN TIEMPO REAL: Sincronización instantánea
  useEffect(() => {
    if (!usuario?.id) return;

    const canalSincronizacion = supabase
      .channel('sincronizacion-restopos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas', filter: `user_id=eq.${propietarioId || usuario.id}` },
        () => obtenerMesas(propietarioId || usuario.id)
      )
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
        { event: '*', schema: 'public', table: 'jornadas', filter: `user_id=eq.${propietarioId || usuario.id}` },
        async () => {
          await obtenerJornadaActiva(usuario.id);
          await obtenerVentas(propietarioId || usuario.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gastos', filter: `user_id=eq.${propietarioId || usuario.id}` },
        () => obtenerGastos(propietarioId || usuario.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalSincronizacion);
    };
  }, [usuario?.id, propietarioId]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return alert('Completa correo y contraseña');

    if (esRegistro) {
      if (!nombrePersonaInput || !nombreLocalInput || !documentoLocalInput || !direccionLocalInput || !telefonoLocalInput) {
        return alert('Por favor completa todos los campos del registro');
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
      });

      if (error) {
        alert('Error en registro: ' + error.message);
      } else if (data.user) {
        const perfilObj: Perfil = {
          id: data.user.id,
          nombre_persona: nombrePersonaInput,
          nombre_local: nombreLocalInput,
          documento: documentoLocalInput,
          direccion: direccionLocalInput,
          telefono: telefonoLocalInput,
        };

        await supabase.from('perfiles').upsert([perfilObj]);
        setPerfil(perfilObj);
        setUsuario(data.user);

        const mesasIniciales = [
          { nombre: 'Mesa 1', user_id: data.user.id, estado: 'libre' },
          { nombre: 'Mesa 2', user_id: data.user.id, estado: 'libre' },
          { nombre: 'Mesa 3', user_id: data.user.id, estado: 'libre' },
          { nombre: 'Mesa 4', user_id: data.user.id, estado: 'libre' },
          { nombre: 'Mesa 5', user_id: data.user.id, estado: 'libre' },
        ];
        await supabase.from('mesas').insert(mesasIniciales);

        setPropietarioId(data.user.id);
        setRolActual('admin');
        await cargarTodo(data.user.id);
        alert('Registro exitoso. Tu negocio fue creado con cinco mesas iniciales.');
      }
    } else {
      const correoAcceso = emailInput.includes('@')
        ? emailInput.trim()
        : `${emailInput.trim().toLowerCase()}@usuarios.restopos.app`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correoAcceso,
        password: passwordInput,
      });

      if (error) {
        alert('Error de acceso: ' + error.message);
      } else if (data.user) {
        setUsuario(data.user);
        const ownerId = await obtenerContextoUsuario(data.user.id);
        await cargarPerfil(ownerId);
        await cargarTodo(ownerId);
      }
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setPerfil(null);
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
    setEditarPerfilAbierto(true);
    setMenuUsuarioAbierto(false);
  };

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
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
    if (!nuevoMeseroUsuario.trim() || nuevoMeseroClave.length < 6) {
      return alert('Define un usuario y una clave de mínimo seis caracteres.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('La sesión no está disponible.');
    const response = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ username: nuevoMeseroUsuario, password: nuevoMeseroClave }),
    });
    const result = await response.json();
    if (!response.ok) {
      alert(result.error || 'No fue posible crear el usuario.');
      return;
    }
    setNuevoMeseroUsuario('');
    setNuevoMeseroClave('');
    await obtenerMiembrosNegocio();
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
    const { data } = await supabase.from('insumos').select('*').eq('user_id', uId).order('nombre', { ascending: true });
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

  async function obtenerMesas(uId: string) {
    const { data } = await supabase.from('mesas').select('*').eq('user_id', uId).order('nombre', { ascending: true });
    
    if (data && data.length === 0) {
      const mesasIniciales = [
        { nombre: 'Mesa 1', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 2', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 3', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 4', user_id: uId, estado: 'libre' },
        { nombre: 'Mesa 5', user_id: uId, estado: 'libre' },
      ];
      await supabase.from('mesas').insert(mesasIniciales);
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

  // Solo para la relación del cierre físico: base inicial + efectivo del turno.
  const efectivoEsperadoParaConteoCierre = baseEfectivoJornada + totalEfectivoHoy - totalGastosEfectivoHoy;

  const tarjetaSistemaNeto = totalTarjetaHoy - totalGastosTarjetaHoy;
  const transferenciaSistemaNeta = totalTransferenciaHoy - totalGastosTransferenciaHoy;
  const difEfectivo = efectivoReal !== '' ? Number(efectivoReal) - efectivoEsperadoParaConteoCierre : null;
  const difTarjeta = tarjetaReal !== '' ? Number(tarjetaReal) - tarjetaSistemaNeto : null;
  const difTransferencia = transferenciaReal !== '' ? Number(transferenciaReal) - transferenciaSistemaNeta : null;

  const seleccionarMesa = (m: Mesa) => {
    if (!cajaAbierta) return alert('Debes abrir la caja antes de iniciar el turno.');
    setMesaSeleccionada(m);
    setLineasMesa(m.pedidos || []);
    setClienteNombreMesa(m.cliente_nombre || '');
    setClienteDocMesa(m.cliente_documento || '');
    setComentarioMesa(m.comentarios || '');
  };

  const agregarMesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombreMesa.trim() || !usuario) return;
    await supabase.from('mesas').insert([{ nombre: nuevoNombreMesa, user_id: usuario.id, estado: 'libre' }]);
    setNuevoNombreMesa('');
    obtenerMesas(propietarioId || usuario.id);
  };

  const eliminarMesa = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa?')) return;
    await supabase.from('mesas').delete().eq('id', id);
    if (mesaSeleccionada?.id === id) setMesaSeleccionada(null);
    if (usuario) obtenerMesas(propietarioId || usuario.id);
  };

  const guardarPedidoMesa = async () => {
    if (!mesaSeleccionada || !usuario) return;

    const productosValidos = lineasMesa.filter((f) => f.productoId !== '');
    if (productosValidos.length === 0) return alert('Selecciona al menos un producto');

    const estado = 'ocupada';
    await supabase.from('mesas').update({ 
      pedidos: lineasMesa, 
      estado,
      cliente_nombre: clienteNombreMesa,
      cliente_documento: clienteDocMesa,
      comentarios: comentarioMesa
    }).eq('id', mesaSeleccionada.id);

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
    setMostrarModalCobro(true);
  };

  const finalizarYCobrarVenta = async () => {
    if (!mesaSeleccionada || !usuario) return;

    const productosDetalle: ProductoVenta[] = lineasMesa
      .filter((f) => f.productoId !== '')
      .map((f) => {
        const prod = productos.find((p) => p.id === f.productoId);
        return {
          nombre: prod ? prod.nombre : '',
          cantidad: f.cantidad,
          precioUnitario: prod ? prod.precio : 0,
          subtotal: prod ? prod.precio * f.cantidad : 0,
        };
      });

    const totalCalculado = productosDetalle.reduce((acc, item) => acc + item.subtotal, 0);

    if (metodoPago === 'Efectivo') {
      const pagaConNum = parseFloat(montoPagaCon) || 0;
      if (pagaConNum < totalCalculado) {
        return alert(`El monto ingresado ($${pagaConNum.toLocaleString()}) es menor al total a cobrar ($${totalCalculado.toLocaleString()})`);
      }
    }

    for (const f of lineasMesa.filter((item) => item.productoId !== '')) {
      const ingredientes = recetas.filter((r) => r.producto_id === f.productoId);
      for (const ing of ingredientes) {
        const insumoObj = insumos.find((i) => i.id === ing.insumo_id);
        if (insumoObj) {
          const consumoTotal = Number(ing.cantidad_requerida) * f.cantidad;
          const nuevoStock = Number(insumoObj.stock_actual) - consumoTotal;
          await supabase.from('insumos').update({ stock_actual: nuevoStock }).eq('id', insumoObj.id);
        }
      }
    }

    const nuevaVenta = {
      cliente: clienteNombreMesa || `Mesa: ${mesaSeleccionada.nombre}`,
      documento: clienteDocMesa || 'N/A',
      metodo_pago: metodoPago,
      productos: productosDetalle,
      total: totalCalculado,
      user_id: usuario.id,
      jornada_id: jornadaId,
    };

    const { data: ventaGuardada, error } = await supabase.from('ventas').insert([nuevaVenta]).select();

    if (error) {
      alert('Error al registrar la venta: ' + error.message);
    } else if (ventaGuardada && ventaGuardada[0]) {
      await supabase.from('mesas').update({ 
        pedidos: [], 
        estado: 'libre',
        cliente_nombre: '',
        cliente_documento: '',
        comentarios: ''
      }).eq('id', mesaSeleccionada.id);

      setVentaConfirmadaTicket(ventaGuardada[0] as Venta);
      setLineasMesa([]);
      setClienteNombreMesa('');
      setClienteDocMesa('');
      setComentarioMesa('');
      setMesaSeleccionada(null);
      setMostrarModalCobro(false);
      await cargarTodo(propietarioId || usuario.id);
    }
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
    if (!usuario) return;
    await supabase.from('insumos').insert([{ nombre: nuevoInsumoNombre, unidad: nuevoInsumoUnidad, stock_actual: parseFloat(nuevoInsumoStock), user_id: usuario.id }]);
    setNuevoInsumoNombre(''); setNuevoInsumoStock('');
    obtenerInsumos(propietarioId || usuario.id);
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

  const actualizarStockFisico = async (insumoId: string) => {
    const valor = conteosFisicos[insumoId];
    if (!valor || !usuario) return;
    await supabase.from('insumos').update({ stock_actual: parseFloat(valor) }).eq('id', insumoId);
    setConteosFisicos((prev) => ({ ...prev, [insumoId]: '' }));
    obtenerInsumos(propietarioId || usuario.id);
  };

  const formatearFecha = (fechaISO: string) => new Date(fechaISO).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const totalCalculadoMesa = lineasMesa.reduce((acc, f) => {
    const p = productos.find((prod) => prod.id === f.productoId);
    return acc + (p ? p.precio : 0) * f.cantidad;
  }, 0);

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

  if (cargandoAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h3>Cargando sistema RestoPOS...</h3>
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
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Correo Electrónico</label>
              <input
                type="email"
                placeholder="usuario@negocio.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1.5px solid #64748b', borderRadius: '8px', color: '#0f172a', fontSize: '14px', boxSizing: 'border-box' }}
                required
              />
            </div>

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
          {rolActual === 'admin' && (
            <button className={`${styles.btnModulo} ${modulo === 'produccion' ? styles.activeModulo : ''}`} onClick={() => setModulo('produccion')}>
              Producción y costos
            </button>
          )}
          <div className={styles.menuUsuario}>
            <button
              type="button"
              className={styles.btnUsuario}
              onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
              aria-expanded={menuUsuarioAbierto}
              aria-haspopup="menu"
            >
              <span className={styles.avatarUsuario}>
                {(perfil?.nombre_persona || usuario.email || 'U').charAt(0).toUpperCase()}
              </span>
              <span className={styles.identidadUsuario}>
                <strong>{perfil?.nombre_persona || 'Usuario'}</strong>
                <small>{usuario.email}</small>
              </span>
              <span className={styles.chevronUsuario}>{menuUsuarioAbierto ? '⌃' : '⌄'}</span>
            </button>

            {menuUsuarioAbierto && (
              <div className={styles.dropdownUsuario} role="menu">
                <div className={styles.encabezadoDropdown}>
                  <span className={styles.avatarGrande}>
                    {(perfil?.nombre_persona || usuario.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>{perfil?.nombre_persona || 'Usuario'}</strong>
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
                        setUsuariosAbierto(!usuariosAbierto);
                        setPersonalizacionAbierta(false);
                      }}
                      aria-expanded={usuariosAbierto}
                      role="menuitem"
                    >
                      Usuarios
                    </button>
                  )}
                </div>
                {usuariosAbierto && rolActual === 'admin' && (
                  <div className={styles.panelUsuarios}>
                    <strong>Usuarios del negocio</strong>
                    <form onSubmit={crearMesero}>
                      <input
                        value={nuevoMeseroUsuario}
                        onChange={(e) => setNuevoMeseroUsuario(e.target.value)}
                        placeholder="Usuario del mesero"
                        pattern="[A-Za-z0-9._-]+"
                        required
                      />
                      <input
                        type="password"
                        value={nuevoMeseroClave}
                        onChange={(e) => setNuevoMeseroClave(e.target.value)}
                        placeholder="Clave temporal"
                        minLength={6}
                        required
                      />
                      <button type="submit" className={styles.btnAgregarConBorde}>Crear mesero</button>
                    </form>
                    {miembrosNegocio.map((miembro) => (
                      <div key={miembro.id} className={styles.miembroUsuario}>
                        <span>{miembro.username}</span><small>{miembro.role}</small>
                      </div>
                    ))}
                  </div>
                )}
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
            <div className={styles.layoutTresColumnas}>
              <div className={styles.widgetArqueoIzquierdo}>
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
                    <div className={styles.filaResumen}><span>Efectivo:</span><strong>${totalEfectivoHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenDetalle}><span>Gastos en efectivo:</span><strong>−${totalGastosEfectivoHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenNeto}><span>Efectivo neto:</span><strong>${efectivoEsperadoParaConteoCierre.toLocaleString()}</strong></div>
                    <div className={styles.filaResumen}><span>Tarjeta:</span><strong>${totalTarjetaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenDetalle}><span>Gastos con tarjeta:</span><strong>−${totalGastosTarjetaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenNeto}><span>Tarjeta neta:</span><strong>${tarjetaSistemaNeto.toLocaleString()}</strong></div>
                    <div className={styles.filaResumen}><span>Transferencia:</span><strong>${totalTransferenciaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenDetalle}><span>Gastos por transferencia:</span><strong>−${totalGastosTransferenciaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenNeto}><span>Transferencia neta:</span><strong>${transferenciaSistemaNeta.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenTotal}><span>Total neto del turno:</span><strong>${(baseEfectivoJornada + totalHoy - (totalGastosEfectivoHoy + totalGastosTarjetaHoy + totalGastosTransferenciaHoy)).toLocaleString()}</strong></div>
                  </div>
                )}
              </div>

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
                <div className={styles.cardMetrica}><span>Efectivo</span><h3 style={{ color: '#16a34a' }}>${efectivoEsperadoParaConteoCierre.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Tarjeta</span><h3 style={{ color: '#9333ea' }}>${tarjetaSistemaNeto.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Transferencia</span><h3 style={{ color: '#ea580c' }}>${transferenciaSistemaNeta.toLocaleString()}</h3></div>
              </div>
              <div className={styles.resumenGastosCierre}>
                <strong>Gastos descontados del turno</strong>
                <span>Efectivo: −${totalGastosEfectivoHoy.toLocaleString()}</span>
                <span>Tarjeta: −${totalGastosTarjetaHoy.toLocaleString()}</span>
                <span>Transferencia: −${totalGastosTransferenciaHoy.toLocaleString()}</span>
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
            <button className={subPestanaProduccion === 'recetas' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('recetas')}>Recetas y costos</button>
            <button className={subPestanaProduccion === 'productos' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('productos')}>Productos y precios</button>
          </div>

          {/* INVENTARIO */}
          {subPestanaProduccion === 'inventario' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={guardarInsumo} className={styles.formStandard}>
                <h3>Registrar materia prima</h3>
                <div className={styles.grid3Campos}>
                  <input type="text" placeholder="Nombre insumo" value={nuevoInsumoNombre} onChange={(e) => setNuevoInsumoNombre(e.target.value)} required />
                  <select value={nuevoInsumoUnidad} onChange={(e) => setNuevoInsumoUnidad(e.target.value)}>
                    <option value="g">Gramos (g)</option><option value="kg">Kilos (kg)</option><option value="ml">Ml</option><option value="unidades">Unidades</option>
                  </select>
                  <input type="number" placeholder="Stock inicial" value={nuevoInsumoStock} onChange={(e) => setNuevoInsumoStock(e.target.value)} required />
                </div>
                <button type="submit" className={styles.btnAgregarConBorde}>Guardar Insumo</button>
              </form>

              <div className={styles.tablaResponsiveContainer}>
                <table className={styles.tablaApp}>
                  <thead>
                    <tr><th>Insumo</th><th>Stock Teórico</th><th>Conteo Físico Real</th><th>Acción</th></tr>
                  </thead>
                  <tbody>
                    {insumos.map((i) => (
                      <tr key={i.id}>
                        <td><strong>{i.nombre}</strong></td>
                        <td>{i.stock_actual} {i.unidad}</td>
                        <td>
                          <input type="number" placeholder="Real" className={styles.cantInput} value={conteosFisicos[i.id] || ''} onChange={(e) => setConteosFisicos({ ...conteosFisicos, [i.id]: e.target.value })} />
                        </td>
                        <td><button onClick={() => actualizarStockFisico(i.id)} className={styles.btnVerConBorde}>Rectificar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      {editarPerfilAbierto && (
        <div className={styles.overlayModal} onClick={() => setEditarPerfilAbierto(false)}>
          <form className={styles.modalContent} onClick={(e) => e.stopPropagation()} onSubmit={guardarPerfil}>
            <h2>Editar información</h2>
            <div className={styles.grid2Campos}>
              <label>Nombre<input value={perfilEditando.nombre_persona} onChange={(e) => setPerfilEditando({ ...perfilEditando, nombre_persona: e.target.value })} required /></label>
              <label>Negocio<input value={perfilEditando.nombre_local} onChange={(e) => setPerfilEditando({ ...perfilEditando, nombre_local: e.target.value })} required /></label>
              <label>Documento<input value={perfilEditando.documento} onChange={(e) => setPerfilEditando({ ...perfilEditando, documento: e.target.value })} required /></label>
              <label>Teléfono<input value={perfilEditando.telefono} onChange={(e) => setPerfilEditando({ ...perfilEditando, telefono: e.target.value })} required /></label>
              <label style={{ gridColumn: '1 / -1' }}>Dirección<input value={perfilEditando.direccion} onChange={(e) => setPerfilEditando({ ...perfilEditando, direccion: e.target.value })} required /></label>
            </div>
            <div className={styles.accionesModal}>
              <button type="submit" className={styles.btnAgregarConBorde}>Guardar información</button>
              <button type="button" className={styles.btnEliminarConBorde} onClick={() => setEditarPerfilAbierto(false)}>Cancelar</button>
            </div>
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
                <button onClick={finalizarYCobrarVenta} className={styles.btnCobrar} style={{ width: '100%', fontSize: '16px' }}>
                  Finalizar y registrar venta
                </button>
                <button onClick={() => setMostrarModalCobro(false)} className={styles.btnEliminarConBorde} style={{ width: '100%' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET CONFIRMADO PARA IMPRESIÓN */}
      {(ventaConfirmadaTicket || ventaSeleccionada) && (
        <div className={styles.overlayModal} onClick={() => { setVentaConfirmadaTicket(null); setVentaSeleccionada(null); }}>
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
              <button onClick={() => { window.print(); setVentaConfirmadaTicket(null); setVentaSeleccionada(null); }} className={styles.btnCobrar} style={{ flex: 1 }}>
                Imprimir ticket
              </button>
              <button onClick={() => { setVentaConfirmadaTicket(null); setVentaSeleccionada(null); }} className={styles.btnAgregarConBorde}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}