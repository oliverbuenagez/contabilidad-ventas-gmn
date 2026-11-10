import { 
  cargarProductos, 
  configurarModuloProductos, 
  obtenerProductosActivos 
} from './productos.js';

import { 
  cargarClientes, 
  configurarModuloClientes, 
  obtenerClientesActivos 
} from './clientes.js';

import { 
  inicializarFormularioVenta, 
  configurarModuloVentas, 
  cargarHistorialVentas, 
  poblarSelectorProductos, 
  poblarSelectorClientes 
} from './ventas.js';

import { 
  inicializarEstadisticas, 
  cargarDatosEstadisticas 
} from './estadisticas.js';

import { notificar, mostrarConfirmacion } from './utilidades.js';
import { db, collection, addDoc, serverTimestamp, Timestamp } from './firebase.js';

// Navegación de secciones
export function navegarSeccion(seccionId) {
  // Ocultar todas las secciones y desmarcar todos los botones
  document.querySelectorAll('.app-seccion').forEach(sec => {
    sec.classList.remove('activa');
  });
  document.querySelectorAll('.nav-link-btn').forEach(btn => {
    btn.classList.remove('activo');
  });

  // Activar la seleccionada
  const targetSec = document.getElementById(`seccion-${seccionId}`);
  if (targetSec) targetSec.classList.add('activa');

  const targetBtn = document.querySelector(`.nav-link-btn[data-seccion="${seccionId}"]`);
  if (targetBtn) targetBtn.classList.add('activo');

  // Acciones específicas al entrar a una sección (recargar datos)
  if (seccionId === 'ventas') {
    poblarSelectorProductos();
    poblarSelectorClientes();
  } else if (seccionId === 'historial') {
    poblarSelectorClientes();
  } else if (seccionId === 'estadisticas') {
    cargarDatosEstadisticas();
  }
}

window.navegarSeccion = navegarSeccion;

// Datos de demostración iniciales (opcional si la base de datos está vacía)
window.cargarDatosDemo = async () => {
  const conf = await mostrarConfirmacion({
    titulo: 'Cargar Datos Iniciales de Ejemplo',
    mensaje: '¿Deseas poblar la base de datos con panes típicos de panadería (croissants, roscas, baguette, etc.), algunos clientes y ventas de muestra para ver el dashboard funcionando de inmediato?',
    botonTexto: 'Sí, cargar ejemplos'
  });

  if (!conf) return;

  try {
    notificar('Cargando productos de ejemplo...', 'info');

    // Panes de muestra
    const panesEjemplo = [
      { nombre: 'Croissant mantequilla', panBase: 'Croissant', presentacion: 'unidad', unidadesPorPaquete: 1, precio: 3000, activo: true },
      { nombre: 'Roscas tradicionales (unidad)', panBase: 'Roscas', presentacion: 'unidad', unidadesPorPaquete: 1, precio: 1500, activo: true },
      { nombre: 'Roscas tradicionales (paquete x5)', panBase: 'Roscas', presentacion: 'paquete', unidadesPorPaquete: 5, precio: 6000, activo: true },
      { nombre: 'Pan Baguette rústico', panBase: 'Baguette', presentacion: 'unidad', unidadesPorPaquete: 1, precio: 4500, activo: true },
      { nombre: 'Pan de Bono caliente', panBase: 'Pan de Bono', presentacion: 'unidad', unidadesPorPaquete: 1, precio: 2000, activo: true },
      { nombre: 'Pan de Bono (paquete x6)', panBase: 'Pan de Bono', presentacion: 'paquete', unidadesPorPaquete: 6, precio: 10000, activo: true },
      { nombre: 'Pan de Queso campesino', panBase: 'Pan de Queso', presentacion: 'unidad', unidadesPorPaquete: 1, precio: 2500, activo: true },
      { nombre: 'Mogolla integral', panBase: 'Mogolla', presentacion: 'unidad', unidadesPorPaquete: 1, precio: 1200, activo: true }
    ];

    const prodRefs = [];
    for (const p of panesEjemplo) {
      const docRef = await addDoc(collection(db, 'productos'), {
        ...p,
        creadoEn: serverTimestamp()
      });
      prodRefs.push({ id: docRef.id, ...p });
    }

    // Clientes de muestra
    const clientesEjemplo = [
      { nombre: 'Marta Gómez', telefono: '3104567890', barrio: 'El Prado', direccion: 'Calle 10 # 4-20', activo: true },
      { nombre: 'Carlos Rodríguez', telefono: '3157891234', barrio: 'Centro', direccion: 'Cra 5 # 12-45', activo: true },
      { nombre: 'Lucía Fernández', telefono: '3209876543', barrio: 'La Castellana', direccion: '', activo: true }
    ];

    const cliRefs = [];
    for (const c of clientesEjemplo) {
      const docRef = await addDoc(collection(db, 'clientes'), {
        ...c,
        creadoEn: serverTimestamp()
      });
      cliRefs.push({ id: docRef.id, ...c });
    }

    // Ventas de muestra para este mes y días recientes
    const hoy = new Date();
    const ventasEjemplo = [
      {
        diasAtras: 0,
        hora: 8,
        min: 30,
        cliente: cliRefs[0],
        lineas: [
          { prod: prodRefs[1], cant: 4, precio: 1500 }, // Roscas
          { prod: prodRefs[4], cant: 2, precio: 2000 }  // Pan de bono
        ]
      },
      {
        diasAtras: 0,
        hora: 9,
        min: 15,
        cliente: null, // Anónimo
        lineas: [
          { prod: prodRefs[0], cant: 2, precio: 3000 },
          { prod: prodRefs[3], cant: 1, precio: 4500 }
        ]
      },
      {
        diasAtras: 1,
        hora: 16,
        min: 45,
        cliente: cliRefs[1],
        lineas: [
          { prod: prodRefs[2], cant: 2, precio: 6000 }, // Roscas x5
          { prod: prodRefs[5], cant: 1, precio: 10000 } // Bono x6
        ]
      },
      {
        diasAtras: 2,
        hora: 10,
        min: 0,
        cliente: cliRefs[2],
        lineas: [
          { prod: prodRefs[6], cant: 3, precio: 2500 },
          { prod: prodRefs[0], cant: 2, precio: 3000 }
        ]
      },
      {
        diasAtras: 3,
        hora: 17,
        min: 30,
        cliente: null,
        lineas: [
          { prod: prodRefs[1], cant: 6, precio: 1500 }
        ]
      }
    ];

    for (const ve of ventasEjemplo) {
      const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ve.diasAtras, ve.hora, ve.min);
      let totalVenta = 0;
      const lineasProcesadas = ve.lineas.map(l => {
        const sub = l.cant * l.precio;
        totalVenta += sub;
        return {
          productoId: l.prod.id,
          nombre: l.prod.nombre,
          panBase: l.prod.panBase,
          presentacion: l.prod.presentacion,
          unidadesPorPaquete: l.prod.unidadesPorPaquete,
          cantidad: l.cant,
          precioUnitario: l.precio,
          subtotal: sub
        };
      });

      await addDoc(collection(db, 'ventas'), {
        fecha: Timestamp.fromDate(f),
        clienteId: ve.cliente ? ve.cliente.id : null,
        clienteNombre: ve.cliente ? ve.cliente.nombre : 'Cliente anónimo',
        estado: 'activa',
        total: totalVenta,
        notas: 'Venta inicial de demostración',
        lineas: lineasProcesadas,
        creadoEn: serverTimestamp()
      });
    }

    notificar('¡Datos de demostración cargados exitosamente!', 'exito');
    
    // Recargar módulos
    await cargarProductos();
    await cargarClientes();
    await cargarHistorialVentas();
    poblarSelectorProductos();
    poblarSelectorClientes();
    await cargarDatosEstadisticas();

  } catch (err) {
    console.error(err);
    notificar('Error al cargar datos demo: ' + err.message, 'error');
  }
};

// Función de arranque de la aplicación
function iniciarApp() {
  console.log('Iniciando sistema de Registro de Ventas de Panadería...');

  // ── 1. MÓDULOS DE UI: formularios, modales, filtros ──
  configurarModuloProductos();
  configurarModuloClientes();
  configurarModuloVentas();
  inicializarEstadisticas();

  // ── 2. CARGA DE DATOS FIREBASE: independiente, no bloquea UI ──
  cargarProductos().catch(e => console.warn('cargarProductos:', e.message));
  cargarClientes().catch(e => console.warn('cargarClientes:', e.message));
  cargarHistorialVentas().catch(e => console.warn('cargarHistorialVentas:', e.message));

  inicializarFormularioVenta();
  poblarSelectorProductos();
  poblarSelectorClientes();
  cargarDatosEstadisticas().catch(e => console.warn('cargarEstadisticas:', e.message));

  console.log('UI lista. Módulos vinculados y datos cargando.');
}

// Si el DOM ya cargó (típico en scripts con type="module"), ejecutamos de una vez
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
  iniciarApp();
}
