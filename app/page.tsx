'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './Calculadora.module.css';

interface Producto { id: string; nombre: string; precio: number; }
interface Insumo { id: string; nombre: string; unidad: string; stock_actual: number; }
interface RecetaItem { id: string; producto_id: string; insumo_id: string; cantidad_requerida: number; }
interface LineaFactura { id: number; productoId: string; cantidad: number; }
interface ProductoVenta { nombre: string; cantidad: number; precioUnitario: number; subtotal: number; }
interface Venta { id: number; created_at: string; cliente: string; documento: string; metodo_pago: string; total: number; productos: ProductoVenta[]; cierre_id?: string; }
interface Mesa { id: string; nombre: string; estado: 'libre' | 'ocupada'; pedidos: LineaFactura[]; }
interface CierreCaja { id: string; fecha: string; base_inicial: number; total_sistema: number; efectivo_sistema: number; tarjeta_sistema: number; transferencia_sistema: number; efectivo_real: number; tarjeta_real: number; transferencia_real: number; diferencia_efectivo: number; diferencia_tarjeta: number; diferencia_transferencia: number; }

export default function Home() {
  const [modulo, setModulo] = useState<'ventas' | 'produccion'>('ventas');
  const [subPestanaVentas, setSubPestanaVentas] = useState<'mesas' | 'caja' | 'historial'>('mesas');
  const [subPestanaProduccion, setSubPestanaProduccion] = useState<'inventario' | 'recetas' | 'productos'>('inventario');
  const [subPestanaHistorial, setSubPestanaHistorial] = useState<'ventas' | 'cierres'>('ventas');

  // Datos principales
  const [productos, setProductos] = useState<Producto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<RecetaItem[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  // Control de Arqueo / Jornada
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(false);
  const [baseEfectivoInput, setBaseEfectivoInput] = useState<string>('');
  const [baseEfectivoJornada, setBaseEfectivoJornada] = useState<number>(0);

  // Mesas y Pedidos
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [cliente, setCliente] = useState({ nombre: '', documento: '' });
  const [lineasMesa, setLineasMesa] = useState<LineaFactura[]>([]);

  // Cierre
  const [efectivoReal, setEfectivoReal] = useState('');
  const [tarjetaReal, setTarjetaReal] = useState('');
  const [transferenciaReal, setTransferenciaReal] = useState('');

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

  const [mostrarModalFactura, setMostrarModalFactura] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [cierreFiltroSeleccionado, setCierreFiltroSeleccionado] = useState<string>('abierta');

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    await Promise.all([
      obtenerProductos(),
      obtenerInsumos(),
      obtenerRecetas(),
      obtenerVentas(),
      obtenerMesas(),
      obtenerCierres(),
    ]);
  };

  const obtenerProductos = async () => {
    const { data } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
    if (data) setProductos(data as Producto[]);
  };

  const obtenerInsumos = async () => {
    const { data } = await supabase.from('insumos').select('*').order('nombre', { ascending: true });
    if (data) setInsumos(data as Insumo[]);
  };

  const obtenerRecetas = async () => {
    const { data } = await supabase.from('recetas').select('*');
    if (data) setRecetas(data as RecetaItem[]);
  };

  const obtenerVentas = async () => {
    const { data } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
    if (data) setVentas(data as Venta[]);
  };

  const obtenerMesas = async () => {
    const { data } = await supabase.from('mesas').select('*').order('nombre', { ascending: true });
    if (data) setMesas(data as Mesa[]);
  };

  const obtenerCierres = async () => {
    const { data } = await supabase.from('cierres_caja').select('*').order('fecha', { ascending: false });
    if (data) setCierres(data as CierreCaja[]);
  };

  // Ventas de la jornada activa (sin asignar a cierre)
  const ventasJornadaActual = ventas.filter((v) => !v.cierre_id);
  const totalHoy = ventasJornadaActual.reduce((acc, v) => acc + (v.total || 0), 0);
  const totalEfectivoHoy = ventasJornadaActual.filter((v) => (v.metodo_pago || 'Efectivo') === 'Efectivo').reduce((acc, v) => acc + (v.total || 0), 0);
  const totalTarjetaHoy = ventasJornadaActual.filter((v) => v.metodo_pago === 'Tarjeta').reduce((acc, v) => acc + (v.total || 0), 0);
  const totalTransferenciaHoy = ventasJornadaActual.filter((v) => v.metodo_pago === 'Transferencia').reduce((acc, v) => acc + (v.total || 0), 0);

  // Efectivo total esperado en caja = Base inicial + Ventas en efectivo
  const efectivoEsperadoEnCaja = baseEfectivoJornada + totalEfectivoHoy;

  // Diferencias Cierre
  const difEfectivo = efectivoReal !== '' ? (parseFloat(efectivoReal) || 0) - efectivoEsperadoEnCaja : null;
  const difTarjeta = tarjetaReal !== '' ? (parseFloat(tarjetaReal) || 0) - totalTarjetaHoy : null;
  const difTransferencia = transferenciaReal !== '' ? (parseFloat(transferenciaReal) || 0) - totalTransferenciaHoy : null;

  // Apertura de caja
  const abrirCajaJornada = () => {
    const baseNum = parseFloat(baseEfectivoInput) || 0;
    setBaseEfectivoJornada(baseNum);
    setCajaAbierta(true);
    alert(`Caja abierta exitosamente con una base inicial de $${baseNum.toLocaleString()}`);
  };

  // Mesas
  const seleccionarMesa = (m: Mesa) => {
    if (!cajaAbierta) {
      alert('⚠️ Debes realizar la apertura de caja antes de atender mesas.');
      return;
    }
    setMesaSeleccionada(m);
    setLineasMesa(m.pedidos || []);
  };

  const agregarMesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombreMesa.trim()) return;
    await supabase.from('mesas').insert([{ nombre: nuevoNombreMesa }]);
    setNuevoNombreMesa('');
    obtenerMesas();
  };

  const eliminarMesa = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa?')) return;
    await supabase.from('mesas').delete().eq('id', id);
    if (mesaSeleccionada?.id === id) setMesaSeleccionada(null);
    obtenerMesas();
  };

  const guardarPedidoMesa = async () => {
    if (!mesaSeleccionada) return;
    const estado = lineasMesa.length > 0 ? 'ocupada' : 'libre';
    await supabase.from('mesas').update({ pedidos: lineasMesa, estado }).eq('id', mesaSeleccionada.id);
    obtenerMesas();
    alert('Comanda guardada');
  };

  const cobrarMesa = async () => {
    if (!mesaSeleccionada) return;
    const productosValidos = lineasMesa
      .filter((f) => f.productoId !== '')
      .map((f) => {
        const prod = productos.find((p) => p.id === f.productoId);
        return {
          productoId: f.productoId,
          nombre: prod ? prod.nombre : '',
          cantidad: f.cantidad,
          precioUnitario: prod ? prod.precio : 0,
          subtotal: prod ? prod.precio * f.cantidad : 0,
        };
      });

    if (productosValidos.length === 0) return alert('No hay productos en la mesa');

    // Descontar inventario
    for (const pVal of productosValidos) {
      const ingredientes = recetas.filter((r) => r.producto_id === pVal.productoId);
      for (const ing of ingredientes) {
        const insumoObj = insumos.find((i) => i.id === ing.insumo_id);
        if (insumoObj) {
          const consumoTotal = Number(ing.cantidad_requerida) * pVal.cantidad;
          const nuevoStock = Number(insumoObj.stock_actual) - consumoTotal;
          await supabase.from('insumos').update({ stock_actual: nuevoStock }).eq('id', insumoObj.id);
        }
      }
    }

    const totalCobrar = productosValidos.reduce((acc, item) => acc + item.subtotal, 0);

    const nuevaVenta = {
      cliente: cliente.nombre || `Mesa: ${mesaSeleccionada.nombre}`,
      documento: cliente.documento || 'N/A',
      metodo_pago: metodoPago,
      productos: productosValidos.map(({ productoId, ...resto }) => resto),
      total: totalCobrar,
    };

    await supabase.from('ventas').insert([nuevaVenta]);
    await supabase.from('mesas').update({ pedidos: [], estado: 'libre' }).eq('id', mesaSeleccionada.id);

    setLineasMesa([]);
    setMesaSeleccionada(null);
    await cargarTodo();
    setMostrarModalFactura(true);
  };

  // Cierre de caja
  const realizarCierreCaja = async () => {
    if (!confirm('¿Seguro de realizar el cierre de caja? Esto dará por finalizada la jornada laboral.')) return;

    const efReal = parseFloat(efectivoReal) || 0;
    const tarReal = parseFloat(tarjetaReal) || 0;
    const transReal = parseFloat(transferenciaReal) || 0;

    const cierre = {
      base_inicial: baseEfectivoJornada,
      total_sistema: totalHoy,
      efectivo_sistema: totalEfectivoHoy,
      tarjeta_sistema: totalTarjetaHoy,
      transferencia_sistema: totalTransferenciaHoy,
      efectivo_real: efReal,
      tarjeta_real: tarReal,
      transferencia_real: transReal,
      diferencia_efectivo: efReal - efectivoEsperadoEnCaja,
      diferencia_tarjeta: tarReal - totalTarjetaHoy,
      diferencia_transferencia: transReal - totalTransferenciaHoy,
    };

    const { data: cierreGuardado, error } = await supabase.from('cierres_caja').insert([cierre]).select();

    if (error) {
      alert('Error en el cierre: ' + error.message);
    } else if (cierreGuardado && cierreGuardado[0]) {
      const nuevoCierreId = cierreGuardado[0].id;
      const idsVentasAbiertas = ventasJornadaActual.map((v) => v.id);
      if (idsVentasAbiertas.length > 0) {
        await supabase.from('ventas').update({ cierre_id: nuevoCierreId }).in('id', idsVentasAbiertas);
      }

      alert('🔒 Cierre completado. La jornada ha sido finalizada.');
      setCajaAbierta(false);
      setBaseEfectivoJornada(0);
      setBaseEfectivoInput('');
      setEfectivoReal(''); setTarjetaReal(''); setTransferenciaReal('');
      setMesaSeleccionada(null);
      await cargarTodo();
    }
  };

  // Borrar Venta de la BD
  const eliminarVenta = async (id: number) => {
    if (!confirm(`¿Estás seguro de eliminar permanentemente la venta #${id}?`)) return;

    const { error } = await supabase.from('ventas').delete().eq('id', id);

    if (error) {
      alert('Error al eliminar venta: ' + error.message);
    } else {
      alert('Venta eliminada correctamente');
      obtenerVentas();
    }
  };

  // Borrar Cierre de Caja
  const eliminarCierre = async (cierreId: string) => {
    if (!confirm('¿Seguro de eliminar este cierre de caja? Las ventas vinculadas volverán a quedar abiertas.')) return;

    // Desvincular ventas
    await supabase.from('ventas').update({ cierre_id: null }).eq('cierre_id', cierreId);
    // Eliminar cierre
    const { error } = await supabase.from('cierres_caja').delete().eq('id', cierreId);

    if (error) {
      alert('Error al eliminar el cierre: ' + error.message);
    } else {
      alert('Cierre de caja eliminado. Las ventas regresaron a la jornada activa.');
      cargarTodo();
    }
  };

  // Producción
  const guardarRecetaMultiple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodRecetaSel) return alert('Selecciona un producto');

    const inserciones = lineasReceta
      .filter((l) => l.insumo_id && l.cantidad_requerida)
      .map((l) => ({
        producto_id: prodRecetaSel,
        insumo_id: l.insumo_id,
        cantidad_requerida: parseFloat(l.cantidad_requerida),
      }));

    if (inserciones.length === 0) return alert('Agrega al menos un insumo');

    await supabase.from('recetas').insert(inserciones);
    setProdRecetaSel('');
    setLineasReceta([{ insumo_id: '', cantidad_requerida: '' }]);
    obtenerRecetas();
  };

  const editarCantidadReceta = async (id: string) => {
    if (!cantEditandoVal) return;
    await supabase.from('recetas').update({ cantidad_requerida: parseFloat(cantEditandoVal) }).eq('id', id);
    setRecetaEditandoId(null);
    setCantEditandoVal('');
    obtenerRecetas();
  };

  const eliminarRecetaItem = async (id: string) => {
    if (!confirm('¿Eliminar ingrediente?')) return;
    await supabase.from('recetas').delete().eq('id', id);
    obtenerRecetas();
  };

  const guardarInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('insumos').insert([{ nombre: nuevoInsumoNombre, unidad: nuevoInsumoUnidad, stock_actual: parseFloat(nuevoInsumoStock) }]);
    setNuevoInsumoNombre(''); setNuevoInsumoStock('');
    obtenerInsumos();
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const precioNum = parseFloat(nuevoPrecio);
    if (productoEditando) {
      await supabase.from('productos').update({ nombre: nuevoNombre, precio: precioNum }).eq('id', productoEditando.id);
      setProductoEditando(null);
    } else {
      await supabase.from('productos').insert([{ nombre: nuevoNombre, precio: precioNum }]);
    }
    setNuevoNombre(''); setNuevoPrecio('');
    obtenerProductos();
  };

  const actualizarStockFisico = async (insumoId: string) => {
    const valor = conteosFisicos[insumoId];
    if (!valor) return;
    await supabase.from('insumos').update({ stock_actual: parseFloat(valor) }).eq('id', insumoId);
    setConteosFisicos((prev) => ({ ...prev, [insumoId]: '' }));
    obtenerInsumos();
  };

  const formatearFecha = (fechaISO: string) => new Date(fechaISO).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const totalCalculadoMesa = lineasMesa.reduce((acc, f) => {
    const p = productos.find((prod) => prod.id === f.productoId);
    return acc + (p ? p.precio : 0) * f.cantidad;
  }, 0);

  const ventasFiltradasHistorial = cierreFiltroSeleccionado === 'abierta'
    ? ventas.filter((v) => !v.cierre_id)
    : ventas.filter((v) => v.cierre_id === cierreFiltroSeleccionado);

  return (
    <div className={styles.contenedorApp}>
      {/* NAVEGACIÓN PRINCIPAL */}
      <nav className={styles.barrasNavegacion}>
        <div className={styles.brandTitle}>🍽️ RestoPOS Pro</div>
        <div className={styles.botonesModulo}>
          <button className={`${styles.btnModulo} ${modulo === 'ventas' ? styles.activeModulo : ''}`} onClick={() => setModulo('ventas')}>
            🏪 Ventas y Caja
          </button>
          <button className={`${styles.btnModulo} ${modulo === 'produccion' ? styles.activeModulo : ''}`} onClick={() => setModulo('produccion')}>
            📦 Producción y Costes
          </button>
        </div>
      </nav>

      {/* MÓDULO VENTAS */}
      {modulo === 'ventas' && (
        <div>
          <div className={styles.subBarra}>
            <button className={subPestanaVentas === 'mesas' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('mesas')}>🪑 Mesas y Pedidos</button>
            <button className={subPestanaVentas === 'caja' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('caja')}>💰 Cierre de Caja</button>
            <button className={subPestanaVentas === 'historial' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('historial')}>📋 Historiales</button>
          </div>

          {/* MESAS CON ARQUEO LATERAL IZQUIERDO */}
          {subPestanaVentas === 'mesas' && (
            <div className={styles.layoutTresColumnas}>
              
              {/* COLUMNA 1: WIDGET DE ARQUEO DE CAJA Y APERTURA */}
              <div className={styles.widgetArqueoIzquierdo}>
                <div className={styles.cardArqueoHeader}>
                  <h4>💵 Arqueo de Caja</h4>
                  <span className={cajaAbierta ? styles.statusAbierta : styles.statusCerrada}>
                    {cajaAbierta ? '🟢 ABIERTA' : '🔴 CERRADA'}
                  </span>
                </div>

                {!cajaAbierta ? (
                  <div className={styles.aperturaBox}>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>Ingresa la base inicial para comenzar el servicio:</p>
                    <input
                      type="number"
                      placeholder="Base ($)"
                      className={styles.inputChico}
                      value={baseEfectivoInput}
                      onChange={(e) => setBaseEfectivoInput(e.target.value)}
                    />
                    <button onClick={abrirCajaJornada} className={styles.btnApertura}>
                      🔓 ABRIR CAJA DEL DÍA
                    </button>
                  </div>
                ) : (
                  <div className={styles.resumenArqueoBox}>
                    <div className={styles.filaResumen}><span>Base Inicial:</span><strong>${baseEfectivoJornada.toLocaleString()}</strong></div>
                    <div className={styles.filaResumen}><span>💵 Efectivo:</span><strong>${totalEfectivoHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumen}><span>💳 Tarjeta:</span><strong>${totalTarjetaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumen}><span>📲 Transferencia:</span><strong>${totalTransferenciaHoy.toLocaleString()}</strong></div>
                    <div className={styles.filaResumenTotal}><span>Total en Caja:</span><strong>${(baseEfectivoJornada + totalHoy).toLocaleString()}</strong></div>
                  </div>
                )}
              </div>

              {/* COLUMNA 2: MAPA DE MESAS */}
              <div className={styles.seccionMesasGrid}>
                <div className={styles.headerConBoton}>
                  <h3>Mapa de Mesas</h3>
                  <form onSubmit={agregarMesa} style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Mesa" className={styles.inputChico} value={nuevoNombreMesa} onChange={(e) => setNuevoNombreMesa(e.target.value)} required />
                    <button type="submit" className={styles.btnAgregarConBorde}>＋ Agregar</button>
                  </form>
                </div>

                <div className={styles.reticulaMesas}>
                  {mesas.map((m) => (
                    <div
                      key={m.id}
                      className={`${styles.tarjetaMesa} ${m.estado === 'ocupada' ? styles.mesaOcupada : styles.mesaLibre} ${mesaSeleccionada?.id === m.id ? styles.mesaSeleccionada : ''}`}
                      onClick={() => seleccionarMesa(m)}
                    >
                      <span className={styles.badgeEstado}>{m.estado.toUpperCase()}</span>
                      <h4>{m.nombre}</h4>
                      <p>{m.pedidos ? m.pedidos.length : 0} ítems</p>
                      <button onClick={(e) => { e.stopPropagation(); eliminarMesa(m.id); }} className={styles.btnTrashMesa}>🗑️</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* COLUMNA 3: COMANDERA DE LA MESA */}
              <div className={styles.panelPedidoMesa}>
                {mesaSeleccionada ? (
                  <>
                    <h3>Atendiendo: {mesaSeleccionada.nombre}</h3>
                    <div className={styles.formClienteGrid}>
                      <input type="text" placeholder="Cliente" className={styles.inputChico} value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} />
                      <input type="text" placeholder="Cédula/NIT" className={styles.inputChico} value={cliente.documento} onChange={(e) => setCliente({ ...cliente, documento: e.target.value })} />
                    </div>

                    <div className={styles.selectorMetodo}>
                      {(['Efectivo', 'Tarjeta', 'Transferencia'] as const).map((m) => (
                        <button key={m} className={metodoPago === m ? styles.metodoSel : ''} onClick={() => setMetodoPago(m)}>{m}</button>
                      ))}
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

                    <div className={styles.footerTotalMesa}>
                      <span>Total Mesa:</span>
                      <strong>${totalCalculadoMesa.toLocaleString()}</strong>
                    </div>

                    <div className={styles.accionesMesa}>
                      <button className={styles.btnGuardarPedido} onClick={guardarPedidoMesa}>💾 Guardar Comanda</button>
                      <button className={styles.btnCobrar} onClick={cobrarMesa}>⚡ COBRAR Y FACTURAR</button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* CIERRE DE CAJA */}
          {subPestanaVentas === 'caja' && (
            <div className={styles.seccionCaja}>
              <h2>Control y Cierre de Caja (Jornada Activa)</h2>

              <div className={styles.gridMetricasCaja}>
                <div className={styles.cardMetrica}><span>Base del Día</span><h3>${baseEfectivoJornada.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Efectivo Esperado</span><h3 style={{ color: '#16a34a' }}>${efectivoEsperadoEnCaja.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Tarjetas Sistema</span><h3 style={{ color: '#9333ea' }}>${totalTarjetaHoy.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Transferencias Sistema</span><h3 style={{ color: '#ea580c' }}>${totalTransferenciaHoy.toLocaleString()}</h3></div>
              </div>

              <div className={styles.formArqueoCaja}>
                <h3>Ingresar Conteo Físico Real de Dinero</h3>
                <div className={styles.gridArqueoInputs}>
                  <div>
                    <label>💵 Efectivo Físico (Incluyendo Base)</label>
                    <input type="number" placeholder="Monto real" value={efectivoReal} onChange={(e) => setEfectivoReal(e.target.value)} />
                    {difEfectivo !== null && (
                      <span className={difEfectivo < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                        {difEfectivo === 0 ? '✅ Cuadre exacto' : difEfectivo < 0 ? `⚠️ Falta: $${difEfectivo.toLocaleString()}` : `➕ Sobra: +$${difEfectivo.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <div>
                    <label>💳 Tarjetas Físico</label>
                    <input type="number" placeholder="Monto real" value={tarjetaReal} onChange={(e) => setTarjetaReal(e.target.value)} />
                    {difTarjeta !== null && (
                      <span className={difTarjeta < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                        {difTarjeta === 0 ? '✅ Cuadre exacto' : difTarjeta < 0 ? `⚠️ Falta: $${difTarjeta.toLocaleString()}` : `➕ Sobra: +$${difTarjeta.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <div>
                    <label>📲 Transferencias Físico</label>
                    <input type="number" placeholder="Monto real" value={transferenciaReal} onChange={(e) => setTransferenciaReal(e.target.value)} />
                    {difTransferencia !== null && (
                      <span className={difTransferencia < 0 ? styles.badgeDiferenciaError : styles.badgeDiferenciaOk}>
                        {difTransferencia === 0 ? '✅ Cuadre exacto' : difTransferencia < 0 ? `⚠️ Falta: $${difTransferencia.toLocaleString()}` : `➕ Sobra: +$${difTransferencia.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>

                <button className={styles.btnCierreAccion} onClick={realizarCierreCaja} disabled={!cajaAbierta}>
                  🔒 CERRAR JORNADA Y FINALIZAR DÍA
                </button>
              </div>

              <div style={{ marginTop: '28px' }}>
                <h3>Ventas de la Jornada Activa ({ventasJornadaActual.length})</h3>
                <table className={styles.tablaApp}>
                  <thead>
                    <tr><th>Hora</th><th>Cliente</th><th>Método</th><th>Total</th><th>Acción</th></tr>
                  </thead>
                  <tbody>
                    {ventasJornadaActual.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No hay ventas registradas en la jornada en curso.</td></tr>
                    ) : (
                      ventasJornadaActual.map((v) => (
                        <tr key={v.id}>
                          <td>{formatearFecha(v.created_at)}</td>
                          <td>{v.cliente}</td>
                          <td>{v.metodo_pago}</td>
                          <td><strong>${v.total.toLocaleString()}</strong></td>
                          <td><button onClick={() => setVentaSeleccionada(v)} className={styles.btnVerConBorde}>👁️ Detalle</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HISTORIALES */}
          {subPestanaVentas === 'historial' && (
            <div className={styles.seccionHistoriales}>
              <div className={styles.subSubBarra}>
                <button className={subPestanaHistorial === 'ventas' ? styles.subSubActive : ''} onClick={() => setSubPestanaHistorial('ventas')}>Historial de Ventas por Cierre</button>
                <button className={subPestanaHistorial === 'cierres' ? styles.subSubActive : ''} onClick={() => setSubPestanaHistorial('cierres')}>Historial de Cierres de Caja</button>
              </div>

              {subPestanaHistorial === 'ventas' ? (
                <div>
                  <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ fontWeight: 'bold' }}>Filtrar por Cierre / Jornada:</label>
                    <select className={styles.selectChico} style={{ maxWidth: '350px' }} value={cierreFiltroSeleccionado} onChange={(e) => setCierreFiltroSeleccionado(e.target.value)}>
                      <option value="abierta">🟢 Jornada Activa (En servicio)</option>
                      {cierres.map((c) => (
                        <option key={c.id} value={c.id}>
                          🔒 Cierre del {formatearFecha(c.fecha)} (${c.total_sistema.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <table className={styles.tablaApp}>
                    <thead>
                      <tr><th>Hora/Fecha</th><th>Cliente</th><th>Método</th><th>Total</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {ventasFiltradasHistorial.map((v) => (
                        <tr key={v.id}>
                          <td>{formatearFecha(v.created_at)}</td>
                          <td>{v.cliente}</td>
                          <td>{v.metodo_pago}</td>
                          <td><strong>${v.total.toLocaleString()}</strong></td>
                          <td>
                            <button onClick={() => setVentaSeleccionada(v)} className={styles.btnVerConBorde}>👁️ Detalle</button>
                            <button onClick={() => eliminarVenta(v.id)} className={styles.btnEliminarConBorde} style={{ marginLeft: '6px' }}>🗑️ Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <table className={styles.tablaApp}>
                  <thead>
                    <tr><th>Fecha Cierre</th><th>Base</th><th>Total Sistema</th><th>Efectivo Real</th><th>Diferencia</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {cierres.map((c) => (
                      <tr key={c.id}>
                        <td>{formatearFecha(c.fecha)}</td>
                        <td>${c.base_inicial?.toLocaleString() || 0}</td>
                        <td>${c.total_sistema.toLocaleString()}</td>
                        <td>${c.efectivo_real.toLocaleString()}</td>
                        <td style={{ color: c.diferencia_efectivo < 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                          ${(c.diferencia_efectivo + c.diferencia_tarjeta + c.diferencia_transferencia).toLocaleString()}
                        </td>
                        <td>
                          <button onClick={() => eliminarCierre(c.id)} className={styles.btnEliminarConBorde}>🗑️ Eliminar Cierre</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* MÓDULO PRODUCCIÓN Y COSTES */}
      {modulo === 'produccion' && (
        <div>
          <div className={styles.subBarra}>
            <button className={subPestanaProduccion === 'inventario' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('inventario')}>📦 Inventario Insumos</button>
            <button className={subPestanaProduccion === 'recetas' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('recetas')}>🍳 Recetas y Escandallos</button>
            <button className={subPestanaProduccion === 'productos' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('productos')}>🍔 Menú y Productos</button>
          </div>

          {/* INVENTARIO */}
          {subPestanaProduccion === 'inventario' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={guardarInsumo} className={styles.formStandard}>
                <h3>➕ Registrar Materia Prima</h3>
                <div className={styles.grid3Campos}>
                  <input type="text" placeholder="Nombre insumo" value={nuevoInsumoNombre} onChange={(e) => setNuevoInsumoNombre(e.target.value)} required />
                  <select value={nuevoInsumoUnidad} onChange={(e) => setNuevoInsumoUnidad(e.target.value)}>
                    <option value="g">Gramos (g)</option><option value="kg">Kilos (kg)</option><option value="ml">Ml</option><option value="unidades">Unidades</option>
                  </select>
                  <input type="number" placeholder="Stock inicial" value={nuevoInsumoStock} onChange={(e) => setNuevoInsumoStock(e.target.value)} required />
                </div>
                <button type="submit" className={styles.btnAgregarConBorde}>Guardar Insumo</button>
              </form>

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
          )}

          {/* RECETAS */}
          {subPestanaProduccion === 'recetas' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={guardarRecetaMultiple} className={styles.formStandard}>
                <h3>🍳 Crear / Vincular Receta Múltiple</h3>

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
                  <button type="submit" className={styles.btnAgregarConBorde}>💾 Guardar Receta Completa</button>
                </div>
              </form>

              <h3 style={{ marginTop: '28px' }}>📋 Recetas Registradas</h3>
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
                            <button onClick={() => editarCantidadReceta(r.id)} className={styles.btnAgregarConBorde}>💾 Guardar</button>
                          ) : (
                            <button onClick={() => { setRecetaEditandoId(r.id); setCantEditandoVal(r.cantidad_requerida.toString()); }} className={styles.btnVerConBorde}>✏️ Editar</button>
                          )}
                          <button onClick={() => eliminarRecetaItem(r.id)} className={styles.btnEliminarConBorde} style={{ marginLeft: '6px' }}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PRODUCTOS */}
          {subPestanaProduccion === 'productos' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={guardarProducto} className={styles.formStandard}>
                <h3>{productoEditando ? '✏️ Editar Producto' : '➕ Nuevo Producto del Menú'}</h3>
                <div className={styles.grid2Campos}>
                  <input type="text" placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
                  <input type="number" placeholder="Precio ($)" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} required />
                </div>
                <button type="submit" className={styles.btnAgregarConBorde}>{productoEditando ? 'Guardar Cambios' : 'Agregar Al Menú'}</button>
              </form>

              <table className={styles.tablaApp}>
                <thead><tr><th>Producto</th><th>Precio</th><th>Acciones</th></tr></thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>${p.precio.toLocaleString()}</td>
                      <td>
                        <button onClick={() => { setProductoEditando(p); setNuevoNombre(p.nombre); setNuevoPrecio(p.precio.toString()); }} className={styles.btnVerConBorde}>✏️</button>
                        <button onClick={async () => { await supabase.from('productos').delete().eq('id', p.id); obtenerProductos(); }} className={styles.btnEliminarConBorde}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL IMPRESIÓN / DETALLE */}
      {(mostrarModalFactura || ventaSeleccionada) && (
        <div className={styles.overlayModal} onClick={() => { setMostrarModalFactura(false); setVentaSeleccionada(null); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>📄 Detalle de Venta</h3>
            {ventaSeleccionada && (
              <div>
                <p><strong>Cliente:</strong> {ventaSeleccionada.cliente}</p>
                <p><strong>Método de Pago:</strong> {ventaSeleccionada.metodo_pago}</p>
                <p><strong>Total:</strong> ${ventaSeleccionada.total.toLocaleString()}</p>
              </div>
            )}
            <div className={styles.modalActions}>
              <button onClick={() => { window.print(); setMostrarModalFactura(false); setVentaSeleccionada(null); }} className={styles.btnCobrar}>🖨️ Imprimir Ticket</button>
              <button onClick={() => { setMostrarModalFactura(false); setVentaSeleccionada(null); }} className={styles.btnAgregarConBorde}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}