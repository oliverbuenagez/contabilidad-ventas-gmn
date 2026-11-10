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
import { formatoPesos, escaparHTML, notificar, mostrarConfirmacion, conTimeout } from './utilidades.js';

let listaProductos = [];
let filtroEstado = 'activos'; // 'activos', 'archivados', 'todos'
let busquedaTexto = '';

export async function cargarProductos() {
  const cont = document.getElementById('tabla-productos');
  if (cont) cont.innerHTML = '<tr><td colspan="5" class="text-center p-4">Cargando productos...</td></tr>';
  
  try {
    const colRef = collection(db, 'productos');
    const q = query(colRef, orderBy('nombre', 'asc'));
    const snapshot = await getDocs(q);
    
    listaProductos = [];
    snapshot.forEach(docSnap => {
      listaProductos.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    renderizarProductos();
  } catch (err) {
    console.error('Error al cargar productos:', err);
    if (cont) cont.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">Error al cargar productos: ${escaparHTML(err.message)}</td></tr>`;
    notificar('No se pudieron cargar los productos', 'error');
  }
}

export function obtenerProductosActivos() {
  return listaProductos.filter(p => p.activo !== false);
}

export function obtenerProductoPorId(id) {
  return listaProductos.find(p => p.id === id);
}

export function renderizarProductos() {
  const tbody = document.getElementById('tabla-productos');
  if (!tbody) return;

  let filtrados = listaProductos.filter(p => {
    if (filtroEstado === 'activos' && p.activo === false) return false;
    if (filtroEstado === 'archivados' && p.activo !== false) return false;
    if (busquedaTexto.trim()) {
      const b = busquedaTexto.toLowerCase();
      const n = (p.nombre || '').toLowerCase();
      const pb = (p.panBase || '').toLowerCase();
      if (!n.includes(b) && !pb.includes(b)) return false;
    }
    return true;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">No se encontraron productos</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(prod => {
    const esPaquete = prod.presentacion === 'paquete';
    const detallePresentacion = esPaquete 
      ? `<span class="badge badge-paquete">Paquete x${prod.unidadesPorPaquete || 1}</span>`
      : `<span class="badge badge-unidad">Unidad</span>`;

    const estadoBadge = prod.activo !== false 
      ? '<span class="status-pill status-activa">Activo</span>'
      : '<span class="status-pill status-archivado">Archivado</span>';

    return `
      <tr class="${prod.activo === false ? 'fila-inactiva' : ''}">
        <td>
          <div class="fw-bold">${escaparHTML(prod.nombre)}</div>
        </td>
        <td>${detallePresentacion}</td>
        <td class="fw-bold text-end">${formatoPesos(prod.precio)}</td>
        <td class="text-center">${estadoBadge}</td>
        <td class="text-end">
          <div class="btn-group-sm">
            <button class="btn btn-secondary btn-sm" onclick="window.editarProducto('${prod.id}')" title="Editar">
              ✏️ Editar
            </button>
            ${prod.activo !== false ? `
              <button class="btn btn-outline-warning btn-sm" onclick="window.cambiarEstadoProducto('${prod.id}', false)" title="Archivar">
                📦 Archivar
              </button>
            ` : `
              <button class="btn btn-outline-success btn-sm" onclick="window.cambiarEstadoProducto('${prod.id}', true)" title="Reactivar">
                ♻️ Reactivar
              </button>
            `}
            <button class="btn btn-outline-danger btn-sm" onclick="window.eliminarProducto('${prod.id}')" title="Eliminar">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function configurarModuloProductos() {
  const btnNuevo = document.getElementById('btn-nuevo-producto');
  const modalProd = document.getElementById('modal-producto');
  const formProd = document.getElementById('form-producto');
  const btnCerrarModal = document.getElementById('btn-cerrar-modal-producto');
  const btnCancelarModal = document.getElementById('btn-cancelar-producto');
  
  const selPresentacion = document.getElementById('prod-presentacion');
  const grupoUnidadesPaquete = document.getElementById('grupo-unidades-paquete');
  
  const selectFiltro = document.getElementById('filtro-estado-producto');
  const inputBusqueda = document.getElementById('busqueda-producto');

  if (selPresentacion && grupoUnidadesPaquete) {
    selPresentacion.addEventListener('change', () => {
      grupoUnidadesPaquete.style.display = selPresentacion.value === 'paquete' ? 'block' : 'none';
      const inputUnidades = document.getElementById('prod-unidades');
      if (selPresentacion.value === 'unidad') {
        if (inputUnidades) inputUnidades.value = 1;
      } else {
        if (inputUnidades && (!inputUnidades.value || inputUnidades.value === '1')) inputUnidades.value = 5;
      }
    });
  }

  if (selectFiltro) {
    selectFiltro.addEventListener('change', (e) => {
      filtroEstado = e.target.value;
      renderizarProductos();
    });
  }

  if (inputBusqueda) {
    inputBusqueda.addEventListener('input', (e) => {
      busquedaTexto = e.target.value;
      renderizarProductos();
    });
  }

  if (btnNuevo && modalProd) {
    btnNuevo.addEventListener('click', () => {
      abrirModalProducto();
    });
  }

  const cerrarModal = () => {
    if (modalProd) modalProd.classList.remove('activo');
  };

  if (btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
  if (btnCancelarModal) btnCancelarModal.addEventListener('click', cerrarModal);

  if (formProd) {
    formProd.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarProducto();
    });
  }

  // Métodos expuestos a window para llamadas inline de botones
  window.editarProducto = (id) => {
    const prod = listaProductos.find(p => p.id === id);
    if (!prod) return;
    abrirModalProducto(prod);
  };

  window.cambiarEstadoProducto = async (id, nuevoEstado) => {
    const prod = listaProductos.find(p => p.id === id);
    if (!prod) return;
    
    const accion = nuevoEstado ? 'reactivar' : 'archivar';
    const conf = await mostrarConfirmacion({
      titulo: `${accion.charAt(0).toUpperCase() + accion.slice(1)} Producto`,
      mensaje: `¿Deseas ${accion} el producto "${prod.nombre}"? ${nuevoEstado ? 'Volverá a aparecer para nuevas ventas.' : 'Ya no aparecerá para registrar ventas, pero se conservará su historial.'}`,
      botonTexto: nuevoEstado ? 'Reactivar' : 'Archivar'
    });

    if (!conf) return;

    try {
      await updateDoc(doc(db, 'productos', id), {
        activo: nuevoEstado,
        actualizadoEn: serverTimestamp()
      });
      prod.activo = nuevoEstado;
      renderizarProductos();
      notificar(`Producto ${nuevoEstado ? 'reactivado' : 'archivado'} correctamente`, 'exito');
    } catch (err) {
      console.error(err);
      notificar('Error al actualizar estado del producto', 'error');
    }
  };

  window.eliminarProducto = async (id) => {
    const prod = listaProductos.find(p => p.id === id);
    if (!prod) return;

    try {
      // Verificar si tiene ventas registradas
      const ventasRef = collection(db, 'ventas');
      // Consultamos ventas para ver si este productoId está en alguna línea
      const snapshot = await getDocs(ventasRef);
      let tieneVentas = false;
      snapshot.forEach(docSnap => {
        const v = docSnap.data();
        if (v.lineas && Array.isArray(v.lineas)) {
          if (v.lineas.some(l => l.productoId === id)) {
            tieneVentas = true;
          }
        }
      });

      if (tieneVentas) {
        const archivar = await mostrarConfirmacion({
          titulo: 'No se puede eliminar completamente',
          mensaje: `El producto "${prod.nombre}" ya tiene ventas registradas en el historial. Por integridad contable no se puede borrar del todo, pero puedes archivarlo para que no aparezca en nuevas ventas. ¿Deseas archivarlo ahora?`,
          botonTexto: 'Archivar producto'
        });
        if (archivar) {
          await window.cambiarEstadoProducto(id, false);
        }
        return;
      }

      const conf = await mostrarConfirmacion({
        titulo: 'Eliminar producto',
        mensaje: `¿Estás seguro de eliminar permanentemente el producto "${prod.nombre}"? Esta acción no se puede deshacer.`,
        botonTexto: 'Eliminar definitivamente',
        peligroso: true
      });

      if (!conf) return;

      await deleteDoc(doc(db, 'productos', id));
      listaProductos = listaProductos.filter(p => p.id !== id);
      renderizarProductos();
      notificar('Producto eliminado permanentemente', 'exito');
    } catch (err) {
      console.error(err);
      notificar('Error al eliminar producto', 'error');
    }
  };
}

function abrirModalProducto(prod = null) {
  const modalProd = document.getElementById('modal-producto');
  const tituloModal = document.getElementById('modal-producto-titulo');
  const form = document.getElementById('form-producto');
  const inputId = document.getElementById('prod-id');
  const inputNombre = document.getElementById('prod-nombre');
  const selectPresentacion = document.getElementById('prod-presentacion');
  const inputUnidades = document.getElementById('prod-unidades');
  const grupoUnidades = document.getElementById('grupo-unidades-paquete');
  const inputPrecio = document.getElementById('prod-precio');

  if (!modalProd || !form) return;

  form.reset();

  if (prod) {
    tituloModal.textContent = 'Editar Producto';
    inputId.value = prod.id;
    inputNombre.value = prod.nombre || '';
    selectPresentacion.value = prod.presentacion || 'unidad';
    inputUnidades.value = prod.unidadesPorPaquete || 1;
    inputPrecio.value = prod.precio || 0;
    grupoUnidades.style.display = prod.presentacion === 'paquete' ? 'block' : 'none';
  } else {
    tituloModal.textContent = 'Nuevo Producto';
    inputId.value = '';
    selectPresentacion.value = 'unidad';
    inputUnidades.value = 1;
    grupoUnidades.style.display = 'none';
  }

  modalProd.classList.add('activo');
  inputNombre.focus();
}

async function guardarProducto() {
  const inputId = document.getElementById('prod-id').value;
  const nombre = document.getElementById('prod-nombre').value.trim();
  const presentacion = document.getElementById('prod-presentacion').value;
  const unidades = presentacion === 'paquete' ? Math.max(1, parseInt(document.getElementById('prod-unidades').value) || 1) : 1;
  const precio = Math.max(0, Math.round(parseFloat(document.getElementById('prod-precio').value) || 0));

  if (!nombre) {
    notificar('El nombre del producto es obligatorio', 'error');
    return;
  }

  if (precio <= 0) {
    notificar('Ingresa un precio válido en pesos', 'error');
    return;
  }

  const datos = {
    nombre,
    panBase: nombre,
    presentacion,
    unidadesPorPaquete: unidades,
    precio,
    activo: true
  };

  const btnGuardar = document.getElementById('btn-guardar-producto');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';
  }

  try {
    if (inputId) {
      // Editar
      await conTimeout(updateDoc(doc(db, 'productos', inputId), {
        ...datos,
        actualizadoEn: serverTimestamp()
      }));
      notificar('Producto actualizado con éxito', 'exito');
    } else {
      // Crear
      datos.creadoEn = serverTimestamp();
      await conTimeout(addDoc(collection(db, 'productos'), datos));
      notificar('Producto registrado con éxito', 'exito');
    }

    document.getElementById('modal-producto').classList.remove('activo');
    await cargarProductos();
  } catch (err) {
    console.error('Error al guardar el producto:', err);
    notificar('Error al guardar el producto: ' + err.message, 'error');
  } finally {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar Producto';
    }
  }
}
