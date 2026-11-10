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
  serverTimestamp 
} from './firebase.js';
import { formatoPesos, formatoFechaHora, escaparHTML, notificar, mostrarConfirmacion, conTimeout } from './utilidades.js';

let listaClientes = [];
let filtroEstadoCliente = 'activos'; // 'activos', 'archivados', 'todos'
let busquedaCliente = '';

export async function cargarClientes() {
  const tbody = document.getElementById('tabla-clientes');
  if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4">Cargando clientes...</td></tr>';

  try {
    const colRef = collection(db, 'clientes');
    const q = query(colRef, orderBy('nombre', 'asc'));
    const snapshot = await getDocs(q);

    listaClientes = [];
    snapshot.forEach(docSnap => {
      listaClientes.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderizarClientes();
  } catch (err) {
    console.error('Error al cargar clientes:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-danger">Error al cargar clientes: ${escaparHTML(err.message)}</td></tr>`;
    notificar('No se pudieron cargar los clientes', 'error');
  }
}

export function obtenerClientesActivos() {
  return listaClientes.filter(c => c.activo !== false);
}

export function obtenerClientePorId(id) {
  return listaClientes.find(c => c.id === id);
}

export function renderizarClientes() {
  const tbody = document.getElementById('tabla-clientes');
  if (!tbody) return;

  let filtrados = listaClientes.filter(c => {
    if (filtroEstadoCliente === 'activos' && c.activo === false) return false;
    if (filtroEstadoCliente === 'archivados' && c.activo !== false) return false;
    if (busquedaCliente.trim()) {
      const b = busquedaCliente.toLowerCase();
      const n = (c.nombre || '').toLowerCase();
      const t = (c.telefono || '').toLowerCase();
      const bar = (c.barrio || '').toLowerCase();
      if (!n.includes(b) && !t.includes(b) && !bar.includes(b)) return false;
    }
    return true;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-muted">No se encontraron clientes</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(cli => {
    const estadoBadge = cli.activo !== false 
      ? '<span class="status-pill status-activa">Activo</span>'
      : '<span class="status-pill status-archivado">Archivado</span>';

    const infoContacto = [
      cli.telefono ? `📞 ${escaparHTML(cli.telefono)}` : null,
      cli.barrio ? `📍 ${escaparHTML(cli.barrio)}` : null,
      cli.direccion ? `🏠 ${escaparHTML(cli.direccion)}` : null
    ].filter(Boolean).join(' • ') || '<span class="text-muted">Sin datos de contacto</span>';

    return `
      <tr class="${cli.activo === false ? 'fila-inactiva' : ''}">
        <td>
          <div class="fw-bold fs-6">${escaparHTML(cli.nombre)}</div>
          <small class="text-muted">${infoContacto}</small>
        </td>
        <td class="text-center">${estadoBadge}</td>
        <td class="text-end">
          <div class="btn-group-sm">
            <button class="btn btn-outline-info btn-sm" onclick="window.verHistorialCliente('${cli.id}')" title="Ver historial de compras">
              📋 Historial
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.editarCliente('${cli.id}')" title="Editar">
              ✏️
            </button>
            ${cli.activo !== false ? `
              <button class="btn btn-outline-warning btn-sm" onclick="window.cambiarEstadoCliente('${cli.id}', false)" title="Archivar">
                📦
              </button>
            ` : `
              <button class="btn btn-outline-success btn-sm" onclick="window.cambiarEstadoCliente('${cli.id}', true)" title="Reactivar">
                ♻️
              </button>
            `}
            <button class="btn btn-outline-danger btn-sm" onclick="window.eliminarCliente('${cli.id}')" title="Eliminar">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function configurarModuloClientes() {
  const btnNuevo = document.getElementById('btn-nuevo-cliente');
  const modalCli = document.getElementById('modal-cliente');
  const formCli = document.getElementById('form-cliente');
  const btnCerrarModal = document.getElementById('btn-cerrar-modal-cliente');
  const btnCancelarModal = document.getElementById('btn-cancelar-cliente');

  const selectFiltro = document.getElementById('filtro-estado-cliente');
  const inputBusqueda = document.getElementById('busqueda-cliente');

  if (selectFiltro) {
    selectFiltro.addEventListener('change', (e) => {
      filtroEstadoCliente = e.target.value;
      renderizarClientes();
    });
  }

  if (inputBusqueda) {
    inputBusqueda.addEventListener('input', (e) => {
      busquedaCliente = e.target.value;
      renderizarClientes();
    });
  }

  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => abrirModalCliente());
  }

  const cerrarModal = () => {
    if (modalCli) modalCli.classList.remove('activo');
  };

  if (btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
  if (btnCancelarModal) btnCancelarModal.addEventListener('click', cerrarModal);

  if (formCli) {
    formCli.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarCliente();
    });
  }

  // Modal Historial
  const modalHistorial = document.getElementById('modal-historial-cliente');
  const btnCerrarHistorial = document.getElementById('btn-cerrar-historial-cliente');
  if (btnCerrarHistorial && modalHistorial) {
    btnCerrarHistorial.addEventListener('click', () => modalHistorial.classList.remove('activo'));
  }

  window.editarCliente = (id) => {
    const cli = listaClientes.find(c => c.id === id);
    if (!cli) return;
    abrirModalCliente(cli);
  };

  window.cambiarEstadoCliente = async (id, nuevoEstado) => {
    const cli = listaClientes.find(c => c.id === id);
    if (!cli) return;

    const accion = nuevoEstado ? 'reactivar' : 'archivar';
    const conf = await mostrarConfirmacion({
      titulo: `${accion.charAt(0).toUpperCase() + accion.slice(1)} Cliente`,
      mensaje: `¿Deseas ${accion} a "${cli.nombre}"? ${nuevoEstado ? 'Volverá a aparecer para nuevas ventas.' : 'No aparecerá en el selector de ventas, pero se mantendrá todo su historial intacto.'}`,
      botonTexto: nuevoEstado ? 'Reactivar' : 'Archivar'
    });

    if (!conf) return;

    try {
      await updateDoc(doc(db, 'clientes', id), {
        activo: nuevoEstado,
        actualizadoEn: serverTimestamp()
      });
      cli.activo = nuevoEstado;
      renderizarClientes();
      notificar(`Cliente ${nuevoEstado ? 'reactivado' : 'archivado'} correctamente`, 'exito');
    } catch (err) {
      console.error(err);
      notificar('Error al actualizar cliente', 'error');
    }
  };

  window.eliminarCliente = async (id) => {
    const cli = listaClientes.find(c => c.id === id);
    if (!cli) return;

    try {
      // Verificar si tiene ventas registradas
      const qVentas = query(collection(db, 'ventas'), where('clienteId', '==', id));
      const snap = await getDocs(qVentas);

      if (!snap.empty) {
        const archivar = await mostrarConfirmacion({
          titulo: 'No se puede eliminar completamente',
          mensaje: `"${cli.nombre}" ya tiene compras registradas. Los clientes con compras no se pierden para proteger la contabilidad. ¿Deseas archivarlo en lugar de borrarlo?`,
          botonTexto: 'Archivar cliente'
        });
        if (archivar) {
          await window.cambiarEstadoCliente(id, false);
        }
        return;
      }

      const conf = await mostrarConfirmacion({
        titulo: 'Eliminar cliente',
        mensaje: `¿Estás seguro de eliminar a "${cli.nombre}"? No tiene ventas asociadas.`,
        botonTexto: 'Eliminar definitivamente',
        peligroso: true
      });

      if (!conf) return;

      await deleteDoc(doc(db, 'clientes', id));
      listaClientes = listaClientes.filter(c => c.id !== id);
      renderizarClientes();
      notificar('Cliente eliminado', 'exito');
    } catch (err) {
      console.error(err);
      notificar('Error al eliminar cliente: ' + err.message, 'error');
    }
  };

  window.verHistorialCliente = async (id) => {
    const cli = listaClientes.find(c => c.id === id);
    if (!cli) return;

    const modal = document.getElementById('modal-historial-cliente');
    const titulo = document.getElementById('historial-cliente-titulo');
    const resumen = document.getElementById('historial-cliente-resumen');
    const contenido = document.getElementById('historial-cliente-contenido');

    if (!modal) return;
    titulo.textContent = `Historial de compras: ${cli.nombre}`;
    resumen.innerHTML = 'Cargando historial...';
    contenido.innerHTML = '';
    modal.classList.add('activo');

    try {
      const q = query(
        collection(db, 'ventas'),
        where('clienteId', '==', id),
        orderBy('fecha', 'desc')
      );
      const snap = await getDocs(q);

      let totalGastado = 0;
      let totalVentas = 0;
      let panesComprados = {}; // panBase -> total unidades

      const filasVentas = [];

      snap.forEach(d => {
        const v = d.data();
        if (v.estado === 'activa') {
          totalGastado += (v.total || 0);
          totalVentas += 1;

          if (v.lineas && Array.isArray(v.lineas)) {
            v.lineas.forEach(l => {
              const base = l.panBase || l.nombre;
              const unidadesReales = (l.cantidad || 0) * (l.unidadesPorPaquete || 1);
              panesComprados[base] = (panesComprados[base] || 0) + unidadesReales;
            });
          }
        }

        filasVentas.push({ id: d.id, ...v });
      });

      // Calcular pan favorito
      let panFavorito = 'Ninguno';
      let maxUnidades = 0;
      for (const [pan, cant] of Object.entries(panesComprados)) {
        if (cant > maxUnidades) {
          maxUnidades = cant;
          panFavorito = `${pan} (${cant} unidades)`;
        }
      }

      resumen.innerHTML = `
        <div class="kpi-grid-mini mb-3">
          <div class="kpi-card-mini">
            <span class="label">Total gastado</span>
            <span class="val text-success">${formatoPesos(totalGastado)}</span>
          </div>
          <div class="kpi-card-mini">
            <span class="label">Compras activas</span>
            <span class="val">${totalVentas}</span>
          </div>
          <div class="kpi-card-mini">
            <span class="label">Pan favorito</span>
            <span class="val text-primary">${escaparHTML(panFavorito)}</span>
          </div>
        </div>
      `;

      if (filasVentas.length === 0) {
        contenido.innerHTML = '<p class="text-muted text-center p-4">Este cliente aún no registra compras.</p>';
        return;
      }

      contenido.innerHTML = `
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Detalle de panes</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filasVentas.map(v => {
                const anulada = v.estado === 'anulada';
                const detallePanes = (v.lineas || []).map(l => 
                  `${l.cantidad}x ${escaparHTML(l.nombre)} (${formatoPesos(l.subtotal)})`
                ).join(', ');

                return `
                  <tr class="${anulada ? 'fila-anulada text-muted' : ''}">
                    <td>${formatoFechaHora(v.fecha)}</td>
                    <td>
                      <span class="status-pill status-${v.estado || 'activa'}">
                        ${v.estado === 'anulada' ? 'Anulada' : 'Activa'}
                      </span>
                    </td>
                    <td><small>${detallePanes || 'Sin detalles'}</small></td>
                    <td class="text-end fw-bold ${anulada ? 'text-decoration-line-through' : 'text-success'}">
                      ${formatoPesos(v.total)}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error(err);
      resumen.innerHTML = `<p class="text-danger">Error al consultar compras: ${escaparHTML(err.message)}</p>`;
    }
  };
}

export function abrirModalCliente(cli = null, onSaved = null) {
  const modalCli = document.getElementById('modal-cliente');
  const tituloModal = document.getElementById('modal-cliente-titulo');
  const form = document.getElementById('form-cliente');
  const inputId = document.getElementById('cli-id');
  const inputNombre = document.getElementById('cli-nombre');
  const inputTelefono = document.getElementById('cli-telefono');
  const inputBarrio = document.getElementById('cli-barrio');
  const inputDireccion = document.getElementById('cli-direccion');

  if (!modalCli || !form) return;

  form.reset();

  if (cli) {
    tituloModal.textContent = 'Editar Cliente';
    inputId.value = cli.id;
    inputNombre.value = cli.nombre || '';
    inputTelefono.value = cli.telefono || '';
    inputBarrio.value = cli.barrio || '';
    inputDireccion.value = cli.direccion || '';
  } else {
    tituloModal.textContent = 'Nuevo Cliente';
    inputId.value = '';
  }

  modalCli.dataset.callback = onSaved ? 'custom' : '';
  modalCli._onSavedCallback = onSaved;

  modalCli.classList.add('activo');
  inputNombre.focus();
}

async function guardarCliente() {
  const modalCli = document.getElementById('modal-cliente');
  const inputId = document.getElementById('cli-id').value;
  const nombre = document.getElementById('cli-nombre').value.trim();
  const telefono = document.getElementById('cli-telefono').value.trim();
  const barrio = document.getElementById('cli-barrio').value.trim();
  const direccion = document.getElementById('cli-direccion').value.trim();

  if (!nombre) {
    notificar('El nombre del cliente es obligatorio', 'error');
    return;
  }

  const datos = {
    nombre,
    telefono,
    barrio,
    direccion,
    activo: true
  };

  const btnGuardar = document.getElementById('btn-guardar-cliente');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';
  }

  try {
    let nuevoId = inputId;
    if (inputId) {
      await conTimeout(updateDoc(doc(db, 'clientes', inputId), {
        ...datos,
        actualizadoEn: serverTimestamp()
      }));
      notificar('Cliente actualizado', 'exito');
    } else {
      datos.creadoEn = serverTimestamp();
      const docRef = await conTimeout(addDoc(collection(db, 'clientes'), datos));
      nuevoId = docRef.id;
      notificar('Cliente registrado', 'exito');
    }

    if (modalCli) modalCli.classList.remove('activo');
    await cargarClientes();

    if (modalCli && typeof modalCli._onSavedCallback === 'function') {
      modalCli._onSavedCallback({ id: nuevoId, ...datos });
      modalCli._onSavedCallback = null;
    }
  } catch (err) {
    console.error('Error al guardar cliente:', err);
    notificar('Error al guardar cliente: ' + err.message, 'error');
  } finally {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar Cliente';
    }
  }
}
