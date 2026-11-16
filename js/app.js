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
