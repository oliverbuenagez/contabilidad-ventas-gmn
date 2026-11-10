// Funciones auxiliares y formateadores para la Panadería

export const formateadorPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

export function formatoPesos(valor) {
  const num = Number(valor) || 0;
  return formateadorPesos.format(Math.round(num));
}

export function toDate(valor) {
  if (!valor) return new Date();
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (valor.seconds) return new Date(valor.seconds * 1000);
  return new Date(valor);
}

export function formatoFechaHora(fechaVal) {
  const f = toDate(fechaVal);
  return f.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatoFechaCorta(fechaVal) {
  const f = toDate(fechaVal);
  return f.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatoSoloHora(fechaVal) {
  const f = toDate(fechaVal);
  return f.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function fechaParaInputDate(fechaVal) {
  const f = fechaVal ? toDate(fechaVal) : new Date();
  const year = f.getFullYear();
  const month = String(f.getMonth() + 1).padStart(2, '0');
  const day = String(f.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fechaParaInputDatetime(fechaVal) {
  const f = fechaVal ? toDate(fechaVal) : new Date();
  const year = f.getFullYear();
  const month = String(f.getMonth() + 1).padStart(2, '0');
  const day = String(f.getDate()).padStart(2, '0');
  const hours = String(f.getHours()).padStart(2, '0');
  const minutes = String(f.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function escaparHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function notificar(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('toast-container');
  if (!contenedor) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo} anim-fade-in`;
  toast.innerHTML = `
    <span class="toast-icon">${tipo === 'exito' ? '✓' : tipo === 'error' ? '⚠' : 'ℹ'}</span>
    <span class="toast-text">${escaparHTML(mensaje)}</span>
  `;
  
  contenedor.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

export function conTimeout(promesa, ms = 9000, mensaje = 'Tiempo de espera agotado al conectar con Firebase. Revisa si Firestore Database está habilitada en la consola de Firebase.') {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensaje)), ms))
  ]);
}

export function mostrarConfirmacion({ titulo = 'Confirmación', mensaje, botonTexto = 'Confirmar', peligroso = false }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirmacion');
    const tituloEl = document.getElementById('modal-confirm-titulo');
    const mensajeEl = document.getElementById('modal-confirm-mensaje');
    const btnConfirmar = document.getElementById('modal-confirm-btn-ok');
    const btnCancelar = document.getElementById('modal-confirm-btn-cancel');

    if (!modal) {
      resolve(confirm(mensaje));
      return;
    }

    tituloEl.textContent = titulo;
    mensajeEl.textContent = mensaje;
    btnConfirmar.textContent = botonTexto;
    
    if (peligroso) {
      btnConfirmar.className = 'btn btn-danger';
    } else {
      btnConfirmar.className = 'btn btn-primary';
    }

    modal.classList.add('activo');

    const cerrar = (resultado) => {
      modal.classList.remove('activo');
      btnConfirmar.removeEventListener('click', onConfirm);
      btnCancelar.removeEventListener('click', onCancel);
      resolve(resultado);
    };

    const onConfirm = () => cerrar(true);
    const onCancel = () => cerrar(false);

    btnConfirmar.addEventListener('click', onConfirm);
    btnCancelar.addEventListener('click', onCancel);
  });
}
