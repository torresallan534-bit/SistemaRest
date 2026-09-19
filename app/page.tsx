'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './Calculadora.module.css';

interface Producto { id: string; nombre: string; precio: number; }
interface Insumo { id: string; nombre: string; unidad: string; stock_actual: number; }
interface RecetaItem { id: string; producto_id: string; insumo_id: string; cantidad_requerida: number; }
interface LineaFactura { id: number; productoId: string; cantidad: number; }
interface ProductoVenta { nombre: string; cantidad: number; precioUnitario: number; subtotal: number; }
interface Venta { id: number; created_at: string; cliente: string; documento: string; metodo_pago: string; total: number; productos: ProductoVenta[]; }
interface Mesa { id: string; nombre: string; estado: 'libre' | 'ocupada'; pedidos: LineaFactura[]; }
interface CierreCaja { id: string; fecha: string; total_sistema: number; efectivo_sistema: number; tarjeta_sistema: number; transferencia_sistema: number; efectivo_real: number; tarjeta_real: number; transferencia_real: number; diferencia_efectivo: number; diferencia_tarjeta: number; diferencia_transferencia: number; }

export default function Home() {
  // Navegación principal y secundaria
  const [modulo, setModulo] = useState<'ventas' | 'produccion'>('ventas');
  const [subPestanaVentas, setSubPestanaVentas] = useState<'mesas' | 'caja' | 'historial'>('mesas');
  const [subPestanaProduccion, setSubPestanaProduccion] = useState<'inventario' | 'recetas' | 'productos'>('inventario');
  const [subPestanaHistorial, setSubPestanaHistorial] = useState<'ventas' | 'cierres'>('ventas');

  // Datos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<RecetaItem[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cierres, setCierres] = useState<CierreCaja[]>([]);

  // Estado Mesa Seleccionada
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [cliente, setCliente] = useState({ nombre: '', documento: '' });
  const [lineasMesa, setLineasMesa] = useState<LineaFactura[]>([]);

  // Arqueo / Cierre de Caja (Valores Físicos)
  const [efectivoReal, setEfectivoReal] = useState('');
  const [tarjetaReal, setTarjetaReal] = useState('');
  const [transferenciaReal, setTransferenciaReal] = useState('');

  // Formularios
  const [nuevoNombreMesa, setNuevoNombreMesa] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('');
  const [nuevoInsumoUnidad, setNuevoInsumoUnidad] = useState('g');
  const [nuevoInsumoStock, setNuevoInsumoStock] = useState('');

  const [prodRecetaSel, setProdRecetaSel] = useState('');
  const [insumoRecetaSel, setInsumoRecetaSel] = useState('');
  const [cantRecetaReq, setCantRecetaReq] = useState('');
  const [conteosFisicos, setConteosFisicos] = useState<{ [key: string]: string }>({});

  const [mostrarModalFactura, setMostrarModalFactura] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    obtenerProductos();
    obtenerInsumos();
    obtenerRecetas();
    obtenerVentas();
    obtenerMesas();
    obtenerCierres();
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

  // Métricas de Caja
  const esDeHoy = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    const hoy = new Date();
    return (
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
    );
  };

  const ventasHoy = ventas.filter((v) => esDeHoy(v.created_at));
  const totalHoy = ventasHoy.reduce((acc, v) => acc + (v.total || 0), 0);
  const totalEfectivoHoy = ventasHoy.filter((v) => (v.metodo_pago || 'Efectivo') === 'Efectivo').reduce((acc, v) => acc + (v.total || 0), 0);
  const totalTarjetaHoy = ventasHoy.filter((v) => v.metodo_pago === 'Tarjeta').reduce((acc, v) => acc + (v.total || 0), 0);
  const totalTransferenciaHoy = ventasHoy.filter((v) => v.metodo_pago === 'Transferencia').reduce((acc, v) => acc + (v.total || 0), 0);

  // Manejo Mesas
  const seleccionarMesa = (m: Mesa) => {
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
    alert('Pedido guardado en la mesa');
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

    // Descontar materia prima
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

  // Cierre de Caja
  const realizarCierreCaja = async () => {
    const efReal = parseFloat(efectivoReal) || 0;
    const tarReal = parseFloat(tarjetaReal) || 0;
    const transReal = parseFloat(transferenciaReal) || 0;

    const cierre = {
      total_sistema: totalHoy,
      efectivo_sistema: totalEfectivoHoy,
      tarjeta_sistema: totalTarjetaHoy,
      transferencia_sistema: totalTransferenciaHoy,
      efectivo_real: efReal,
      tarjeta_real: tarReal,
      transferencia_real: transReal,
      diferencia_efectivo: efReal - totalEfectivoHoy,
      diferencia_tarjeta: tarReal - totalTarjetaHoy,
      diferencia_transferencia: transReal - totalTransferenciaHoy,
    };

    const { error } = await supabase.from('cierres_caja').insert([cierre]);
    if (error) alert('Error en el cierre: ' + error.message);
    else {
      alert('Cierre de caja registrado exitosamente');
      setEfectivoReal(''); setTarjetaReal(''); setTransferenciaReal('');
      obtenerCierres();
    }
  };

  // Eliminar Venta
  const eliminarVenta = async (id: number) => {
    if (!confirm('¿Seguro de eliminar esta venta del historial?')) return;
    await supabase.from('ventas').delete().eq('id', id);
    obtenerVentas();
  };

  // Inventario y Recetas
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

  const agregarIngredienteReceta = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('recetas').insert([{ producto_id: prodRecetaSel, insumo_id: insumoRecetaSel, cantidad_requerida: parseFloat(cantRecetaReq) }]);
    setCantRecetaReq('');
    obtenerRecetas();
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

  return (
    <div className={styles.contenedorApp}>
      {/* NAVEGACIÓN PRINCIPAL */}
      <nav className={styles.barrasNavegacion}>
        <div className={styles.brandTitle}>🍽️ RestoPOS Pro</div>
        <div className={styles.botonesModulo}>
          <button
            className={`${styles.btnModulo} ${modulo === 'ventas' ? styles.activeModulo : ''}`}
            onClick={() => setModulo('ventas')}
          >
            🏪 Ventas y Caja
          </button>
          <button
            className={`${styles.btnModulo} ${modulo === 'produccion' ? styles.activeModulo : ''}`}
            onClick={() => setModulo('produccion')}
          >
            📦 Producción y Costes
          </button>
        </div>
      </nav>

      {/* MÓDULO 1: VENTAS */}
      {modulo === 'ventas' && (
        <div>
          {/* Subpestañas Ventas */}
          <div className={styles.subBarra}>
            <button className={subPestanaVentas === 'mesas' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('mesas')}>🪑 Mesas y Pedidos</button>
            <button className={subPestanaVentas === 'caja' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('caja')}>💰 Cierre de Caja</button>
            <button className={subPestanaVentas === 'historial' ? styles.subActive : ''} onClick={() => setSubPestanaVentas('historial')}>📋 Historiales</button>
          </div>

          {/* SUBSECTION: MESAS */}
          {subPestanaVentas === 'mesas' && (
            <div className={styles.gridMesasLayout}>
              {/* Grid de Mesas */}
              <div className={styles.seccionMesasGrid}>
                <div className={styles.headerConBoton}>
                  <h3>Mapa de Mesas</h3>
                  <form onSubmit={agregarMesa} style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Nueva mesa (ej. Mesa 6)" className={styles.inputChico} value={nuevoNombreMesa} onChange={(e) => setNuevoNombreMesa(e.target.value)} required />
                    <button type="submit" className={styles.btnAgregar}>＋ Agregar</button>
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

              {/* Panel Lateral del Pedido */}
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

                    <button className={styles.btnAgregarLinea} onClick={() => setLineasMesa([...lineasMesa, { id: Date.now(), productoId: '', cantidad: 1 }])}>＋ Agregar Producto</button>

                    <div className={styles.footerTotalMesa}>
                      <span>Total Mesa:</span>
                      <strong>${totalCalculadoMesa.toLocaleString()}</strong>
                    </div>

                    <div className={styles.accionesMesa}>
                      <button className={styles.btnGuardarPedido} onClick={guardarPedidoMesa}>💾 Guardar Comanda</button>
                      <button className={styles.btnCobrar} onClick={cobrarMesa}>⚡ COBRAR Y FACTURAR</button>
                    </div>
                  </>
                ) : (
                  <div className={styles.sinMesa}>👈 Selecciona una mesa para tomar comanda</div>
                )}
              </div>
            </div>
          )}

          {/* SUBSECTION: CIERRE DE CAJA */}
          {subPestanaVentas === 'caja' && (
            <div className={styles.seccionCaja}>
              <h2>Control y Arqueo de Caja del Día</h2>
              
              <div className={styles.gridMetricasCaja}>
                <div className={styles.cardMetrica}><span>Total Vendido Hoy</span><h3>${totalHoy.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Efectivo Sistema</span><h3 style={{ color: '#16a34a' }}>${totalEfectivoHoy.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Tarjetas Sistema</span><h3 style={{ color: '#9333ea' }}>${totalTarjetaHoy.toLocaleString()}</h3></div>
                <div className={styles.cardMetrica}><span>Transferencias Sistema</span><h3 style={{ color: '#ea580c' }}>${totalTransferenciaHoy.toLocaleString()}</h3></div>
              </div>

              <div className={styles.formArqueoCaja}>
                <h3>Ingresar Conteo Físico Real de Dinero en Caja</h3>
                <div className={styles.gridArqueoInputs}>
                  <div><label>💵 Efectivo Físico</label><input type="number" placeholder="Ej. 85000" value={efectivoReal} onChange={(e) => setEfectivoReal(e.target.value)} /></div>
                  <div><label>💳 Tarjetas Físico</label><input type="number" placeholder="Ej. 35000" value={tarjetaReal} onChange={(e) => setTarjetaReal(e.target.value)} /></div>
                  <div><label>📲 Transferencias Físico</label><input type="number" placeholder="Ej. 25000" value={transferenciaReal} onChange={(e) => setTransferenciaReal(e.target.value)} /></div>
                </div>
                <button className={styles.btnCierreAccion} onClick={realizarCierreCaja}>🔒 REALIZAR CIERRE DE CAJA</button>
              </div>
            </div>
          )}

          {/* SUBSECTION: HISTORIALES */}
          {subPestanaVentas === 'historial' && (
            <div className={styles.seccionHistoriales}>
              <div className={styles.subSubBarra}>
                <button className={subPestanaHistorial === 'ventas' ? styles.subSubActive : ''} onClick={() => setSubPestanaHistorial('ventas')}>Ventas Registradas</button>
                <button className={subPestanaHistorial === 'cierres' ? styles.subSubActive : ''} onClick={() => setSubPestanaHistorial('cierres')}>Cierres de Caja</button>
              </div>

              {subPestanaHistorial === 'ventas' ? (
                <table className={styles.tablaApp}>
                  <thead>
                    <tr><th>Hora</th><th>Cliente</th><th>Método</th><th>Total</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {ventas.map((v) => (
                      <tr key={v.id}>
                        <td>{formatearFecha(v.created_at)}</td>
                        <td>{v.cliente}</td>
                        <td>{v.metodo_pago}</td>
                        <td><strong>${v.total.toLocaleString()}</strong></td>
                        <td>
                          <button onClick={() => setVentaSeleccionada(v)} className={styles.btnVer}>👁️</button>
                          <button onClick={() => eliminarVenta(v.id)} className={styles.btnEliminar}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className={styles.tablaApp}>
                  <thead>
                    <tr><th>Fecha</th><th>Total Sistema</th><th>Efectivo Real</th><th>Diferencia Efectivo</th></tr>
                  </thead>
                  <tbody>
                    {cierres.map((c) => (
                      <tr key={c.id}>
                        <td>{formatearFecha(c.fecha)}</td>
                        <td>${c.total_sistema.toLocaleString()}</td>
                        <td>${c.efectivo_real.toLocaleString()}</td>
                        <td style={{ color: c.diferencia_efectivo < 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                          ${c.diferencia_efectivo.toLocaleString()}
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

      {/* MÓDULO 2: PRODUCCIÓN Y COSTES */}
      {modulo === 'produccion' && (
        <div>
          <div className={styles.subBarra}>
            <button className={subPestanaProduccion === 'inventario' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('inventario')}>📦 Inventario Insumos</button>
            <button className={subPestanaProduccion === 'recetas' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('recetas')}>🍳 Recetas y Consumos</button>
            <button className={subPestanaProduccion === 'productos' ? styles.subActive : ''} onClick={() => setSubPestanaProduccion('productos')}>🍔 Menú y Productos</button>
          </div>

          {/* SUBSECTION: INVENTARIO */}
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
                <button type="submit" className={styles.btnAgregar}>Guardar Insumo</button>
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
                      <td><button onClick={() => actualizarStockFisico(i.id)} className={styles.btnVer}>Rectificar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SUBSECTION: RECETAS */}
          {subPestanaProduccion === 'recetas' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={agregarIngredienteReceta} className={styles.formStandard}>
                <h3>🍳 Crear / Vincular Receta</h3>
                <div className={styles.grid3Campos}>
                  <select value={prodRecetaSel} onChange={(e) => setProdRecetaSel(e.target.value)} required>
                    <option value="">-- Seleccionar Producto --</option>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <select value={insumoRecetaSel} onChange={(e) => setInsumoRecetaSel(e.target.value)} required>
                    <option value="">-- Seleccionar Insumo --</option>
                    {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                  </select>
                  <input type="number" step="any" placeholder="Cant. Requerida" value={cantRecetaReq} onChange={(e) => setCantRecetaReq(e.target.value)} required />
                </div>
                <button type="submit" className={styles.btnAgregar}>Vincular a Receta</button>
              </form>
            </div>
          )}

          {/* SUBSECTION: PRODUCTOS */}
          {subPestanaProduccion === 'productos' && (
            <div className={styles.paddingBloque}>
              <form onSubmit={guardarProducto} className={styles.formStandard}>
                <h3>{productoEditando ? '✏️ Editar Producto' : '➕ Nuevo Producto del Menú'}</h3>
                <div className={styles.grid2Campos}>
                  <input type="text" placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} required />
                  <input type="number" placeholder="Precio ($)" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} required />
                </div>
                <button type="submit" className={styles.btnAgregar}>{productoEditando ? 'Guardar Cambios' : 'Agregar Al Menú'}</button>
              </form>

              <table className={styles.tablaApp}>
                <thead><tr><th>Producto</th><th>Precio</th><th>Acciones</th></tr></thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>${p.precio.toLocaleString()}</td>
                      <td>
                        <button onClick={() => { setProductoEditando(p); setNuevoNombre(p.nombre); setNuevoPrecio(p.precio.toString()); }} className={styles.btnVer}>✏️</button>
                        <button onClick={async () => { await supabase.from('productos').delete().eq('id', p.id); obtenerProductos(); }} className={styles.btnEliminar}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL IMPRESIÓN FACTURA */}
      {mostrarModalFactura && (
        <div className={styles.overlayModal} onClick={() => setMostrarModalFactura(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>📄 Factura de Venta Generada</h3>
            <p>Venta registrada exitosamente. Puedes imprimir la comanda/ticket ahora.</p>
            <div className={styles.modalActions}>
              <button onClick={() => { window.print(); setMostrarModalFactura(false); }} className={styles.btnCobrar}>🖨️ Imprimir Ticket</button>
              <button onClick={() => setMostrarModalFactura(false)} className={styles.btnAgregar}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}