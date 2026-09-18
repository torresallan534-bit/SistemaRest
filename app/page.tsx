'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './Calculadora.module.css';

interface Producto {
  id: string;
  nombre: string;
  precio: number;
}

interface Insumo {
  id: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
}

interface RecetaItem {
  id: string;
  producto_id: string;
  insumo_id: string;
  cantidad_requerida: number;
}

interface LineaFactura {
  id: number;
  productoId: string;
  cantidad: number;
}

interface ProductoVenta {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface Venta {
  id: number;
  created_at: string;
  cliente: string;
  documento: string;
  metodo_pago: string;
  total: number;
  productos: ProductoVenta[];
}

export default function Home() {
  const [pestanaActiva, setPestanaActiva] = useState<'pos' | 'historial' | 'menu' | 'inventario'>('pos');

  // Datos principales
  const [productos, setProductos] = useState<Producto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<RecetaItem[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);

  // Modal POS
  const [mostrarModalNuevaVenta, setMostrarModalNuevaVenta] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [lineas, setLineas] = useState<LineaFactura[]>([{ id: 1, productoId: '', cantidad: 1 }]);
  const [cliente, setCliente] = useState({ nombre: '', documento: '' });
  const [total, setTotal] = useState<number>(0);

  // Modales
  const [mostrarModalFactura, setMostrarModalFactura] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);

  // Gestión de Menú
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  // Gestión Insumos / Materia Prima
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('');
  const [nuevoInsumoUnidad, setNuevoInsumoUnidad] = useState('g');
  const [nuevoInsumoStock, setNuevoInsumoStock] = useState('');

  // Gestión Recetas
  const [prodRecetaSel, setProdRecetaSel] = useState('');
  const [insumoRecetaSel, setInsumoRecetaSel] = useState('');
  const [cantRecetaReq, setCantRecetaReq] = useState('');

  // Arqueo / Conteo manual
  const [conteosFisicos, setConteosFisicos] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    obtenerProductos();
    obtenerInsumos();
    obtenerRecetas();
    obtenerVentas();
  };

  useEffect(() => {
    const sumaTotal = lineas.reduce((acc, fila) => {
      const prod = productos.find((p) => p.id === fila.productoId);
      return acc + (prod ? prod.precio : 0) * fila.cantidad;
    }, 0);
    setTotal(sumaTotal);
  }, [lineas, productos]);

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

  // Métricas POS
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

  // Registrar Venta + Descuenta Insumos automáticamente
  const abrirNuevaVenta = () => {
    setCliente({ nombre: '', documento: '' });
    setLineas([{ id: Date.now(), productoId: '', cantidad: 1 }]);
    setMetodoPago('Efectivo');
    setMostrarModalNuevaVenta(true);
  };

  const guardarVenta = async () => {
    const productosValidos = lineas
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

    if (productosValidos.length === 0) {
      alert('Selecciona al menos un producto');
      return;
    }

    // 1. Descontar materia prima de Supabase según las recetas
    for (const pVal of productosValidos) {
      const ingredientes = recetas.filter((r) => r.producto_id === pVal.productoId);
      for (const ing of ingredientes) {
        const insumoObj = insumos.find((i) => i.id === ing.insumo_id);
        if (insumoObj) {
          const consumoTotal = Number(ing.cantidad_requerida) * pVal.cantidad;
          const nuevoStock = Number(insumoObj.stock_actual) - consumoTotal;

          await supabase
            .from('insumos')
            .update({ stock_actual: nuevoStock })
            .eq('id', insumoObj.id);
        }
      }
    }

    // 2. Registrar venta
    const nuevaVenta = {
      cliente: cliente.nombre || 'Consumidor Final',
      documento: cliente.documento || 'N/A',
      metodo_pago: metodoPago,
      productos: productosValidos.map(({ productoId, ...resto }) => resto),
      total: total,
    };

    const { error } = await supabase.from('ventas').insert([nuevaVenta]);

    if (error) {
      alert('Error al guardar la venta: ' + error.message);
    } else {
      await cargarTodo();
      setMostrarModalNuevaVenta(false);
      setMostrarModalFactura(true);
    }
  };

  const imprimirYFinalizar = () => {
    window.print();
    setMostrarModalFactura(false);
  };

  // Crear o editar Insumo
  const guardarInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoInsumoNombre.trim() || !nuevoInsumoStock) return;

    await supabase.from('insumos').insert([
      {
        nombre: nuevoInsumoNombre,
        unidad: nuevoInsumoUnidad,
        stock_actual: parseFloat(nuevoInsumoStock),
      },
    ]);

    setNuevoInsumoNombre('');
    setNuevoInsumoStock('');
    obtenerInsumos();
  };

  const eliminarInsumo = async (id: string) => {
    if (!confirm('¿Eliminar este insumo?')) return;
    await supabase.from('insumos').delete().eq('id', id);
    obtenerInsumos();
  };

  // Guardar Ingrediente a Receta
  const agregarIngredienteReceta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodRecetaSel || !insumoRecetaSel || !cantRecetaReq) return;

    await supabase.from('recetas').insert([
      {
        producto_id: prodRecetaSel,
        insumo_id: insumoRecetaSel,
        cantidad_requerida: parseFloat(cantRecetaReq),
      },
    ]);

    setCantRecetaReq('');
    obtenerRecetas();
  };

  const eliminarIngredienteReceta = async (id: string) => {
    await supabase.from('recetas').delete().eq('id', id);
    obtenerRecetas();
  };

  // Guardar Arqueo Físico
  const actualizarStockFisico = async (insumoId: string) => {
    const valor = conteosFisicos[insumoId];
    if (valor === undefined || valor === '') return;

    await supabase
      .from('insumos')
      .update({ stock_actual: parseFloat(valor) })
      .eq('id', insumoId);

    setConteosFisicos((prev) => ({ ...prev, [insumoId]: '' }));
    obtenerInsumos();
    alert('Stock rectificado exitosamente');
  };

  // Gestión de Menú
  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || !nuevoPrecio) return;
    const precioNum = parseFloat(nuevoPrecio);

    if (productoEditando) {
      await supabase.from('productos').update({ nombre: nuevoNombre, precio: precioNum }).eq('id', productoEditando.id);
      setProductoEditando(null);
    } else {
      await supabase.from('productos').insert([{ nombre: nuevoNombre, precio: precioNum }]);
    }

    setNuevoNombre('');
    setNuevoPrecio('');
    obtenerProductos();
  };

  const eliminarProducto = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await supabase.from('productos').delete().eq('id', id);
    obtenerProductos();
  };

  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '';
    return new Date(fechaISO).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.contenedor}>
      {/* Navegación Principal */}
      <div className={styles.pestanasContenedor}>
        <button
          type="button"
          className={`${styles.botonPestana} ${pestanaActiva === 'pos' ? styles.pestanaActiva : ''}`}
          onClick={() => setPestanaActiva('pos')}
        >
          🏪 Zona POS
        </button>
        <button
          type="button"
          className={`${styles.botonPestana} ${pestanaActiva === 'inventario' ? styles.pestanaActiva : ''}`}
          onClick={() => {
            cargarTodo();
            setPestanaActiva('inventario');
          }}
        >
          📦 Insumos / Inventario ({insumos.length})
        </button>
        <button
          type="button"
          className={`${styles.botonPestana} ${pestanaActiva === 'menu' ? styles.pestanaActiva : ''}`}
          onClick={() => {
            obtenerProductos();
            setPestanaActiva('menu');
          }}
        >
          🍔 Menú / Productos ({productos.length})
        </button>
        <button
          type="button"
          className={`${styles.botonPestana} ${pestanaActiva === 'historial' ? styles.pestanaActiva : ''}`}
          onClick={() => {
            obtenerVentas();
            setPestanaActiva('historial');
          }}
        >
          📋 Historial ({ventas.length})
        </button>
      </div>

      {/* PESTAÑA 1: ZONA POS */}
      {pestanaActiva === 'pos' && (
        <>
          <div className={styles.cabeceraContenedor}>
            <div>
              <h2 className={styles.titulo}>Panel de Ventas del Día</h2>
              <p style={{ color: '#6b7280', marginTop: '4px' }}>Resumen de caja y registro de operaciones</p>
            </div>
            <button type="button" className={styles.botonFactura} onClick={abrirNuevaVenta}>
              ⚡ INICIAR NUEVA VENTA
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '12px', borderLeft: '5px solid #2563eb' }}>
              <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 'bold' }}>Total Vendido Hoy</span>
              <h3 style={{ fontSize: '24px', margin: '6px 0 0', color: '#111827' }}>${totalHoy.toLocaleString()}</h3>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{ventasHoy.length} venta(s)</span>
            </div>
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '12px', borderLeft: '5px solid #16a34a' }}>
              <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 'bold' }}>💵 Efectivo</span>
              <h3 style={{ fontSize: '22px', margin: '6px 0 0', color: '#16a34a' }}>${totalEfectivoHoy.toLocaleString()}</h3>
            </div>
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '12px', borderLeft: '5px solid #9333ea' }}>
              <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 'bold' }}>💳 Tarjetas</span>
              <h3 style={{ fontSize: '22px', margin: '6px 0 0', color: '#9333ea' }}>${totalTarjetaHoy.toLocaleString()}</h3>
            </div>
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '12px', borderLeft: '5px solid #ea580c' }}>
              <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 'bold' }}>📲 Transferencias</span>
              <h3 style={{ fontSize: '22px', margin: '6px 0 0', color: '#ea580c' }}>${totalTransferenciaHoy.toLocaleString()}</h3>
            </div>
          </div>

          <div className={styles.seccionHistorial}>
            <h3 className={styles.subtituloSeccion}>Últimas ventas del día</h3>
            {ventasHoy.length === 0 ? (
              <p className={styles.textoVacio}>Aún no se han registrado ventas el día de hoy.</p>
            ) : (
              <table className={styles.tablaHistorial}>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasHoy.map((v) => (
                    <tr key={v.id}>
                      <td>{formatearFecha(v.created_at).split(',')[1] || formatearFecha(v.created_at)}</td>
                      <td>{v.cliente}</td>
                      <td>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: v.metodo_pago === 'Tarjeta' ? '#f3e8ff' : v.metodo_pago === 'Transferencia' ? '#ffedd5' : '#dcfce7',
                            color: v.metodo_pago === 'Tarjeta' ? '#7e22ce' : v.metodo_pago === 'Transferencia' ? '#c2410c' : '#15803d',
                          }}
                        >
                          {v.metodo_pago || 'Efectivo'}
                        </span>
                      </td>
                      <td><strong>${v.total ? v.total.toLocaleString() : 0}</strong></td>
                      <td>
                        <button type="button" className={styles.botonVerDetalle} onClick={() => setVentaSeleccionada(v)}>
                          👁️ Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* PESTAÑA 2: INVENTARIO Y RECETAS */}
      {pestanaActiva === 'inventario' && (
        <div className={styles.seccionHistorial}>
          <h2 className={styles.titulo}>Control de Materia Prima e Inventario</h2>

          {/* Formulario Agregar Insumo */}
          <form onSubmit={guardarInsumo} style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', marginBottom: '25px' }}>
            <h4 className={styles.subtituloSeccion}>➕ Registrar Nueva Materia Prima / Insumo</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className={styles.label}>Nombre Insumo</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ej: Carne de Res, Pan Burger, Queso Cheddar"
                  value={nuevoInsumoNombre}
                  onChange={(e) => setNuevoInsumoNombre(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={styles.label}>Unidad Medida</label>
                <select className={styles.select} value={nuevoInsumoUnidad} onChange={(e) => setNuevoInsumoUnidad(e.target.value)}>
                  <option value="g">Gramos (g)</option>
                  <option value="kg">Kilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="L">Litros (L)</option>
                  <option value="unidades">Unidades</option>
                </select>
              </div>
              <div>
                <label className={styles.label}>Stock Inicial</label>
                <input
                  type="number"
                  step="any"
                  className={styles.input}
                  placeholder="Ej: 5000"
                  value={nuevoInsumoStock}
                  onChange={(e) => setNuevoInsumoStock(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className={styles.botonVerDetalle} style={{ marginTop: '12px' }}>
              Guardar Insumo
            </button>
          </form>

          {/* Formulario Asignar Receta */}
          <form onSubmit={agregarIngredienteReceta} style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', marginBottom: '25px' }}>
            <h4 className={styles.subtituloSeccion}>🍳 Definir Consumo por Producto (Receta)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className={styles.label}>Producto del Menú</label>
                <select className={styles.select} value={prodRecetaSel} onChange={(e) => setProdRecetaSel(e.target.value)} required>
                  <option value="">-- Seleccionar --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.label}>Insumo que Consume</label>
                <select className={styles.select} value={insumoRecetaSel} onChange={(e) => setInsumoRecetaSel(e.target.value)} required>
                  <option value="">-- Seleccionar --</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.label}>Cantidad por Venta</label>
                <input
                  type="number"
                  step="any"
                  className={styles.input}
                  placeholder="Ej: 150 (g) o 1 (unid)"
                  value={cantRecetaReq}
                  onChange={(e) => setCantRecetaReq(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className={styles.botonVerDetalle} style={{ marginTop: '12px', backgroundColor: '#2563eb' }}>
              ＋ Vincular a la Receta
            </button>
          </form>

          {/* Tabla de Arqueo Diario e Inventario Teórico vs. Real */}
          <h3 className={styles.subtituloSeccion}>📋 Arqueo Diario e Inventario Actual</h3>
          <table className={styles.tablaHistorial}>
            <thead>
              <tr>
                <th>Materia Prima</th>
                <th>Stock Teórico (Sistema)</th>
                <th>Receta / Consumos</th>
                <th>Conteo Físico Real</th>
                <th>Acción / Rectificar</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => {
                const recetasUso = recetas.filter((r) => r.insumo_id === i.id);
                const valorConteo = conteosFisicos[i.id] ?? '';
                const diferencia = valorConteo !== '' ? parseFloat(valorConteo) - Number(i.stock_actual) : null;

                return (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.nombre}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: i.stock_actual <= 0 ? '#dc2626' : '#111827' }}>
                        {Number(i.stock_actual).toLocaleString()} {i.unidad}
                      </span>
                    </td>
                    <td>
                      <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '12px' }}>
                        {recetasUso.length === 0 ? (
                          <span style={{ color: '#9ca3af' }}>Sin vincular</span>
                        ) : (
                          recetasUso.map((ru) => {
                            const p = productos.find((prod) => prod.id === ru.producto_id);
                            return (
                              <li key={ru.id}>
                                {p ? p.nombre : 'Prod'}: {ru.cantidad_requerida} {i.unidad}
                                <button
                                  type="button"
                                  onClick={() => eliminarIngredienteReceta(ru.id)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: '4px' }}
                                >
                                  ✕
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ingresar físico"
                        className={styles.input}
                        style={{ width: '130px', padding: '6px' }}
                        value={valorConteo}
                        onChange={(e) => setConteosFisicos({ ...conteosFisicos, [i.id]: e.target.value })}
                      />
                      {diferencia !== null && (
                        <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: 'bold', color: diferencia < 0 ? '#dc2626' : '#16a34a' }}>
                          {diferencia === 0 ? '✅ Sin diferencia' : diferencia < 0 ? `⚠️ Falta: ${diferencia} ${i.unidad}` : `➕ Sobra: +${diferencia} ${i.unidad}`}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" className={styles.botonVerDetalle} onClick={() => actualizarStockFisico(i.id)}>
                          💾 Guardar
                        </button>
                        <button type="button" className={styles.botonEliminar} style={{ position: 'static' }} onClick={() => eliminarInsumo(i.id)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 3: MENÚ / PRODUCTOS */}
      {pestanaActiva === 'menu' && (
        <div className={styles.seccionHistorial}>
          <h2 className={styles.titulo}>Gestión del Menú de Productos</h2>
          <form onSubmit={guardarProducto} style={{ marginBottom: '25px' }}>
            <h4 className={styles.subtituloSeccion}>{productoEditando ? '✏️ Editar Producto' : '➕ Agregar Nuevo Producto'}</h4>
            <div className={styles.gridCliente}>
              <div>
                <label className={styles.label}>Nombre del Producto</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ej: Hamburguesa Doble"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={styles.label}>Precio ($)</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="Ej: 25000"
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="submit" className={styles.botonVerDetalle}>
                {productoEditando ? 'Guardar Cambios' : '➕ Agregar al Menú'}
              </button>
              {productoEditando && (
                <button
                  type="button"
                  className={styles.botonReiniciar}
                  onClick={() => {
                    setProductoEditando(null);
                    setNuevoNombre('');
                    setNuevoPrecio('');
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <table className={styles.tablaHistorial}>
            <thead>
              <tr>
                <th>Nombre del Producto</th>
                <th>Precio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>${p.precio.toLocaleString()}</td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={styles.botonVerDetalle}
                      onClick={() => {
                        setProductoEditando(p);
                        setNuevoNombre(p.nombre);
                        setNuevoPrecio(p.precio.toString());
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button type="button" className={styles.botonEliminar} onClick={() => eliminarProducto(p.id)} style={{ position: 'static' }}>
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 4: HISTORIAL GENERAL */}
      {pestanaActiva === 'historial' && (
        <div className={styles.seccionHistorial}>
          <h2 className={styles.titulo}>Historial General de Ventas</h2>
          {ventas.length === 0 ? (
            <p className={styles.textoVacio}>No hay ventas registradas aún.</p>
          ) : (
            <table className={styles.tablaHistorial}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Método de Pago</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td>{formatearFecha(v.created_at)}</td>
                    <td>{v.cliente}</td>
                    <td>{v.documento}</td>
                    <td>{v.metodo_pago || 'Efectivo'}</td>
                    <td><strong>${v.total ? v.total.toLocaleString() : 0}</strong></td>
                    <td>
                      <button type="button" className={styles.botonVerDetalle} onClick={() => setVentaSeleccionada(v)}>
                        👁️ Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODAL POS (NUEVA VENTA) */}
      {mostrarModalNuevaVenta && (
        <div className={styles.overlayModal} onClick={() => setMostrarModalNuevaVenta(false)}>
          <div className={styles.contenidoModal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div className={styles.cabeceraModal}>
              <h3 className={styles.resumenFactura}>🧮 Nueva Venta / POS</h3>
              <button type="button" className={styles.botonCerrarModal} onClick={() => setMostrarModalNuevaVenta(false)}>
                ✕
              </button>
            </div>

            <div className={styles.cuerpoModal}>
              <div className={styles.gridCliente} style={{ marginBottom: '15px' }}>
                <div>
                  <label className={styles.label}>Cliente</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ej: Juan Pérez"
                    value={cliente.nombre}
                    onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <label className={styles.label}>Cédula / NIT</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ej: 1018234567"
                    value={cliente.documento}
                    onChange={(e) => setCliente({ ...cliente, documento: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label className={styles.label}>Método de Pago</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  {(['Efectivo', 'Tarjeta', 'Transferencia'] as const).map((metodo) => (
                    <button
                      key={metodo}
                      type="button"
                      onClick={() => setMetodoPago(metodo)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: metodoPago === metodo ? '2px solid #2563eb' : '1px solid #d1d5db',
                        backgroundColor: metodoPago === metodo ? '#eff6ff' : '#ffffff',
                        fontWeight: metodoPago === metodo ? 'bold' : 'normal',
                        color: metodoPago === metodo ? '#1d4ed8' : '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      {metodo === 'Efectivo' && '💵 '}
                      {metodo === 'Tarjeta' && '💳 '}
                      {metodo === 'Transferencia' && '📲 '}
                      {metodo}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.listaFilas}>
                {lineas.map((fila, index) => {
                  const prodSel = productos.find((p) => p.id === fila.productoId);
                  const subtotalFila = prodSel ? prodSel.precio * fila.cantidad : 0;

                  return (
                    <div key={fila.id} className={styles.filaHorizontal}>
                      <div className={styles.columnaProducto}>
                        <label className={styles.label}>Producto {index + 1}</label>
                        <select
                          className={styles.select}
                          value={fila.productoId}
                          onChange={(e) => {
                            const nuevas = [...lineas];
                            nuevas[index].productoId = e.target.value;
                            setLineas(nuevas);
                          }}
                        >
                          <option value="">-- Seleccionar --</option>
                          {productos.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.nombre} (${prod.precio.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.columnaCantidad}>
                        <label className={styles.label}>Cant.</label>
                        <div className={styles.controlCantidad}>
                          <button
                            type="button"
                            className={styles.botonCantidad}
                            disabled={fila.cantidad <= 1}
                            onClick={() => {
                              const nuevas = [...lineas];
                              if (nuevas[index].cantidad > 1) nuevas[index].cantidad -= 1;
                              setLineas(nuevas);
                            }}
                          >
                            -
                          </button>
                          <span className={styles.numeroCantidad}>{fila.cantidad}</span>
                          <button
                            type="button"
                            className={styles.botonCantidad}
                            onClick={() => {
                              const nuevas = [...lineas];
                              nuevas[index].cantidad += 1;
                              setLineas(nuevas);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className={styles.columnaSubtotal}>
                        <span className={styles.label}>Subtotal</span>
                        <span className={styles.montoSubtotal}>${subtotalFila.toLocaleString()}</span>
                      </div>

                      {lineas.length > 1 && (
                        <button
                          type="button"
                          className={styles.botonEliminar}
                          onClick={() => setLineas(lineas.filter((f) => f.id !== fila.id))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className={styles.botonAgregar}
                onClick={() => setLineas([...lineas, { id: Date.now(), productoId: '', cantidad: 1 }])}
              >
                ＋ Agregar otro producto
              </button>

              <div className={styles.totalContenedor}>
                <span>Total a Cobrar:</span>
                <strong>${total.toLocaleString()}</strong>
              </div>
            </div>

            <div className={styles.pieModal}>
              <button type="button" className={styles.botonFactura} onClick={guardarVenta}>
                ✅ Registrar Venta y Descontar Insumos
              </button>
              <button type="button" className={styles.botonCerrarSecundario} onClick={() => setMostrarModalNuevaVenta(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FACTURA */}
      {mostrarModalFactura && (
        <div className={styles.overlayModal} onClick={() => setMostrarModalFactura(false)}>
          <div className={styles.contenidoModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cabeceraModal}>
              <div>
                <h3 className={styles.resumenFactura}>Factura de Venta</h3>
                <span className={styles.fechaFactura}>{new Date().toLocaleDateString('es-CO')}</span>
              </div>
              <button type="button" className={`${styles.botonCerrarModal} ${styles.noImprimir}`} onClick={() => setMostrarModalFactura(false)}>
                ✕
              </button>
            </div>

            <div className={styles.cuerpoModal}>
              <div className={styles.datosEmpresa}>
                <strong className={styles.nombreEmpresa}>Mi Negocio S.A.S.</strong>
                <span>Método de Pago: {metodoPago}</span>
              </div>

              {(cliente.nombre || cliente.documento) && (
                <div className={styles.datosClienteFactura}>
                  <strong>Cliente:</strong> {cliente.nombre || 'Consumidor Final'}
                  {cliente.documento && (
                    <span>
                      {' '}
                      | <strong>CC/NIT:</strong> {cliente.documento}
                    </span>
                  )}
                </div>
              )}

              <table className={styles.tablaFactura}>
                <thead>
                  <tr>
                    <th>Cant.</th>
                    <th>Producto</th>
                    <th>P. Unitario</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas
                    .filter((f) => f.productoId !== '')
                    .map((fila) => {
                      const prod = productos.find((p) => p.id === fila.productoId);
                      return (
                        <tr key={fila.id}>
                          <td>{fila.cantidad}</td>
                          <td>{prod ? prod.nombre : ''}</td>
                          <td>${prod ? prod.precio.toLocaleString() : 0}</td>
                          <td>${prod ? (prod.precio * fila.cantidad).toLocaleString() : 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              <div className={styles.totalFactura}>
                <span>Total Pagado:</span>
                <strong>${total.toLocaleString()}</strong>
              </div>
            </div>

            <div className={`${styles.pieModal} ${styles.noImprimir}`}>
              <button type="button" className={styles.botonImprimir} onClick={imprimirYFinalizar}>
                🖨️ Imprimir Factura
              </button>
              <button type="button" className={styles.botonCerrarSecundario} onClick={() => setMostrarModalFactura(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE VENTA */}
      {ventaSeleccionada && (
        <div className={styles.overlayModal} onClick={() => setVentaSeleccionada(null)}>
          <div className={styles.contenidoModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cabeceraModal}>
              <div>
                <h3 className={styles.resumenFactura}>Detalle Venta #{ventaSeleccionada.id}</h3>
                <span className={styles.fechaFactura}>{formatearFecha(ventaSeleccionada.created_at)}</span>
              </div>
              <button type="button" className={styles.botonCerrarModal} onClick={() => setVentaSeleccionada(null)}>
                ✕
              </button>
            </div>

            <div className={styles.cuerpoModal}>
              <div className={styles.datosClienteFactura}>
                <strong>Cliente:</strong> {ventaSeleccionada.cliente}
                <br />
                <strong>CC/NIT:</strong> {ventaSeleccionada.documento}
                <br />
                <strong>Método de Pago:</strong> {ventaSeleccionada.metodo_pago || 'Efectivo'}
              </div>

              <table className={styles.tablaFactura}>
                <thead>
                  <tr>
                    <th>Cant.</th>
                    <th>Producto</th>
                    <th>P. Unitario</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {ventaSeleccionada.productos && Array.isArray(ventaSeleccionada.productos) ? (
                    ventaSeleccionada.productos.map((item: ProductoVenta, idx: number) => (
                      <tr key={idx}>
                        <td>{item.cantidad}</td>
                        <td>{item.nombre}</td>
                        <td>${item.precioUnitario ? item.precioUnitario.toLocaleString() : 0}</td>
                        <td>${item.subtotal ? item.subtotal.toLocaleString() : 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>Sin detalle disponible.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className={styles.totalFactura}>
                <span>Total:</span>
                <strong>${ventaSeleccionada.total ? ventaSeleccionada.total.toLocaleString() : 0}</strong>
              </div>
            </div>

            <div className={styles.pieModal}>
              <button type="button" className={styles.botonCerrarSecundario} onClick={() => setVentaSeleccionada(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}