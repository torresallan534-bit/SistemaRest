'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './Calculadora.module.css';

const PRODUCTOS_DISPONIBLES = [
  { id: 'prodA', nombre: 'Producto A', precio: 15000 },
  { id: 'prodB', nombre: 'Producto B', precio: 25000 },
  { id: 'prodC', nombre: 'Producto C', precio: 18000 },
  { id: 'prodD', nombre: 'Producto D', precio: 30000 },
];

export default function Calculadora() {
  const [lineas, setLineas] = useState([
    { id: 1, productoId: '', cantidad: 1 }
  ]);
  const [total, setTotal] = useState(0);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [cliente, setCliente] = useState({ nombre: '', documento: '' });
  const [ventas, setVentas] = useState([]);

  // Cargar ventas desde Supabase al montar el componente
  useEffect(() => {
    obtenerVentas();
  }, []);

  useEffect(() => {
    const sumaTotal = lineas.reduce((acc, fila) => {
      const producto = PRODUCTOS_DISPONIBLES.find((p) => p.id === fila.productoId);
      const precio = producto ? producto.precio : 0;
      return acc + (precio * fila.cantidad);
    }, 0);

    setTotal(sumaTotal);
  }, [lineas]);

  const obtenerVentas = async () => {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener ventas:', error.message);
    } else {
      setVentas(data || []);
    }
  };

  const reiniciarFormulario = () => {
    setCliente({ nombre: '', documento: '' });
    setLineas([{ id: Date.now(), productoId: '', cantidad: 1 }]);
  };

  const imprimirYReiniciar = async () => {
    const nuevaVenta = {
      cliente: cliente.nombre || 'Consumidor Final',
      documento: cliente.documento || 'N/A',
      productos: lineas
        .filter((f) => f.productoId !== '')
        .map((f) => {
          const prod = PRODUCTOS_DISPONIBLES.find((p) => p.id === f.productoId);
          return {
            nombre: prod ? prod.nombre : '',
            cantidad: f.cantidad,
            precioUnitario: prod ? prod.precio : 0,
            subtotal: prod ? prod.precio * f.cantidad : 0,
          };
        }),
      total: total,
    };

    // 1. Guardar registro en Supabase
    const { error } = await supabase.from('ventas').insert([nuevaVenta]);

    if (error) {
      alert('Error al guardar la venta en la nube: ' + error.message);
    } else {
      obtenerVentas();
    }

    // 2. Imprimir, cerrar modal y limpiar el formulario
    window.print();
    setMostrarModal(false);
    reiniciarFormulario();
  };

  const agregarFila = () => {
    setLineas([...lineas, { id: Date.now(), productoId: '', cantidad: 1 }]);
  };

  const actualizarProducto = (index, productoId) => {
    const nuevasLineas = [...lineas];
    nuevasLineas[index].productoId = productoId;
    setLineas(nuevasLineas);
  };

  const eliminarFila = (idAEliminar) => {
    if (lineas.length === 1) return;
    setLineas(lineas.filter((fila) => fila.id !== idAEliminar));
  };

  const incrementarCantidad = (index) => {
    const nuevasLineas = [...lineas];
    nuevasLineas[index].cantidad += 1;
    setLineas(nuevasLineas);
  };

  const decrementarCantidad = (index) => {
    const nuevasLineas = [...lineas];
    if (nuevasLineas[index].cantidad > 1) {
      nuevasLineas[index].cantidad -= 1;
      setLineas(nuevasLineas);
    }
  };

  const obtenerFechaActual = () => {
    return new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const productosValidos = lineas.filter((f) => f.productoId !== '');

  return (
    <div className={styles.contenedor}>
      <div className={styles.cabeceraContenedor}>
        <h2 className={styles.titulo}>Calculadora de Precios</h2>
        <button 
          type="button" 
          className={styles.botonReiniciar}
          onClick={reiniciarFormulario}
        >
          🔄 Limpiar todo
        </button>
      </div>

      <div className={styles.seccionCliente}>
        <h4 className={styles.subtituloSeccion}>Datos del Cliente</h4>
        <div className={styles.gridCliente}>
          <div>
            <label className={styles.label}>Nombre / Razón Social</label>
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
      </div>

      <div className={styles.listaFilas}>
        {lineas.map((fila, index) => {
          const productoSeleccionado = PRODUCTOS_DISPONIBLES.find((p) => p.id === fila.productoId);
          const subtotalFila = productoSeleccionado ? productoSeleccionado.precio * fila.cantidad : 0;

          return (
            <div key={fila.id} className={styles.filaHorizontal}>
              <div className={styles.columnaProducto}>
                <label className={styles.label}>Producto {index + 1}</label>
                <select 
                  className={styles.select}
                  value={fila.productoId}
                  onChange={(e) => actualizarProducto(index, e.target.value)}
                >
                  <option value="">-- Seleccionar --</option>
                  {PRODUCTOS_DISPONIBLES.map((prod) => (
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
                    onClick={() => decrementarCantidad(index)}
                    disabled={fila.cantidad <= 1}
                  >
                    -
                  </button>
                  <span className={styles.numeroCantidad}>{fila.cantidad}</span>
                  <button 
                    type="button" 
                    className={styles.botonCantidad}
                    onClick={() => incrementarCantidad(index)}
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
                  onClick={() => eliminarFila(fila.id)}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.botonAgregar} onClick={agregarFila}>
        ＋ Agregar otro producto
      </button>

      <div className={styles.totalContenedor}>
        <span>Total a pagar:</span>
        <strong>${total.toLocaleString()}</strong>
      </div>

      <button 
        type="button" 
        className={styles.botonFactura}
        onClick={() => setMostrarModal(true)}
        disabled={productosValidos.length === 0}
      >
        📄 Generar Factura
      </button>

      {/* Modal Resumen */}
      {mostrarModal && (
        <div className={styles.overlayModal} onClick={() => setMostrarModal(false)}>
          <div className={styles.contenidoModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cabeceraModal}>
              <div>
                <h3 className={styles.resumenFactura}>Resumen de Factura</h3>
                <span className={styles.fechaFactura}>{obtenerFechaActual()}</span>
              </div>
              <button 
                type="button" 
                className={`${styles.botonCerrarModal} ${styles.noImprimir}`}
                onClick={() => setMostrarModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.cuerpoModal}>
              <div className={styles.datosEmpresa}>
                <strong className={styles.nombreEmpresa}>Mi Negocio S.A.S.</strong>
                <span>NIT: 900.123.456-7</span>
              </div>

              {(cliente.nombre || cliente.documento) && (
                <div className={styles.datosClienteFactura}>
                  <strong>Cliente:</strong> {cliente.nombre || 'Consumidor Final'}
                  {cliente.documento && <span> | <strong>CC/NIT:</strong> {cliente.documento}</span>}
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
                  {productosValidos.map((fila) => {
                    const prod = PRODUCTOS_DISPONIBLES.find((p) => p.id === fila.productoId);
                    return (
                      <tr key={fila.id}>
                        <td>{fila.cantidad}</td>
                        <td>{prod.nombre}</td>
                        <td>${prod.precio.toLocaleString()}</td>
                        <td>${(prod.precio * fila.cantidad).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className={styles.totalFactura}>
                <span>Total Final:</span>
                <strong>${total.toLocaleString()}</strong>
              </div>
            </div>

            <div className={`${styles.pieModal} ${styles.noImprimir}`}>
              <button 
                type="button" 
                className={styles.botonImprimir}
                onClick={imprimirYReiniciar}
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button 
                type="button" 
                className={styles.botonCerrarSecundario}
                onClick={() => setMostrarModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}