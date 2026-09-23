'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

// ----------------------------------------------------------------------
// INTERFACES / TIPOS
// ----------------------------------------------------------------------
interface RecetaIngrediente {
  ingrediente_id: string;
  cantidad: number;
}

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  receta?: RecetaIngrediente[];
}

interface ItemPedido {
  producto: Producto;
  cantidad: number;
  notas?: string;
  agregados?: { ingrediente_id: string; nombre: string; precio: number; cantidad: number }[];
}

interface Pedido {
  id: string;
  mesa: string;
  cliente: string;
  items: ItemPedido[];
  total: number;
  estado: 'Pendiente' | 'En Preparación' | 'Servido' | 'Pagado' | 'Cancelado';
  metodo_pago?: string;
  created_at: string;
}

interface Ingrediente {
  id: string;
  nombre: string;
  unidad: string;
  costo_unidad: number;
  stock_actual: number;
  minimo_alerta: number;
}

interface Venta {
  id: string;
  created_at: string;
  cliente: string;
  metodo_pago: string;
  total: number;
  descuento?: number;
  propina?: number;
  items: ItemPedido[];
  jornada_id?: string;
  cierre_id?: string;
}

interface CierreCaja {
  id: string;
  fecha: string;
  base_inicial: number;
  total_ventas: number;
  efectivo_sistema: number;
  tarjeta_sistema: number;
  transferencia_sistema: number;
  efectivo_real: number;
  tarjeta_real: number;
  transferencia_real: number;
  diferencia_total: number;
}

export default function Home() {
  // --------------------------------------------------------------------
  // ESTADOS PRINCIPALES DE NAVEGACIÓN
  // --------------------------------------------------------------------
  const [pestanaPrincipal, setPestanaPrincipal] = useState<'ventas' | 'produccion' | 'salir'>('ventas');
  const [subPestanaVentas, setSubPestanaVentas] = useState<'mesas' | 'caja' | 'historiales'>('mesas');
  const [subPestanaProduccion, setSubPestanaProduccion] = useState<'cocina' | 'recetas' | 'inventario' | 'compras'>('cocina');
  const [subPestanaHistoriales, setSubPestanaHistoriales] = useState<'ventas' | 'arqueos'>('ventas');

  // --------------------------------------------------------------------
  // ESTADOS DE DATOS (PRODUCTOS, PEDIDOS, INVENTARIO, VENTAS, JORNADA)
  // --------------------------------------------------------------------
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  // Estado de la jornada activa (Caja / Turno)
  const [jornadaId, setJornadaId] = useState<string | null>(null);
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(false);
  const [baseEfectivoJornada, setBaseEfectivoJornada] = useState<number>(0);
  const [montoBaseInput, setMontoBaseInput] = useState<string>('');

  // --------------------------------------------------------------------
  // ESTADOS DE FORMULARIOS Y SELECCIÓN
  // --------------------------------------------------------------------
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>('Mesa 1');
  const [clienteNombre, setClienteNombre] = useState<string>('');
  const [carrito, setCarrito] = useState<ItemPedido[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Todas');

  // Modal de Detalle / Edición de Producto en el Pedido
  const [productoEdicion, setProductoEdicion] = useState<Producto | null>(null);
  const [cantidadEdicion, setCantidadEdicion] = useState<number>(1);
  const [notasEdicion, setNotasEdicion] = useState<string>('');
  const [agregadosEdicion, setAgregadosEdicion] = useState<{ [ingredienteId: string]: number }>({});

  // Modal de Cobro / Pago
  const [pedidoACobrar, setPedidoACobrar] = useState<Pedido | null>(null);
  const [metodoPago, setMetodoPago] = useState<string>('Efectivo');
  const [montoEfectivoCliente, setMontoEfectivoCliente] = useState<string>('');
  const [descuentoMonto, setDescuentoMonto] = useState<number>(0);
  const [propinaMonto, setPropinaMonto] = useState<number>(0);

  // Arqueo / Cierre de Caja Físico
  const [efectivoReal, setEfectivoReal] = useState<string>('');
  const [tarjetaReal, setTarjetaReal] = useState<string>('');
  const [transferenciaReal, setTransferenciaReal] = useState<string>('');

  // Filtros de Historiales y Vistas
  const [cierreFiltroSeleccionado, setCierreFiltroSeleccionado] = useState<string>('abierta');
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);

  // Referencia para impresión o tickets
  const ticketRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------------------------
  // EFECTOS INICIALES Y CARGA DE DATOS DESDE SUPABASE
  // --------------------------------------------------------------------
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      // 1. Cargar Productos
      const { data: prodData } = await supabase.from('productos').select('*');
      if (prodData) setProductos(prodData);

      // 2. Cargar Pedidos Activos
      const { data: pedData } = await supabase
        .from('pedidos')
        .select('*')
        .neq('estado', 'Pagado')
        .neq('estado', 'Cancelado')
        .order('created_at', { ascending: true });
      if (pedData) setPedidos(pedData);

      // 3. Cargar Ingredientes / Inventario
      const { data: ingData } = await supabase.from('ingredientes').select('*').order('nombre');
      if (ingData) setIngredientes(ingData);

      // 4. Cargar Historial de Ventas
      const { data: ventData } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
      if (ventData) setVentas(ventData);

      // 5. Cargar Cierres de Caja
      const { data: cierresData } = await supabase.from('cierres_caja').select('*').order('fecha', { ascending: false });
      if (cierresData) setCierres(cierresData);

      // 6. Verificar si existe una Jornada/Caja Abierta
      const { data: jornadaData } = await supabase
        .from('jornadas')
        .select('*')
        .eq('estado', 'Abierta')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (jornadaData) {
        setJornadaId(jornadaData.id);
        setCajaAbierta(true);
        setBaseEfectivoJornada(jornadaData.base_inicial || 0);
      } else {
        setJornadaId(null);
        setCajaAbierta(false);
        setBaseEfectivoJornada(0);
      }
    } catch (err) {
      console.error('Error al cargar datos desde Supabase:', err);
    }
  };

  // --------------------------------------------------------------------
  // MANEJO DE CAJA / JORNADAS
  // --------------------------------------------------------------------
  const abrirCajaJornada = async () => {
    const baseNum = parseFloat(montoBaseInput) || 0;
    try {
      const { data, error } = await supabase
        .from('jornadas')
        .insert([{ base_inicial: baseNum, estado: 'Abierta' }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setJornadaId(data.id);
        setCajaAbierta(true);
        setBaseEfectivoJornada(baseNum);
        setMontoBaseInput('');
        alert(`🎉 ¡Caja abierta exitosamente con una base de $${baseNum.toLocaleString()}!`);
      }
    } catch (err) {
      console.error('Error al abrir la caja:', err);
      alert('Ocurrió un error al abrir la caja en Supabase.');
    }
  };

  // --------------------------------------------------------------------
  // MANEJO DE CARRITO Y PEDIDOS
  // --------------------------------------------------------------------
  const abrirModalProducto = (p: Producto) => {
    setProductoEdicion(p);
    setCantidadEdicion(1);
    setNotasEdicion('');
    setAgregadosEdicion({});
  };

  const agregarAlCarrito = () => {
    if (!productoEdicion) return;

    const listaAgregados = Object.entries(agregadosEdicion)
      .filter(([_, cant]) => cant > 0)
      .map(([ingId, cant]) => {
        const ing = ingredientes.find((i) => i.id === ingId);
        return {
          ingrediente_id: ingId,
          nombre: ing ? ing.nombre : 'Agregado',
          precio: ing ? ing.costo_unidad * 1.5 : 0, // Cálculo de precio público del agregado
          cantidad: cant,
        };
      });

    const nuevoItem: ItemPedido = {
      producto: productoEdicion,
      cantidad: cantidadEdicion,
      notas: notasEdicion,
      agregados: listaAgregados.length > 0 ? listaAgregados : undefined,
    };

    setCarrito((prev) => [...prev, nuevoItem]);
    setProductoEdicion(null);
  };

  const eliminarDelCarrito = (idx: number) => {
    setCarrito((prev) => prev.filter((_, i) => i !== idx));
  };

  const calcularSubtotalItem = (item: ItemPedido) => {
    const costoAgregados = item.agregados
      ? item.agregados.reduce((sum, a) => sum + a.precio * a.cantidad, 0)
      : 0;
    return (item.producto.precio + costoAgregados) * item.cantidad;
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + calcularSubtotalItem(item), 0);

  const enviarPedidoACocina = async () => {
    if (carrito.length === 0) {
      alert('Añade al menos un producto al pedido.');
      return;
    }

    try {
      const nuevoPedido = {
        mesa: mesaSeleccionada,
        cliente: clienteNombre.trim() || 'Cliente General',
        items: carrito,
        total: totalCarrito,
        estado: 'Pendiente',
      };

      const { data, error } = await supabase.from('pedidos').insert([nuevoPedido]).select().single();

      if (error) throw error;

      if (data) {
        setPedidos((prev) => [...prev, data]);
        setCarrito([]);
        setClienteNombre('');
        alert(`✅ Pedido enviado a cocina para la ${mesaSeleccionada}.`);
      }
    } catch (err) {
      console.error('Error al enviar pedido:', err);
      alert('Error al guardar el pedido.');
    }
  };

  const cambiarEstadoPedido = async (id: string, nuevoEstado: Pedido['estado']) => {
    try {
      const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id);
      if (error) throw error;

      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: nuevoEstado } : p)));
    } catch (err) {
      console.error('Error al cambiar estado:', err);
    }
  };

  // --------------------------------------------------------------------
  // PROCESO DE COBRO Y REGISTRO DE VENTA
  // --------------------------------------------------------------------
  const procesarCobroVenta = async () => {
    if (!pedidoACobrar) return;

    if (!cajaAbierta) {
      alert('⚠️ Debes abrir la caja antes de poder registrar cobros.');
      return;
    }

    const totalFinal = Math.max(0, pedidoACobrar.total - descuentoMonto + propinaMonto);

    try {
      // 1. Guardar la Venta en la Base de Datos asociando la jornada activa
      const nuevaVenta = {
        cliente: pedidoACobrar.cliente,
        metodo_pago: metodoPago,
        total: totalFinal,
        descuento: descuentoMonto,
        propina: propinaMonto,
        items: pedidoACobrar.items,
        jornada_id: jornadaId,
      };

      const { data: ventaGuardada, error: errVenta } = await supabase
        .from('ventas')
        .insert([nuevaVenta])
        .select()
        .single();

      if (errVenta) throw errVenta;

      // 2. Marcar Pedido como Pagado
      await supabase.from('pedidos').update({ estado: 'Pagado', metodo_pago: metodoPago }).eq('id', pedidoACobrar.id);

      // 3. Descontar Inventario automáticamente según las recetas de la venta
      for (const item of pedidoACobrar.items) {
        if (item.producto.receta) {
          for (const ingReceta of item.producto.receta) {
            const ingActual = ingredientes.find((i) => i.id === ingReceta.ingrediente_id);
            if (ingActual) {
              const nuevoStock = Math.max(0, ingActual.stock_actual - ingReceta.cantidad * item.cantidad);
              await supabase.from('ingredientes').update({ stock_actual: nuevoStock }).eq('id', ingActual.id);
            }
          }
        }
      }

      // Actualizar estados locales
      if (ventaGuardada) setVentas((prev) => [ventaGuardada, ...prev]);
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoACobrar.id));
      setPedidoACobrar(null);
      setMontoEfectivoCliente('');
      setDescuentoMonto(0);
      setPropinaMonto(0);

      alert('💸 ¡Venta procesada con éxito y stock actualizado!');
      cargarDatos(); // Recargar datos frescos
    } catch (err) {
      console.error('Error al procesar la venta:', err);
      alert('Error al completar el cobro.');
    }
  };

  // --------------------------------------------------------------------
  // CÁLCULOS DE JORNADA / CAJA ACTUAL Y CIERRE
  // --------------------------------------------------------------------
  const ventasJornadaActual = ventas.filter(
    (v) => (jornadaId && v.jornada_id === jornadaId) || (!v.cierre_id && cajaAbierta)
  );

  const totalEfectivoHoy = ventasJornadaActual
    .filter((v) => v.metodo_pago === 'Efectivo')
    .reduce((sum, v) => sum + v.total, 0);

  const totalTarjetaHoy = ventasJornadaActual
    .filter((v) => v.metodo_pago === 'Tarjeta')
    .reduce((sum, v) => sum + v.total, 0);

  const totalTransferenciaHoy = ventasJornadaActual
    .filter((v) => v.metodo_pago === 'Transferencia')
    .reduce((sum, v) => sum + v.total, 0);

  const totalVentasJornada = totalEfectivoHoy + totalTarjetaHoy + totalTransferenciaHoy;

  // Cálculos de diferencias de arqueo
  const numEfectivoReal = parseFloat(efectivoReal) || 0;
  const numTarjetaReal = parseFloat(tarjetaReal) || 0;
  const numTransferenciaReal = parseFloat(transferenciaReal) || 0;

  const difEfectivo = efectivoReal !== '' ? numEfectivoReal - (baseEfectivoJornada + totalEfectivoHoy) : null;
  const difTarjeta = tarjetaReal !== '' ? numTarjetaReal - totalTarjetaHoy : null;
  const difTransferencia = transferenciaReal !== '' ? numTransferenciaReal - totalTransferenciaHoy : null;

  const realizarCierreCaja = async () => {
    if (!cajaAbierta || !jornadaId) {
      alert('No hay ninguna caja abierta actualmente.');
      return;
    }

    if (efectivoReal === '' || tarjetaReal === '' || transferenciaReal === '') {
      alert('Por favor completa el conteo físico real para todos los métodos de pago.');
      return;
    }

    const difTotal = (difEfectivo || 0) + (difTarjeta || 0) + (difTransferencia || 0);

    try {
      // 1. Guardar Registro de Cierre
      const nuevoCierre = {
        base_inicial: baseEfectivoJornada,
        total_ventas: totalVentasJornada,
        efectivo_sistema: totalEfectivoHoy,
        tarjeta_sistema: totalTarjetaHoy,
        transferencia_sistema: totalTransferenciaHoy,
        efectivo_real: numEfectivoReal,
        tarjeta_real: numTarjetaReal,
        transferencia_real: numTransferenciaReal,
        diferencia_total: difTotal,
        fecha: new Date().toISOString(),
      };

      const { data: cierreGuardado, error: errCierre } = await supabase
        .from('cierres_caja')
        .insert([nuevoCierre])
        .select()
        .single();

      if (errCierre) throw errCierre;

      // 2. Asociar el `cierre_id` a todas las ventas pertenecientes a este turno
      if (cierreGuardado) {
        for (const v of ventasJornadaActual) {
          await supabase.from('ventas').update({ cierre_id: cierreGuardado.id }).eq('id', v.id);
        }
      }

      // 3. Cerrar la Jornada Activa
      await supabase.from('jornadas').update({ estado: 'Cerrada' }).eq('id', jornadaId);

      alert('🔒 Cierre de caja guardado con éxito. Se ha finalizado la jornada.');
      setEfectivoReal('');
      setTarjetaReal('');
      setTransferenciaReal('');
      cargarDatos();
    } catch (err) {
      console.error('Error al realizar el cierre:', err);
      alert('Error al guardar el cierre de caja.');
    }
  };

  // --------------------------------------------------------------------
  // FILTRADO DE HISTORIAL DE VENTAS
  // --------------------------------------------------------------------
  const arqueoSeleccionado = cierres.find((c) => String(c.id) === String(cierreFiltroSeleccionado));

  const ventasFiltradasHistorial =
    cierreFiltroSeleccionado === 'abierta'
      ? ventas.filter((v) => (!v.cierre_id || v.cierre_id === null) && String(v.jornada_id) === String(jornadaId))
      : ventas.filter((v) => {
          if (!cierreFiltroSeleccionado || !arqueoSeleccionado) return false;

          // 1. Coincidencia directa por cierre_id
          if (v.cierre_id && String(v.cierre_id) === String(cierreFiltroSeleccionado)) {
            return true;
          }

          // 2. Coincidencia por jornada_id
          if (v.jornada_id && String(v.jornada_id) === String(arqueoSeleccionado.id)) {
            return true;
          }

          // 3. Rescate por ventana de tiempo (ventas en las 24 hrs previas a la hora del cierre)
          const fechaVenta = new Date(v.created_at).valueOf();
          const fechaCierre = new Date(arqueoSeleccionado.fecha).valueOf();
          const difHoras = (fechaCierre - fechaVenta) / (1000 * 60 * 60);

          return !v.cierre_id && difHoras >= 0 && difHoras <= 24;
        });

  // Categorías Únicas
  const categorias = ['Todas', ...Array.from(new Set(productos.map((p) => p.categoria)))];

  const formatearFecha = (fechaStr: string) => {
    return new Date(fechaStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --------------------------------------------------------------------
  // RENDER PRINCIPAL DE LA APLICACIÓN
  // --------------------------------------------------------------------
  return (
    <div className={styles.contenedorApp}>
      {/* NAVEGACIÓN SUPERIOR / NAVBAR */}
      <header className={styles.navbarHeader}>
        <div className={styles.brandTitle}>
          <span>🥙</span> Arepa Secreta
        </div>

        <nav className={styles.navModulos}>
          <button
            className={pestanaPrincipal === 'ventas' ? styles.btnNavActivo : styles.btnNav}
            onClick={() => setPestanaPrincipal('ventas')}
          >
            📊 Ventas y Caja
          </button>
          <button
            className={pestanaPrincipal === 'produccion' ? styles.btnNavActivo : styles.btnNav}
            onClick={() => setPestanaPrincipal('produccion')}
          >
            📦 Producción y Costes
          </button>
          <button
            className={styles.btnSalir}
            onClick={() => alert('Sesión finalizada.')}
          >
            🚪 Salir (allantorres247)
          </button>
        </nav>
      </header>

      {/* SUB-NAVEGACIÓN MÓDULO DE VENTAS */}
      {pestanaPrincipal === 'ventas' && (
        <div className={styles.subBarraPestanas}>
          <button
            className={subPestanaVentas === 'mesas' ? styles.subBtnActivo : styles.subBtn}
            onClick={() => setSubPestanaVentas('mesas')}
          >
            🍽️ Mesas y Pedidos
          </button>
          <button
            className={subPestanaVentas === 'caja' ? styles.subBtnActivo : styles.subBtn}
            onClick={() => setSubPestanaVentas('caja')}
          >
            💰 Cierre de Caja
          </button>
          <button
            className={subPestanaVentas === 'historiales' ? styles.subBtnActivo : styles.subBtn}
            onClick={() => setSubPestanaVentas('historiales')}
          >
            📋 Historiales
          </button>
        </div>
      )}

      {/* SUB-NAVEGACIÓN MÓDULO DE PRODUCCIÓN */}
      {pestanaPrincipal === 'produccion' && (
        <div className={styles.subBarraPestanas}>
          <button
            className={subPestanaProduccion === 'cocina' ? styles.subBtnActivo : styles.subBtn}
            onClick={() => setSubPestanaProduccion('cocina')}
          >
            👨‍🍳 Pantalla de Cocina
          </button>
          <button
            className={subPestanaProduccion === 'recetas' ? styles.subBtnActivo : styles.subBtn}
            onClick={() => setSubPestanaProduccion('recetas')}
          >
            📖 Recetas / Costos
          </button>
          <button
            className={subPestanaProduccion === 'inventario' ? styles.subBtnActivo : styles.subBtn}
            onClick={() => setSubPestanaProduccion('inventario')}
          >
            🥦 Inventario
          </button>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className={styles.mainLayout}>
        {/* ==================================================================== */}
        {/* VISTA 1: MESAS Y PEDIDOS (POS) */}
        {/* ==================================================================== */}
        {pestanaPrincipal === 'ventas' && subPestanaVentas === 'mesas' && (
          <div className={styles.gridPosContainer}>
            {/* PANEL IZQUIERDO: SELECCIÓN Y MENÚ DE PRODUCTOS */}
            <div className={styles.panelProductos}>
              <div className={styles.selectorMesaBox}>
                <label>📍 Seleccionar Mesa / Para Llevar:</label>
                <div className={styles.gridBotonesMesas}>
                  {['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Para Llevar', 'Domicilio'].map((m) => (
                    <button
                      key={m}
                      className={mesaSeleccionada === m ? styles.btnMesaActiva : styles.btnMesa}
                      onClick={() => setMesaSeleccionada(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* BARRA DE CATEGORÍAS */}
              <div className={styles.barCategorias}>
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    className={categoriaActiva === cat ? styles.btnCatActiva : styles.btnCat}
                    onClick={() => setCategoriaActiva(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* GRID DE PRODUCTOS */}
              <div className={styles.gridProductosCards}>
                {productos
                  .filter((p) => categoriaActiva === 'Todas' || p.categoria === categoriaActiva)
                  .map((p) => (
                    <div key={p.id} className={styles.cardProducto} onClick={() => abrirModalProducto(p)}>
                      <h4>{p.nombre}</h4>
                      <span className={styles.tagCategoria}>{p.categoria}</span>
                      <div className={styles.precioCard}>${p.precio.toLocaleString()}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* PANEL DERECHO: DETALLE DEL PEDIDO Y COBRO */}
            <div className={styles.panelCarrito}>
              <h3>🧾 Pedido Actual ({mesaSeleccionada})</h3>

              <div className={styles.inputNombreCliente}>
                <input
                  type="text"
                  placeholder="Nombre del Cliente (Opcional)"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                />
              </div>

              <div className={styles.listaItemsCarrito}>
                {carrito.length === 0 ? (
                  <p className={styles.emptyCartMsg}>Selecciona productos del menú para agregar al pedido.</p>
                ) : (
                  carrito.map((item, idx) => (
                    <div key={idx} className={styles.itemCarritoCard}>
                      <div className={styles.infoItem}>
                        <strong>
                          {item.cantidad}x {item.producto.nombre}
                        </strong>
                        <span className={styles.subtotalItem}>${calcularSubtotalItem(item).toLocaleString()}</span>
                      </div>
                      {item.notas && <p className={styles.notasItemText}>📝 {item.notas}</p>}
                      {item.agregados && item.agregados.length > 0 && (
                        <div className={styles.agregadosListText}>
                          {item.agregados.map((a) => (
                            <span key={a.ingrediente_id}>
                              + {a.cantidad} {a.nombre} (${(a.precio * a.cantidad).toLocaleString()})
                            </span>
                          ))}
                        </div>
                      )}
                      <button className={styles.btnQuitarItem} onClick={() => eliminarDelCarrito(idx)}>
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.footerCarrito}>
                <div className={styles.filaTotal}>
                  <span>Total:</span>
                  <h2>${totalCarrito.toLocaleString()}</h2>
                </div>
                <button className={styles.btnEnviarCocina} onClick={enviarPedidoACocina} disabled={carrito.length === 0}>
                  🔥 ENVIAR A COCINA
                </button>
              </div>

              {/* LISTA DE PEDIDOS PENDIENTES DE COBRO */}
              <div className={styles.seccionPedidosActivos}>
                <h4>⏳ Pedidos por Cobrar</h4>
                {pedidos.map((ped) => (
                  <div key={ped.id} className={styles.cardPedidoActivo}>
                    <div>
                      <strong>
                        {ped.mesa} - {ped.cliente}
                      </strong>
                      <span className={styles.badgeEstado}>{ped.estado}</span>
                      <div>${ped.total.toLocaleString()}</div>
                    </div>
                    <button
                      className={styles.btnCobrarPequeno}
                      onClick={() => {
                        setPedidoACobrar(ped);
                        setMontoEfectivoCliente(String(ped.total));
                      }}
                    >
                      💳 Cobrar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VISTA 2: CIERRE DE CAJA Y ARQUEO DE TURNO */}
        {/* ==================================================================== */}
        {pestanaPrincipal === 'ventas' && subPestanaVentas === 'caja' && (
          <div className={styles.seccionCaja}>
            <h2>Control y Cierre de Arqueo (Turno Activo)</h2>

            {!cajaAbierta ? (
              <div className={styles.cardAbrirCaja}>
                <h3>⚠️ La caja está actualmente CERRADA</h3>
                <p>Ingresa el monto de la base inicial en efectivo para iniciar el turno de ventas:</p>
                <div className={styles.rowAbrirCaja}>
                  <input
                    type="number"
                    placeholder="Monto Base (Ej: 1000)"
                    value={montoBaseInput}
                    onChange={(e) => setMontoBaseInput(e.target.value)}
                  />
                  <button className={styles.btnAbrirCajaAccion} onClick={abrirCajaJornada}>
                    🚀 ABRIR CAJA Y EMPEZAR TURNO
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* TARJETAS DE MÉTRICAS */}
                <div className={styles.gridMetricasCaja}>
                  <div className={styles.cardMetrica}>
                    <span>Base del Turno</span>
                    <h3>${baseEfectivoJornada.toLocaleString()}</h3>
                  </div>
                  <div className={styles.cardMetrica}>
                    <span>Efectivo del Turno</span>
                    <h3 style={{ color: '#16a34a' }}>${totalEfectivoHoy.toLocaleString()}</h3>
                  </div>
                  <div className={styles.cardMetrica}>
                    <span>Tarjetas Turno</span>
                    <h3 style={{ color: '#9333ea' }}>${totalTarjetaHoy.toLocaleString()}</h3>
                  </div>
                  <div className={styles.cardMetrica}>
                    <span>Transferencias Turno</span>
                    <h3 style={{ color: '#ea580c' }}>${totalTransferenciaHoy.toLocaleString()}</h3>
                  </div>
                </div>

                {/* SECCIÓN DE CONTEO Y ARQUEO */}
                <div className={styles.formArqueoCaja}>
                  <h3>Ingresar Conteo Físico Real del Turno</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '-8px', marginBottom: '16px' }}>
                    Nota: El <strong>Efectivo Esperado en Caja</strong> para este cierre es de{' '}
                    <strong style={{ color: '#0f172a' }}>
                      ${(baseEfectivoJornada + totalEfectivoHoy).toLocaleString()}
                    </strong>{' '}
                    (Base Inicial ${baseEfectivoJornada.toLocaleString()} + Efectivo del Turno $
                    {totalEfectivoHoy.toLocaleString()}).
                  </p>

                  <div className={styles.gridArqueoInputs}>
                    <div>
                      <label>💵 Efectivo Físico (Incluyendo Base)</label>
                      <input
                        type="number"
                        placeholder="Monto real en caja"
                        value={efectivoReal}
                        onChange={(e) => setEfectivoReal(e.target.value)}
                      />
                      {difEfectivo !== null && (
                        <span className={difEfectivo < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                          {difEfectivo === 0
                            ? '✅ Cuadre exacto'
                            : difEfectivo < 0
                            ? `⚠️ Falta: $${difEfectivo.toLocaleString()}`
                            : `➕ Sobra: +$${difEfectivo.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                    <div>
                      <label>💳 Tarjetas Físico</label>
                      <input
                        type="number"
                        placeholder="Monto real tarjetas"
                        value={tarjetaReal}
                        onChange={(e) => setTarjetaReal(e.target.value)}
                      />
                      {difTarjeta !== null && (
                        <span className={difTarjeta < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                          {difTarjeta === 0
                            ? '✅ Cuadre exacto'
                            : difTarjeta < 0
                            ? `⚠️ Falta: $${difTarjeta.toLocaleString()}`
                            : `➕ Sobra: +$${difTarjeta.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                    <div>
                      <label>📲 Transferencias Físico</label>
                      <input
                        type="number"
                        placeholder="Monto real transferencias"
                        value={transferenciaReal}
                        onChange={(e) => setTransferenciaReal(e.target.value)}
                      />
                      {difTransferencia !== null && (
                        <span
                          className={difTransferencia < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}
                        >
                          {difTransferencia === 0
                            ? '✅ Cuadre exacto'
                            : difTransferencia < 0
                            ? `⚠️ Falta: $${difTransferencia.toLocaleString()}`
                            : `➕ Sobra: +$${difTransferencia.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <button className={styles.btnCierreAccion} onClick={realizarCierreCaja}>
                    🔒 CERRAR Y GUARDAR ARQUEO DE TURNO
                  </button>
                </div>

                {/* VENTAS REGISTRADAS EN EL TURNO ACTIVO */}
                <div style={{ marginTop: '28px' }}>
                  <h3>Ventas del Turno Activo ({ventasJornadaActual.length})</h3>
                  <div className={styles.tablaResponsiveContainer}>
                    <table className={styles.tablaApp}>
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Cliente</th>
                          <th>Método</th>
                          <th>Total</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventasJornadaActual.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                              No hay ventas registradas en el turno actual.
                            </td>
                          </tr>
                        ) : (
                          ventasJornadaActual.map((v) => (
                            <tr key={v.id}>
                              <td>{formatearFecha(v.created_at)}</td>
                              <td>{v.cliente}</td>
                              <td>{v.metodo_pago}</td>
                              <td>
                                <strong>${v.total.toLocaleString()}</strong>
                              </td>
                              <td>
                                <button onClick={() => setVentaSeleccionada(v)} className={styles.btnVerConBorde}>
                                  👁️ Detalle
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VISTA 3: HISTORIALES DE VENTAS Y ARQUEOS */}
        {/* ==================================================================== */}
        {pestanaPrincipal === 'ventas' && subPestanaVentas === 'historiales' && (
          <div className={styles.seccionHistoriales}>
            <div className={styles.subSubBarra}>
              <button
                className={subPestanaHistoriales === 'ventas' ? styles.btnSubSubActivo : styles.btnSubSub}
                onClick={() => setSubPestanaHistoriales('ventas')}
              >
                Historial de Ventas por Arqueo
              </button>
              <button
                className={subPestanaHistoriales === 'arqueos' ? styles.btnSubSubActivo : styles.btnSubSub}
                onClick={() => setSubPestanaHistoriales('arqueos')}
              >
                Historial de Arqueos / Turnos
              </button>
            </div>

            {subPestanaHistoriales === 'ventas' && (
              <div>
                <div className={styles.selectorArqueoFiltro}>
                  <label>
                    <strong>Seleccionar Arqueo / Turno para ver detalle:</strong>
                  </label>
                  <select
                    value={cierreFiltroSeleccionado}
                    onChange={(e) => setCierreFiltroSeleccionado(e.target.value)}
                  >
                    <option value="abierta">🔓 Turno Actual Activo (En Curso)</option>
                    {cierres.map((c) => (
                      <option key={c.id} value={c.id}>
                        🔒 Arqueo del {new Date(c.fecha).toLocaleDateString()} - Total: ${c.total_ventas.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TABLA DE VENTAS FILTRADAS */}
                <div className={styles.tablaResponsiveContainer}>
                  <h4>Ventas registradas en este arqueo ({ventasFiltradasHistorial.length})</h4>
                  <table className={styles.tablaApp}>
                    <thead>
                      <tr>
                        <th>Hora/Fecha</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th>Total</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasFiltradasHistorial.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                            No se encontraron ventas asociadas a este arqueo seleccionado.
                          </td>
                        </tr>
                      ) : (
                        ventasFiltradasHistorial.map((v) => (
                          <tr key={v.id}>
                            <td>
                              {new Date(v.created_at).toLocaleDateString()} {formatearFecha(v.created_at)}
                            </td>
                            <td>{v.cliente}</td>
                            <td>{v.metodo_pago}</td>
                            <td>
                              <strong>${v.total.toLocaleString()}</strong>
                            </td>
                            <td>
                              <button className={styles.btnVerConBorde} onClick={() => setVentaSeleccionada(v)}>
                                📄 Ticket / Detalle
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {subPestanaHistoriales === 'arqueos' && (
              <div className={styles.tablaResponsiveContainer}>
                <h3>Registro de Cierres de Caja Guardados</h3>
                <table className={styles.tablaApp}>
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Base</th>
                      <th>Ventas Sistema</th>
                      <th>Total Real</th>
                      <th>Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cierres.map((c) => (
                      <tr key={c.id}>
                        <td>{new Date(c.fecha).toLocaleString()}</td>
                        <td>${c.base_inicial.toLocaleString()}</td>
                        <td>${c.total_ventas.toLocaleString()}</td>
                        <td>
                          ${(c.efectivo_real + c.tarjeta_real + c.transferencia_real).toLocaleString()}
                        </td>
                        <td style={{ color: c.diferencia_total < 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                          ${c.diferencia_total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VISTA 4: PANTALLA DE COCINA (KITCHEN DISPLAY SYSTEM) */}
        {/* ==================================================================== */}
        {pestanaPrincipal === 'produccion' && subPestanaProduccion === 'cocina' && (
          <div className={styles.gridCocina}>
            {pedidos.map((ped) => (
              <div key={ped.id} className={styles.cardCocina}>
                <div className={styles.headerCardCocina}>
                  <h3>{ped.mesa}</h3>
                  <span className={styles.timeCocina}>{formatearFecha(ped.created_at)}</span>
                </div>
                <p>
                  <strong>Cliente:</strong> {ped.cliente}
                </p>
                <div className={styles.listaItemsCocina}>
                  {ped.items.map((it, idx) => (
                    <div key={idx} className={styles.itemCocina}>
                      <strong>
                        {it.cantidad}x {it.producto.nombre}
                      </strong>
                      {it.notas && <p className={styles.notasCocina}>⚠️ Nota: {it.notas}</p>}
                      {it.agregados && (
                        <div className={styles.agregadosCocina}>
                          {it.agregados.map((a) => (
                            <span key={a.ingrediente_id}>
                              + {a.cantidad} {a.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className={styles.actionsCocina}>
                  {ped.estado === 'Pendiente' && (
                    <button
                      className={styles.btnPreparar}
                      onClick={() => cambiarEstadoPedido(ped.id, 'En Preparación')}
                    >
                      👨‍🍳 Empezar Preparación
                    </button>
                  )}
                  {ped.estado === 'En Preparación' && (
                    <button className={styles.btnServir} onClick={() => cambiarEstadoPedido(ped.id, 'Servido')}>
                      ✅ Marcar Listo / Servido
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VISTA 5: INVENTARIO DE INGREDIENTES */}
        {/* ==================================================================== */}
        {pestanaPrincipal === 'produccion' && subPestanaProduccion === 'inventario' && (
          <div className={styles.seccionInventario}>
            <h2>Gestión de Stock e Ingredientes</h2>
            <div className={styles.tablaResponsiveContainer}>
              <table className={styles.tablaApp}>
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Unidad</th>
                    <th>Stock Actual</th>
                    <th>Mínimo Alerta</th>
                    <th>Costo/Unidad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.map((ing) => (
                    <tr key={ing.id}>
                      <td>
                        <strong>{ing.nombre}</strong>
                      </td>
                      <td>{ing.unidad}</td>
                      <td>{ing.stock_actual}</td>
                      <td>{ing.minimo_alerta}</td>
                      <td>${ing.costo_unidad.toLocaleString()}</td>
                      <td>
                        {ing.stock_actual <= ing.minimo_alerta ? (
                          <span className={styles.badgeError}>⚠️ Stock Bajo</span>
                        ) : (
                          <span className={styles.badgeOk}>✅ Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL 1: OPCIONES DE PRODUCTO / AGREGADOS Y NOTAS */}
      {/* ==================================================================== */}
      {productoEdicion && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContenido}>
            <h3>Personalizar {productoEdicion.nombre}</h3>
            <p>Precio base: ${productoEdicion.precio.toLocaleString()}</p>

            <div className={styles.campoModal}>
              <label>Cantidad:</label>
              <div className={styles.rowCantidadModal}>
                <button onClick={() => setCantidadEdicion((c) => Math.max(1, c - 1))}>-</button>
                <span>{cantidadEdicion}</span>
                <button onClick={() => setCantidadEdicion((c) => c + 1)}>+</button>
              </div>
            </div>

            <div className={styles.campoModal}>
              <label>Notas especiales para cocina:</label>
              <input
                type="text"
                placeholder="Ej: Sin cebolla, extra salsa..."
                value={notasEdicion}
                onChange={(e) => setNotasEdicion(e.target.value)}
              />
            </div>

            {/* SECCIÓN DE AGREGADOS */}
            <div className={styles.campoModal}>
              <label>Adicionales / Agregados:</label>
              <div className={styles.listaAgregadosSeleccion}>
                {ingredientes.slice(0, 6).map((ing) => (
                  <div key={ing.id} className={styles.rowAgregadoItem}>
                    <span>{ing.nombre} (+$1,500)</span>
                    <input
                      type="number"
                      min="0"
                      value={agregadosEdicion[ing.id] || 0}
                      onChange={(e) =>
                        setAgregadosEdicion({ ...agregadosEdicion, [ing.id]: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalAcciones}>
              <button className={styles.btnCancelar} onClick={() => setProductoEdicion(null)}>
                Cancelar
              </button>
              <button className={styles.btnAceptar} onClick={agregarAlCarrito}>
                Agregar al Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: PROCESAR PAGO Y COBRO DE VENTA */}
      {/* ==================================================================== */}
      {pedidoACobrar && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContenido}>
            <h3>Cobrar {pedidoACobrar.mesa}</h3>
            <p>Cliente: {pedidoACobrar.cliente}</p>
            <h2>Total a Pagar: ${pedidoACobrar.total.toLocaleString()}</h2>

            <div className={styles.campoModal}>
              <label>Método de Pago:</label>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                <option value="Efectivo">💵 Efectivo</option>
                <option value="Tarjeta">💳 Tarjeta</option>
                <option value="Transferencia">📲 Transferencia (Bancolombia/Nequi)</option>
              </select>
            </div>

            {metodoPago === 'Efectivo' && (
              <div className={styles.campoModal}>
                <label>Efectivo Recibido del Cliente:</label>
                <input
                  type="number"
                  value={montoEfectivoCliente}
                  onChange={(e) => setMontoEfectivoCliente(e.target.value)}
                />
                {parseFloat(montoEfectivoCliente) >= pedidoACobrar.total && (
                  <div className={styles.boxCambioCalculado}>
                    <strong>
                      Devolver / Cambio: ${(parseFloat(montoEfectivoCliente) - pedidoACobrar.total).toLocaleString()}
                    </strong>
                  </div>
                )}
              </div>
            )}

            <div className={styles.modalAcciones}>
              <button className={styles.btnCancelar} onClick={() => setPedidoACobrar(null)}>
                Cancelar
              </button>
              <button className={styles.btnAceptar} onClick={procesarCobroVenta}>
                ✅ CONFIRMAR Y REGISTRAR VENTA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: VER DETALLE / TICKET DE VENTA SELECCIONADA */}
      {/* ==================================================================== */}
      {ventaSeleccionada && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContenido}>
            <div ref={ticketRef} className={styles.ticketBox}>
              <h3 style={{ textAlign: 'center' }}>🥙 Arepa Secreta</h3>
              <p style={{ textAlign: 'center', fontSize: '12px' }}>
                Fecha: {new Date(ventaSeleccionada.created_at).toLocaleString()}
              </p>
              <hr />
              <p>
                <strong>Cliente:</strong> {ventaSeleccionada.cliente}
              </p>
              <p>
                <strong>Método de Pago:</strong> {ventaSeleccionada.metodo_pago}
              </p>
              <hr />
              <div>
                {ventaSeleccionada.items &&
                  ventaSeleccionada.items.map((it, idx) => (
                    <div key={idx} className={styles.rowTicketItem}>
                      <span>
                        {it.cantidad}x {it.producto.nombre}
                      </span>
                      <span>${calcularSubtotalItem(it).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
              <hr />
              <div className={styles.rowTicketTotal}>
                <strong>TOTAL PAGADO:</strong>
                <strong>${ventaSeleccionada.total.toLocaleString()}</strong>
              </div>
            </div>

            <div className={styles.modalAcciones}>
              <button className={styles.btnCancelar} onClick={() => setVentaSeleccionada(null)}>
                Cerrar
              </button>
              <button className={styles.btnAceptar} onClick={() => window.print()}>
                🖨️ Imprimir Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}