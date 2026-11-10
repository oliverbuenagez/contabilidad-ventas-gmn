import { 
  db, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from './firebase.js';
import { 
  formatoPesos, 
  formatoFechaCorta, 
  toDate, 
  escaparHTML, 
  notificar 
} from './utilidades.js';

let mesSeleccionado = new Date().getMonth(); // 0 a 11
let anioSeleccionado = new Date().getFullYear();

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function inicializarEstadisticas() {
  const selMes = document.getElementById('stats-filtro-mes');
  const selAnio = document.getElementById('stats-filtro-anio');

  if (selMes) {
    selMes.innerHTML = NOMBRES_MESES.map((nombre, i) => 
      `<option value="${i}" ${i === mesSeleccionado ? 'selected' : ''}>${nombre}</option>`
    ).join('');
    
    selMes.addEventListener('change', (e) => {
      mesSeleccionado = parseInt(e.target.value);
      cargarDatosEstadisticas();
    });
  }

  if (selAnio) {
    const anioActual = new Date().getFullYear();
    let opcionesAnios = '';
    for (let a = anioActual - 2; a <= anioActual + 1; a++) {
      opcionesAnios += `<option value="${a}" ${a === anioSeleccionado ? 'selected' : ''}>${a}</option>`;
    }
    selAnio.innerHTML = opcionesAnios;

    selAnio.addEventListener('change', (e) => {
      anioSeleccionado = parseInt(e.target.value);
      cargarDatosEstadisticas();
    });
  }

  window.addEventListener('ventas-actualizadas', () => {
    cargarDatosEstadisticas();
  });
}

export async function cargarDatosEstadisticas() {
  const contenedor = document.getElementById('dashboard-contenido');
  if (!contenedor) return;

  try {
    // Rango de fechas para el mes seleccionado
    const inicioMes = new Date(anioSeleccionado, mesSeleccionado, 1, 0, 0, 0);
    const finMes = new Date(anioSeleccionado, mesSeleccionado + 1, 0, 23, 59, 59);

    // Rango de fechas para el mes anterior (para comparación)
    const inicioMesPrev = new Date(anioSeleccionado, mesSeleccionado - 1, 1, 0, 0, 0);
    const finMesPrev = new Date(anioSeleccionado, mesSeleccionado, 0, 23, 59, 59);

    // Consulta de ventas activas en Firestore
    const colRef = collection(db, 'ventas');
    
    // Obtenemos rango total de ambos meses
    const q = query(
      colRef, 
      where('fecha', '>=', Timestamp.fromDate(inicioMesPrev)),
      where('fecha', '<=', Timestamp.fromDate(finMes)),
      orderBy('fecha', 'asc')
    );

    const snapshot = await getDocs(q);
    const ventasMesActual = [];
    const ventasMesPrevio = [];

    const hoy = new Date();
    const esMesActual = hoy.getFullYear() === anioSeleccionado && hoy.getMonth() === mesSeleccionado;
    const diaHoyNumero = hoy.getDate();
    let totalVendidoHoy = 0;

    snapshot.forEach(docSnap => {
      const v = { id: docSnap.id, ...docSnap.data() };
      if (v.estado === 'anulada') return; // Solo ventas activas cuentan

      const f = toDate(v.fecha);
      if (f >= inicioMes && f <= finMes) {
        ventasMesActual.push(v);
        if (esMesActual && f.getDate() === diaHoyNumero) {
          totalVendidoHoy += (v.total || 0);
        }
      } else if (f >= inicioMesPrev && f <= finMesPrev) {
        ventasMesPrevio.push(v);
      }
    });

    procesarYRenderizarDashboard(ventasMesActual, ventasMesPrevio, totalVendidoHoy);

  } catch (err) {
    console.error('Error al generar estadísticas:', err);
    // Si falta índice compuesto en Firestore, fallback a cargar todas las ventas y filtrar en memoria
    if (err.message && err.message.includes('requires an index')) {
      console.warn('Fallback a consulta en memoria por índice compuesto de Firestore...');
      await cargarEstadisticasFallback();
    } else {
      contenedor.innerHTML = `<div class="alert alert-danger p-4">Error al calcular estadísticas: ${escaparHTML(err.message)}</div>`;
    }
  }
}

async function cargarEstadisticasFallback() {
  const colRef = collection(db, 'ventas');
  const snap = await getDocs(colRef);
  
  const inicioMes = new Date(anioSeleccionado, mesSeleccionado, 1, 0, 0, 0);
  const finMes = new Date(anioSeleccionado, mesSeleccionado + 1, 0, 23, 59, 59);
  const inicioMesPrev = new Date(anioSeleccionado, mesSeleccionado - 1, 1, 0, 0, 0);
  const finMesPrev = new Date(anioSeleccionado, mesSeleccionado, 0, 23, 59, 59);

  const ventasMesActual = [];
  const ventasMesPrevio = [];

  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anioSeleccionado && hoy.getMonth() === mesSeleccionado;
  let totalVendidoHoy = 0;

  snap.forEach(d => {
    const v = { id: d.id, ...d.data() };
    if (v.estado === 'anulada') return;
    const f = toDate(v.fecha);
    if (f >= inicioMes && f <= finMes) {
      ventasMesActual.push(v);
      if (esMesActual && f.getDate() === hoy.getDate()) {
        totalVendidoHoy += (v.total || 0);
      }
    } else if (f >= inicioMesPrev && f <= finMesPrev) {
      ventasMesPrevio.push(v);
    }
  });

  procesarYRenderizarDashboard(ventasMesActual, ventasMesPrevio, totalVendidoHoy);
}

function procesarYRenderizarDashboard(ventasActual, ventasPrevio, totalHoy) {
  const cont = document.getElementById('dashboard-contenido');
  if (!cont) return;

  const totalMes = ventasActual.reduce((acc, v) => acc + (v.total || 0), 0);
  const numVentasMes = ventasActual.length;
  const ticketPromedio = numVentasMes > 0 ? Math.round(totalMes / numVentasMes) : 0;

  // Comparativa con mes anterior
  const totalMesPrevio = ventasPrevio.reduce((acc, v) => acc + (v.total || 0), 0);
  const difPesos = totalMes - totalMesPrevio;
  let difPorcentaje = 0;
  if (totalMesPrevio > 0) {
    difPorcentaje = ((difPesos / totalMesPrevio) * 100).toFixed(1);
  } else if (totalMes > 0) {
    difPorcentaje = 100;
  }

  // Agrupación por panes (por nombre y por panBase)
  const statsPanes = {}; // key: panBase
  const statsDias = {};  // key: número de día 1..31

  // Clientes
  const statsClientes = {}; // key: clienteId o 'anonimo'
  let ventasAnonimasTotal = 0;
  let ventasRegistradasTotal = 0;

  // Días del mes (inicializar días de 1 a último día del mes)
  const ultimoDiaMes = new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate();
  for (let d = 1; d <= ultimoDiaMes; d++) {
    statsDias[d] = 0;
  }

  ventasActual.forEach(v => {
    const f = toDate(v.fecha);
    const diaNum = f.getDate();
    const horaNum = f.getHours();

    if (statsDias[diaNum] !== undefined) {
      statsDias[diaNum] += (v.total || 0);
    }

    // Cliente
    if (!v.clienteId) {
      ventasAnonimasTotal += (v.total || 0);
    } else {
      ventasRegistradasTotal += (v.total || 0);
      const cId = v.clienteId;
      if (!statsClientes[cId]) {
        statsClientes[cId] = {
          nombre: v.clienteNombre || 'Cliente',
          total: 0,
          frecuencia: 0,
          panes: {}
        };
      }
      statsClientes[cId].total += (v.total || 0);
      statsClientes[cId].frecuencia += 1;
    }

    // Líneas
    (v.lineas || []).forEach(linea => {
      const base = linea.panBase || linea.nombre;
      const unidadesReales = (linea.cantidad || 0) * (linea.unidadesPorPaquete || 1);
      const paquetes = linea.presentacion === 'paquete' ? (linea.cantidad || 0) : 0;
      const ingreso = linea.subtotal || 0;

      if (!statsPanes[base]) {
        statsPanes[base] = {
          nombre: base,
          unidadesTotales: 0,
          paquetesTotales: 0,
          ingresoTotal: 0
        };
      }
      statsPanes[base].unidadesTotales += unidadesReales;
      statsPanes[base].paquetesTotales += paquetes;
      statsPanes[base].ingresoTotal += ingreso;

      // Registrar para el cliente
      if (v.clienteId && statsClientes[v.clienteId]) {
        statsClientes[v.clienteId].panes[base] = (statsClientes[v.clienteId].panes[base] || 0) + unidadesReales;
      }
    });
  });

  // Pan más vendido por unidades y por dinero
  const arrPanes = Object.values(statsPanes);
  arrPanes.sort((a, b) => b.unidadesTotales - a.unidadesTotales);
  const panTopUnidades = arrPanes[0] || null;

  const arrPanesPorDinero = [...arrPanes].sort((a, b) => b.ingresoTotal - a.ingresoTotal);
  const panTopDinero = arrPanesPorDinero[0] || null;

  // Mejor y peor día del mes (solo considerando días que ya pasaron o con ventas)
  let mejorDia = { dia: null, total: 0 };
  let peorDia = { dia: null, total: Infinity };
  let diasConVenta = 0;

  for (let d = 1; d <= ultimoDiaMes; d++) {
    const monto = statsDias[d];
    if (monto > mejorDia.total) {
      mejorDia = { dia: d, total: monto };
    }
    if (monto > 0 && monto < peorDia.total) {
      peorDia = { dia: d, total: monto };
    }
    if (monto > 0) diasConVenta++;
  }
  if (peorDia.total === Infinity) peorDia = { dia: null, total: 0 };

  // Top clientes por total gastado
  const arrClientes = Object.values(statsClientes);
  arrClientes.sort((a, b) => b.total - a.total);

  // Determinar pan favorito para cada cliente del ranking
  arrClientes.forEach(c => {
    let maxU = 0;
    let fav = 'N/A';
    for (const [p, u] of Object.entries(c.panes)) {
      if (u > maxU) {
        maxU = u;
        fav = p;
      }
    }
    c.panFavorito = fav;
  });

  // Renderizado interactivo
  cont.innerHTML = `
    <!-- KPI CARDS -->
    <div class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-icon">💰</div>
        <div class="kpi-info">
          <span class="kpi-label">Ventas del Mes (${NOMBRES_MESES[mesSeleccionado]})</span>
          <span class="kpi-value text-success">${formatoPesos(totalMes)}</span>
          <div class="kpi-sub">
            ${difPesos >= 0 ? '▲' : '▼'} 
            <span class="${difPesos >= 0 ? 'text-success' : 'text-danger'}">
              ${formatoPesos(Math.abs(difPesos))} (${difPorcentaje}%)
            </span> vs mes anterior
          </div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon">📅</div>
        <div class="kpi-info">
          <span class="kpi-label">Ventas de Hoy</span>
          <span class="kpi-value">${formatoPesos(totalHoy)}</span>
          <div class="kpi-sub">Registros de la jornada</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon">🧾</div>
        <div class="kpi-info">
          <span class="kpi-label">Total de Ventas</span>
          <span class="kpi-value">${numVentasMes}</span>
          <div class="kpi-sub">Ticket promedio: <strong>${formatoPesos(ticketPromedio)}</strong></div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon">🥖</div>
        <div class="kpi-info">
          <span class="kpi-label">Pan Estrella</span>
          <span class="kpi-value text-primary fs-5">${panTopUnidades ? escaparHTML(panTopUnidades.nombre) : 'Sin ventas'}</span>
          <div class="kpi-sub">
            ${panTopUnidades ? `${panTopUnidades.unidadesTotales} unidades vendidas` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- FILA: GRÁFICO POR DÍA Y MEJOR/PEOR DÍA -->
    <div class="stats-row mt-4">
      <div class="card p-3 flex-grow-1">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="m-0">📊 Ventas Diarias del Mes</h5>
          <span class="text-muted small">${diasConVenta} días con actividad</span>
        </div>
        
        <div class="chart-container-scroll">
          ${generarGraficoBarrasDias(statsDias, ultimoDiaMes)}
        </div>

        <div class="d-flex justify-content-around mt-3 pt-3 border-top small">
          <div>
            🏆 <strong>Mejor día:</strong> 
            ${mejorDia.dia ? `Día ${mejorDia.dia} (${formatoPesos(mejorDia.total)})` : 'N/A'}
          </div>
          <div>
            📉 <strong>Día más bajo (con ventas):</strong> 
            ${peorDia.dia ? `Día ${peorDia.dia} (${formatoPesos(peorDia.total)})` : 'N/A'}
          </div>
        </div>
      </div>
    </div>

    <!-- FILA: CLIENTES REGISTRADOS VS ANÓNIMOS -->
    <div class="stats-row mt-4">
      <div class="card p-3">
        <h5>👥 Tipo de Cliente</h5>
        <p class="text-muted small">Proporción de ventas registradas vs clientes de paso (mostrador)</p>
        
        <div class="mt-3">
          <div class="d-flex justify-content-between mb-1">
            <span>👤 Con Nombre: <strong>${formatoPesos(ventasRegistradasTotal)}</strong></span>
            <span>${totalMes > 0 ? Math.round((ventasRegistradasTotal / totalMes) * 100) : 0}%</span>
          </div>
          <div class="progress mb-3">
            <div class="progress-bar bg-success" style="width: ${totalMes > 0 ? (ventasRegistradasTotal / totalMes) * 100 : 0}%"></div>
          </div>

          <div class="d-flex justify-content-between mb-1">
            <span>🚶 Anónimos / Mostrador: <strong>${formatoPesos(ventasAnonimasTotal)}</strong></span>
            <span>${totalMes > 0 ? Math.round((ventasAnonimasTotal / totalMes) * 100) : 0}%</span>
          </div>
          <div class="progress mb-3">
            <div class="progress-bar bg-warning" style="width: ${totalMes > 0 ? (ventasAnonimasTotal / totalMes) * 100 : 0}%"></div>
          </div>

          ${panTopDinero ? `
            <div class="alert alert-warning p-2 small mt-2">
              💡 <strong>Pan más rentable en dinero:</strong> ${escaparHTML(panTopDinero.nombre)} (${formatoPesos(panTopDinero.ingresoTotal)} generados)
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- TABLAS DE RANKING: PANES Y CLIENTES -->
    <div class="stats-grid-2 mt-4">
      <!-- RANKING DE PANES -->
      <div class="card p-3">
        <h5>🥖 Ranking de Panes (${NOMBRES_MESES[mesSeleccionado]})</h5>
        <div class="table-responsive mt-2">
          <table class="table table-sm table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Pan</th>
                <th class="text-center">Unidades</th>
                <th class="text-center">Paquetes</th>
                <th class="text-end">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              ${arrPanes.length === 0 ? '<tr><td colspan="5" class="text-center text-muted p-3">Sin datos este mes</td></tr>' : 
                arrPanes.map((p, idx) => `
                  <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td><strong>${escaparHTML(p.nombre)}</strong></td>
                    <td class="text-center fw-bold text-primary">${p.unidadesTotales}</td>
                    <td class="text-center text-muted">${p.paquetesTotales || '-'}</td>
                    <td class="text-end fw-bold text-success">${formatoPesos(p.ingresoTotal)}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- RANKING DE MEJORES CLIENTES -->
      <div class="card p-3">
        <h5>⭐ Mejores Clientes del Mes</h5>
        <div class="table-responsive mt-2">
          <table class="table table-sm table-hover">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th class="text-center">Compras</th>
                <th>Pan Favorito</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              ${arrClientes.length === 0 ? '<tr><td colspan="5" class="text-center text-muted p-3">Sin clientes con compras este mes</td></tr>' : 
                arrClientes.slice(0, 10).map((c, idx) => `
                  <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td><strong>${escaparHTML(c.nombre)}</strong></td>
                    <td class="text-center">${c.frecuencia}</td>
                    <td><small class="text-muted">${escaparHTML(c.panFavorito)}</small></td>
                    <td class="text-end fw-bold text-success">${formatoPesos(c.total)}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function generarGraficoBarrasDias(statsDias, ultimoDiaMes) {
  const valores = Object.values(statsDias);
  const maximo = Math.max(...valores, 1000);

  let barrasHTML = '';
  for (let d = 1; d <= ultimoDiaMes; d++) {
    const valor = statsDias[d] || 0;
    const porcentajeAltura = Math.round((valor / maximo) * 100);
    const tieneVenta = valor > 0;

    barrasHTML += `
      <div class="chart-bar-item" title="Día ${d}: ${formatoPesos(valor)}">
        <div class="chart-bar-fill-wrap">
          <div class="chart-bar-fill ${tieneVenta ? 'con-venta' : ''}" style="height: ${porcentajeAltura}%;">
            ${tieneVenta && porcentajeAltura >= 30 ? `<span class="chart-bar-label">${formatoPesos(valor)}</span>` : ''}
          </div>
        </div>
        <span class="chart-bar-day">${d}</span>
      </div>
    `;
  }

  return `
    <div class="chart-bar-wrapper">
      ${barrasHTML}
    </div>
  `;
}
