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




// Promesa de carga inicial: evita mostrar el aviso antes de consultar Firebase.
let cargaInicialProductos = null;

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
    if (cargaInicialProductos) {
      cargaInicialProductos.then(() => poblarSelectorProductos());
    } else {
      poblarSelectorProductos();
    }
    poblarSelectorClientes();
  } else if (seccionId === 'historial') {
    poblarSelectorClientes();
  } else if (seccionId === 'estadisticas') {
    cargarDatosEstadisticas();
  }
}

window.navegarSeccion = navegarSeccion;

// Función de arranque de la aplicación
async function iniciarApp() {
  console.log('Iniciando sistema de Registro de Ventas de Panadería...');

  // ── 1. MÓDULOS DE UI: formularios, modales, filtros ──
  configurarModuloProductos();
  configurarModuloClientes();
  configurarModuloVentas();
  inicializarEstadisticas();

  // ── 2. CARGA DE DATOS FIREBASE ──
  // Esperar a los productos antes de decidir si el catálogo está vacío.
  cargaInicialProductos = cargarProductos().catch(e => console.warn('cargarProductos:', e.message));
  const cargaClientes = cargarClientes().catch(e => console.warn('cargarClientes:', e.message));
  cargarHistorialVentas().catch(e => console.warn('cargarHistorialVentas:', e.message));
  await Promise.all([cargaInicialProductos, cargaClientes]);

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
