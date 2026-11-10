import { 
  db, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp 
} from './firebase.js';
import { 
  formatoPesos, 
  formatoFechaHora,
  formatoFechaCorta,
  fechaParaInputDate, 
  toDate, 
  escaparHTML, 
  notificar, 
  mostrarConfirmacion,
  conTimeout 
} from './utilidades.js';
import { obtenerProductosActivos, obtenerProductoPorId } from './productos.js';
import { obtenerClientesActivos, obtenerClientePorId, abrirModalCliente } from './clientes.js';

let lineasVentaActual = [];
let listaVentasHistorial = [];
let ventaEnEdicionId = null;
let guardandoVentaEnProgreso = false;

// Filtros de historial
let filtroFechaDesde = '';
let filtroFechaHasta = '';
let filtroClienteId = 'todos';
let filtroEstadoVenta = 'todas';

export function inicializarFormularioVenta() {
  ventaEnEdicionId = null;
  lineasVentaActual = [];
  
  const form = document.getElementById('form-nueva-venta');
  const inputFecha = document.getElementById('venta-fecha');
  const selCliente = document.getElementById('venta-cliente');
  const inputNotas = document.getElementById('venta-notas');
  const tituloVenta = document.getElementById('titulo-formulario-venta');
  const btnGuardar = document.getElementById('btn-guardar-venta');
  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion-venta');

  if (form) form.reset();
  if (inputFecha) inputFecha.value = fechaParaInputDate(new Date());
  if (inputNotas) inputNotas.value = '';
  if (tituloVenta) tituloVenta.textContent = 'Registrar Nueva Venta';
  if (btnGuardar) btnGuardar.textContent = '💾 Finalizar y Guardar Venta';
  if (btnCancelarEdicion) btnCancelarEdicion.style.display = 'none';

  poblarSelectorClientes();
  renderizarLineasVenta();
  actualizarTotalVenta();
}

export function poblarSelectorClientes(clienteSeleccionadoId = null) {
  const sel = document.getElementById('venta-cliente');
  const selFiltro = document.getElementById('filtro-historial-cliente');
  const clientes = obtenerClientesActivos();

  if (sel) {
    let html = '<option value="">(Cliente anónimo / Venta de mostrador)</option>';
    clientes.forEach(c => {
      const extra = c.barrio ? ` (${c.barrio})` : '';
      html += `<option value="${c.id}">${escaparHTML(c.nombre)}${escaparHTML(extra)}</option>`;
    });
    sel.innerHTML = html;
    if (clienteSeleccionadoId) {
      sel.value = clienteSeleccionadoId;
    }
  }

  if (selFiltro) {
    const valorPrevio = selFiltro.value;
    let htmlFiltro = '<option value="todos">Todos los clientes</option>';
    htmlFiltro += '<option value="anonimo">Solo clientes anónimos</option>';
    clientes.forEach(c => {
      htmlFiltro += `<option value="${c.id}">${escaparHTML(c.nombre)}</option>`;
    });
    selFiltro.innerHTML = htmlFiltro;
    if (valorPrevio) selFiltro.value = valorPrevio;
  }
}

export function poblarSelectorProductos() {
  const sel = document.getElementById('venta-sel-producto');
  const aviso = document.getElementById('aviso-sin-productos');
  const contChips = document.getElementById('contenedor-chips-productos');
  const chipsEl = document.getElementById('chips-productos');
  if (!sel) return;

  const productos = obtenerProductosActivos();
  
  if (productos.length === 0) {
    if (aviso) aviso.style.display = 'block';
    if (contChips) contChips.style.display = 'none';
    sel.innerHTML = '<option value="">-- No hay productos en el catálogo --</option>';
    return;
  }

  if (aviso) aviso.style.display = 'none';
  if (contChips) contChips.style.display = 'block';

  let html = '<option value="">-- Selecciona el pan aquí --</option>';
  productos.forEach(p => {
    const pres = p.presentacion === 'paquete' ? `Paq x${p.unidadesPorPaquete}` : 'Unidad';
    html += `<option value="${p.id}" data-precio="${p.precio}">${escaparHTML(p.nombre)} [${pres}] - ${formatoPesos(p.precio)}</option>`;
  });
  sel.innerHTML = html;

  if (chipsEl) {
    chipsEl.innerHTML = productos.map(p => {
      const pres = p.presentacion === 'paquete' ? `x${p.unidadesPorPaquete}` : '1u';
      return `
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.agregarLineaVentaDirecto('${p.id}')" title="Agregar 1 rápido">
          🍞 ${escaparHTML(p.nombre)} <span class="badge badge-unidad">${pres}</span> <strong>${formatoPesos(p.precio)}</strong>
        </button>
      `;
    }).join('');
  }
}

export function agregarLineaVenta(productoId = null, cantidad = null, precioPersonalizado = null) {
  const productos = obtenerProductosActivos();
  let prod = null;

  if (productoId) {
    prod = obtenerProductoPorId(productoId);
  } else {
    const sel = document.getElementById('venta-sel-producto');
    if (!sel || !sel.value) {
      notificar('Selecciona un pan primero en la lista', 'info');
      return;
    }
    prod = obtenerProductoPorId(sel.value);
  }

  if (!prod) {
    notificar('Producto no encontrado', 'error');
    return;
  }

  // Leer la cantidad desde el input si no se envió por parámetro
  let cantFinal = cantidad;
  if (cantFinal === null) {
    const inputCant = document.getElementById('venta-input-cantidad');
    cantFinal = inputCant ? (parseInt(inputCant.value) || 1) : 1;
  }
  cantFinal = Math.max(1, cantFinal);

  const precioCobrado = precioPersonalizado !== null ? Number(precioPersonalizado) : Number(prod.precio);

  // Si ya está en la lista de líneas, incrementamos cantidad
  const existente = lineasVentaActual.find(l => l.productoId === prod.id && l.precioUnitario === precioCobrado);
  if (existente) {
    existente.cantidad += cantFinal;
    existente.subtotal = existente.cantidad * existente.precioUnitario;
  } else {
    lineasVentaActual.push({
      productoId: prod.id,
      nombre: prod.nombre,
      panBase: prod.panBase || prod.nombre,
      presentacion: prod.presentacion || 'unidad',
      unidadesPorPaquete: prod.unidadesPorPaquete || 1,
      cantidad: cantFinal,
      precioUnitario: precioCobrado,
      subtotal: cantFinal * precioCobrado
    });
  }

  const sel = document.getElementById('venta-sel-producto');
  if (sel) sel.value = '';

  const inputCant = document.getElementById('venta-input-cantidad');
  if (inputCant) inputCant.value = 1;

  renderizarLineasVenta();
  actualizarTotalVenta();
  notificar(`Agregado: ${cantFinal}x ${prod.nombre}`, 'exito');
}

export function renderizarLineasVenta() {
  const tbody = document.getElementById('tabla-lineas-venta');
  if (!tbody) return;

  if (lineasVentaActual.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center p-4 text-muted">
          No hay productos agregados a esta venta todavía.<br>
          <small>Selecciona un pan arriba y haz clic en "Agregar".</small>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lineasVentaActual.map((linea, index) => {
    const detallePres = linea.presentacion === 'paquete' 
      ? `<span class="badge badge-paquete">Paquete x${linea.unidadesPorPaquete}</span>` 
      : `<span class="badge badge-unidad">Unidad</span>`;

    return `
      <tr>
        <td>
          <div class="fw-bold">${escaparHTML(linea.nombre)}</div>
          <small class="text-muted">${detallePres}</small>
        </td>
        <td style="width: 110px;">
          <input 
            type="number" 
            class="form-control form-control-sm text-center input-cantidad-linea" 
            min="1" 
            value="${linea.cantidad}" 
            onchange="window.actualizarCantidadLinea(${index}, this.value)"
          >
        </td>
        <td style="width: 140px;">
          <div class="input-group input-group-sm">
            <span class="input-group-text">$</span>
            <input 
              type="number" 
              class="form-control form-control-sm text-end input-precio-linea" 
              min="0" 
              step="50"
              value="${linea.precioUnitario}" 
              onchange="window.actualizarPrecioLinea(${index}, this.value)"
            >
          </div>
        </td>
        <td class="text-end fw-bold text-nowrap" style="width: 130px;">
          ${formatoPesos(linea.subtotal)}
        </td>
        <td class="text-center" style="width: 50px;">
          <button class="btn btn-outline-danger btn-sm" onclick="window.quitarLineaVenta(${index})" title="Quitar">
            ✕
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

export function actualizarTotalVenta() {
  const total = lineasVentaActual.reduce((acc, l) => acc + (l.subtotal || 0), 0);
  const el = document.getElementById('venta-total-display');
  if (el) el.textContent = formatoPesos(total);
  return total;
}

export async function guardarVenta() {
  if (guardandoVentaEnProgreso) {
    console.warn('Ya hay un guardado en curso, evitando guardado doble');
    return;
  }

  // Si no ha añadido a la tabla pero ya eligió un pan en el selector, lo agregamos de una vez
  const selProd = document.getElementById('venta-sel-producto');
  if ((!lineasVentaActual || lineasVentaActual.length === 0) && selProd && selProd.value) {
    agregarLineaVenta();
  }

  if (!lineasVentaActual || lineasVentaActual.length === 0) {
    notificar('Elige un pan y agrégalo a la cuenta antes de cobrar', 'info');
    return;
  }

  guardandoVentaEnProgreso = true;
  console.log('Ejecutando guardarVenta...', { lineas: lineasVentaActual.length });

  const inputFecha = document.getElementById('venta-fecha');
  const selCliente = document.getElementById('venta-cliente');
  const inputNotas = document.getElementById('venta-notas');
  const btnGuardar = document.getElementById('btn-guardar-venta');

  // Asegurar fecha válida (solo fecha)
  let fechaVal = new Date();
  if (inputFecha && inputFecha.value) {
    const partes = inputFecha.value.split('-');
    if (partes.length === 3) {
      fechaVal = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]), 12, 0, 0);
    }
  }

  const clienteId = (selCliente && selCliente.value) ? selCliente.value : null;
  
  let clienteNombre = 'Cliente anónimo';
  if (clienteId) {
    const cli = obtenerClientePorId(clienteId);
    if (cli && cli.nombre) clienteNombre = cli.nombre;
  }

  const notas = inputNotas ? inputNotas.value.trim() : '';
  const total = actualizarTotalVenta();

  // Asegurar datos 100% limpios sin campos undefined (Firestore rechaza campos undefined)
  const datosVenta = {
    fecha: Timestamp.fromDate(fechaVal),
    clienteId: clienteId || null,
    clienteNombre: clienteNombre || 'Cliente anónimo',
    total: Math.max(0, Math.round(Number(total) || 0)),
    estado: 'activa',
    notas: notas || '',
    lineas: lineasVentaActual.map(l => ({
      productoId: l.productoId || '',
      nombre: l.nombre || 'Pan',
      panBase: l.panBase || l.nombre || 'Pan',
      presentacion: l.presentacion || 'unidad',
      unidadesPorPaquete: Number(l.unidadesPorPaquete) || 1,
      cantidad: Math.max(1, Number(l.cantidad) || 1),
      precioUnitario: Math.max(0, Math.round(Number(l.precioUnitario) || 0)),
      subtotal: Math.max(0, Math.round(Number(l.subtotal) || 0))
    }))
  };

  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando venta...';
  }

  try {
    if (ventaEnEdicionId) {
      datosVenta.actualizadoEn = serverTimestamp();
      await conTimeout(updateDoc(doc(db, 'ventas', ventaEnEdicionId), datosVenta));
      notificar('Venta actualizada exitosamente', 'exito');
    } else {
      datosVenta.creadoEn = serverTimestamp();
      await conTimeout(addDoc(collection(db, 'ventas'), datosVenta));
      notificar('¡Venta registrada con éxito!', 'exito');
    }

    inicializarFormularioVenta();
    await cargarHistorialVentas();
    window.dispatchEvent(new CustomEvent('ventas-actualizadas'));
  } catch (err) {
    console.error('Error al guardar venta:', err);
    notificar('Error al guardar la venta: ' + err.message, 'error');
  } finally {
    guardandoVentaEnProgreso = false;
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.textContent = ventaEnEdicionId ? 'Guardar Cambios de Venta' : '💾 Cobrar y Guardar Venta';
    }
  }
}

// Exponer globalmente para que funcione siempre
window.guardarVenta = guardarVenta;
window.agregarLineaVenta = agregarLineaVenta;

export async function cargarHistorialVentas() {
  const tbody = document.getElementById('tabla-historial-ventas');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Cargando ventas...</td></tr>';

  try {
    const colRef = collection(db, 'ventas');
    const q = query(colRef, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);

    listaVentasHistorial = [];
    snapshot.forEach(d => {
      listaVentasHistorial.push({ id: d.id, ...d.data() });
    });

    renderizarHistorialVentas();
  } catch (err) {
    console.error('Error al cargar ventas:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-danger">Error: ${escaparHTML(err.message)}</td></tr>`;
    notificar('No se pudo cargar el historial de ventas', 'error');
  }
}

export function obtenerListaVentasHistorial() {
  return listaVentasHistorial;
}

export function renderizarHistorialVentas() {
  const tbody = document.getElementById('tabla-historial-ventas');
  const contadorEl = document.getElementById('historial-conteo-ventas');
  const totalFiltradoEl = document.getElementById('historial-total-filtrado');
  if (!tbody) return;

  const fDesde = filtroFechaDesde ? new Date(filtroFechaDesde + 'T00:00:00') : null;
  const fHasta = filtroFechaHasta ? new Date(filtroFechaHasta + 'T23:59:59') : null;

  let filtradas = listaVentasHistorial.filter(v => {
    const fVenta = toDate(v.fecha);
    if (fDesde && fVenta < fDesde) return false;
    if (fHasta && fVenta > fHasta) return false;

    if (filtroEstadoVenta === 'activas' && v.estado === 'anulada') return false;
    if (filtroEstadoVenta === 'anuladas' && v.estado !== 'anulada') return false;

    if (filtroClienteId !== 'todos') {
      if (filtroClienteId === 'anonimo') {
        if (v.clienteId) return false;
      } else {
        if (v.clienteId !== filtroClienteId) return false;
      }
    }

    return true;
  });

  const totalActivasFiltradas = filtradas
    .filter(v => v.estado !== 'anulada')
    .reduce((acc, v) => acc + (v.total || 0), 0);

  if (contadorEl) contadorEl.textContent = `${filtradas.length} venta${filtradas.length === 1 ? '' : 's'}`;
  if (totalFiltradoEl) totalFiltradoEl.textContent = formatoPesos(totalActivasFiltradas);

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">No se encontraron ventas con los filtros seleccionados</td></tr>';
    return;
  }

  tbody.innerHTML = filtradas.map(v => {
    const anulada = v.estado === 'anulada';
    const numItems = (v.lineas || []).reduce((acc, l) => acc + (l.cantidad || 0), 0);
    const detalleResumen = (v.lineas || []).map(l => `${l.cantidad}x ${l.nombre}`).join(', ');

    return `
      <tr class="${anulada ? 'fila-anulada' : ''}">
        <td>
          <div class="fw-bold">${formatoFechaCorta(v.fecha)}</div>
          <small class="text-muted" title="${escaparHTML(detalleResumen)}">
            ${numItems} artículo${numItems === 1 ? '' : 's'}: ${escaparHTML(detalleResumen.substring(0, 45))}${detalleResumen.length > 45 ? '...' : ''}
          </small>
        </td>
        <td>
          <span class="cliente-nombre-pill">${escaparHTML(v.clienteNombre || 'Cliente anónimo')}</span>
        </td>
        <td class="text-end fw-bold fs-6 ${anulada ? 'text-decoration-line-through text-muted' : 'text-success'}">
          ${formatoPesos(v.total)}
        </td>
        <td class="text-center">
          <span class="status-pill status-${v.estado || 'activa'}">
            ${v.estado === 'anulada' ? 'Anulada' : 'Activa'}
          </span>
        </td>
        <td class="text-end">
          <div class="btn-group-sm">
            <button class="btn btn-outline-info btn-sm" onclick="window.verDetalleVenta('${v.id}')" title="Ver Detalle">
              👁️
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.cargarVentaParaEditar('${v.id}')" title="Editar">
              ✏️
            </button>
            ${!anulada ? `
              <button class="btn btn-outline-warning btn-sm" onclick="window.cambiarEstadoVenta('${v.id}', 'anulada')" title="Anular venta">
                🚫
              </button>
            ` : `
              <button class="btn btn-outline-success btn-sm" onclick="window.cambiarEstadoVenta('${v.id}', 'activa')" title="Reactivar venta">
                ♻️
              </button>
            `}
            <button class="btn btn-outline-danger btn-sm" onclick="window.eliminarVenta('${v.id}')" title="Eliminar definitivamente">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function configurarModuloVentas() {
  const btnAgregar = document.getElementById('btn-agregar-linea-venta');
  const btnGuardar = document.getElementById('btn-guardar-venta');
  const btnClienteRapido = document.getElementById('btn-venta-crear-cliente-rapido');
  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion-venta');

  // Filtros de historial
  const fDesde = document.getElementById('filtro-historial-desde');
  const fHasta = document.getElementById('filtro-historial-hasta');
  const fCli = document.getElementById('filtro-historial-cliente');
  const fEst = document.getElementById('filtro-historial-estado');
  const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros-ventas');

  if (btnAgregar) {
    btnAgregar.onclick = () => agregarLineaVenta();
  }

  if (btnGuardar) {
    btnGuardar.onclick = () => guardarVenta();
  }

  if (btnClienteRapido) {
    btnClienteRapido.addEventListener('click', () => {
      abrirModalCliente(null, (nuevoCliente) => {
        poblarSelectorClientes(nuevoCliente.id);
      });
    });
  }

  if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener('click', () => {
      inicializarFormularioVenta();
      notificar('Edición cancelada', 'info');
    });
  }

  if (fDesde) {
    fDesde.addEventListener('change', (e) => {
      filtroFechaDesde = e.target.value;
      renderizarHistorialVentas();
    });
  }

  if (fHasta) {
    fHasta.addEventListener('change', (e) => {
      filtroFechaHasta = e.target.value;
      renderizarHistorialVentas();
    });
  }

  if (fCli) {
    fCli.addEventListener('change', (e) => {
      filtroClienteId = e.target.value;
      renderizarHistorialVentas();
    });
  }

  if (fEst) {
    fEst.addEventListener('change', (e) => {
      filtroEstadoVenta = e.target.value;
      renderizarHistorialVentas();
    });
  }

  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener('click', () => {
      filtroFechaDesde = '';
      filtroFechaHasta = '';
      filtroClienteId = 'todos';
      filtroEstadoVenta = 'todas';

      if (fDesde) fDesde.value = '';
      if (fHasta) fHasta.value = '';
      if (fCli) fCli.value = 'todos';
      if (fEst) fEst.value = 'todas';

      renderizarHistorialVentas();
      notificar('Filtros restablecidos', 'info');
    });
  }

  // Modal detalle de venta
  const modalDetalle = document.getElementById('modal-detalle-venta');
  const btnCerrarDetalle = document.getElementById('btn-cerrar-detalle-venta');
  if (btnCerrarDetalle && modalDetalle) {
    btnCerrarDetalle.addEventListener('click', () => modalDetalle.classList.remove('activo'));
  }

  // Métodos expuestos globalmente
  window.agregarLineaVentaDirecto = (prodId) => {
    agregarLineaVenta(prodId, 1);
  };

  window.actualizarCantidadLinea = (idx, valor) => {
    const cant = Math.max(1, parseInt(valor) || 1);
    if (lineasVentaActual[idx]) {
      lineasVentaActual[idx].cantidad = cant;
      lineasVentaActual[idx].subtotal = cant * lineasVentaActual[idx].precioUnitario;
      renderizarLineasVenta();
      actualizarTotalVenta();
    }
  };

  window.actualizarPrecioLinea = (idx, valor) => {
    const precio = Math.max(0, Math.round(parseFloat(valor) || 0));
    if (lineasVentaActual[idx]) {
      lineasVentaActual[idx].precioUnitario = precio;
      lineasVentaActual[idx].subtotal = lineasVentaActual[idx].cantidad * precio;
      renderizarLineasVenta();
      actualizarTotalVenta();
    }
  };

  window.quitarLineaVenta = (idx) => {
    lineasVentaActual.splice(idx, 1);
    renderizarLineasVenta();
    actualizarTotalVenta();
  };

  window.verDetalleVenta = (id) => {
    const v = listaVentasHistorial.find(x => x.id === id);
    if (!v) return;

    const modal = document.getElementById('modal-detalle-venta');
    const contenido = document.getElementById('detalle-venta-contenido');
    if (!modal || !contenido) return;

    const fechaFmt = formatoFechaCorta(v.fecha);
    const anulada = v.estado === 'anulada';

    contenido.innerHTML = `
      <div class="card p-3 mb-3 bg-light">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>Fecha:</strong> <span>${fechaFmt}</span>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>Cliente:</strong> <span class="cliente-nombre-pill">${escaparHTML(v.clienteNombre || 'Cliente anónimo')}</span>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>Estado:</strong> 
          <span class="status-pill status-${v.estado || 'activa'}">${anulada ? 'Anulada' : 'Activa'}</span>
        </div>
        ${v.notas ? `<div class="mt-2"><small class="text-muted"><strong>Notas:</strong> ${escaparHTML(v.notas)}</small></div>` : ''}
      </div>

      <h6 class="mb-2">Productos comprados</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Producto</th>
              <th class="text-center">Cant</th>
              <th class="text-end">Precio unitario</th>
              <th class="text-end">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(v.lineas || []).map(l => `
              <tr>
                <td>
                  <div>${escaparHTML(l.nombre)}</div>
                  <small class="text-muted">
                    ${l.presentacion === 'paquete' ? `Paq x${l.unidadesPorPaquete}` : 'Unidad'}
                  </small>
                </td>
                <td class="text-center fw-bold">${l.cantidad}</td>
                <td class="text-end">${formatoPesos(l.precioUnitario)}</td>
                <td class="text-end fw-bold">${formatoPesos(l.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="table-active">
              <th colspan="3" class="text-end fs-6">TOTAL COBRADO:</th>
              <th class="text-end fs-6 text-success">${formatoPesos(v.total)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    modal.classList.add('activo');
  };

  window.cargarVentaParaEditar = (id) => {
    const v = listaVentasHistorial.find(x => x.id === id);
    if (!v) return;

    ventaEnEdicionId = id;
    lineasVentaActual = (v.lineas || []).map(l => ({ ...l }));

    const inputFecha = document.getElementById('venta-fecha');
    const selCliente = document.getElementById('venta-cliente');
    const inputNotas = document.getElementById('venta-notas');
    const tituloVenta = document.getElementById('titulo-formulario-venta');
    const btnGuardar = document.getElementById('btn-guardar-venta');
    const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion-venta');

    if (inputFecha) inputFecha.value = fechaParaInputDate(v.fecha);
    if (selCliente) selCliente.value = v.clienteId || '';
    if (inputNotas) inputNotas.value = v.notas || '';
    if (tituloVenta) tituloVenta.textContent = `Editar Venta (${formatoFechaCorta(v.fecha)})`;
    if (btnGuardar) btnGuardar.textContent = 'Guardar Cambios de Venta';
    if (btnCancelarEdicion) btnCancelarEdicion.style.display = 'inline-block';

    renderizarLineasVenta();
    actualizarTotalVenta();

    // Scroll to form
    const formSection = document.getElementById('seccion-ventas');
    if (formSection) {
      window.navegarSeccion('ventas');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    notificar('Cargando venta para edición. Modifica y guarda los cambios.', 'info');
  };

  window.cambiarEstadoVenta = async (id, nuevoEstado) => {
    const v = listaVentasHistorial.find(x => x.id === id);
    if (!v) return;

    const esAnular = nuevoEstado === 'anulada';
    const conf = await mostrarConfirmacion({
      titulo: esAnular ? 'Anular venta' : 'Reactivar venta',
      mensaje: esAnular 
        ? `¿Seguro de anular esta venta de ${formatoPesos(v.total)}? La venta se conservará en el historial, pero ya no sumará en las estadísticas contables.`
        : `¿Reactivar esta venta de ${formatoPesos(v.total)}? Volverá a sumar en la contabilidad y estadísticas.`,
      botonTexto: esAnular ? 'Anular venta' : 'Reactivar venta',
      peligroso: esAnular
    });

    if (!conf) return;

    try {
      await updateDoc(doc(db, 'ventas', id), {
        estado: nuevoEstado,
        actualizadoEn: serverTimestamp()
      });
      v.estado = nuevoEstado;
      renderizarHistorialVentas();
      window.dispatchEvent(new CustomEvent('ventas-actualizadas'));
      notificar(`Venta ${esAnular ? 'anulada' : 'reactivada'} correctamente`, 'exito');
    } catch (err) {
      console.error(err);
      notificar('Error al cambiar estado de la venta', 'error');
    }
  };

  window.eliminarVenta = async (id) => {
    const v = listaVentasHistorial.find(x => x.id === id);
    if (!v) return;

    const conf = await mostrarConfirmacion({
      titulo: 'Eliminar venta permanentemente',
      mensaje: `¿Estás completamente seguro de borrar esta venta de ${formatoPesos(v.total)}? Se eliminará de forma irreversible de la base de datos.`,
      botonTexto: 'Eliminar definitivamente',
      peligroso: true
    });

    if (!conf) return;

    try {
      await deleteDoc(doc(db, 'ventas', id));
      listaVentasHistorial = listaVentasHistorial.filter(x => x.id !== id);
      renderizarHistorialVentas();
      window.dispatchEvent(new CustomEvent('ventas-actualizadas'));
      notificar('Venta eliminada permanentemente', 'exito');
    } catch (err) {
      console.error(err);
      notificar('Error al borrar la venta', 'error');
    }
  };
}
