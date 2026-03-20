import { supabase } from "./supabase.js";

/* ---- Proteger página ---- */
const usuario = JSON.parse(localStorage.getItem("usuario"));
if (!usuario) {
  window.location.href = "login.html";
}

/* ---- Cerrar sesión ---- */
document.getElementById("btnCerrarSesion").addEventListener("click", function () {
  localStorage.removeItem("usuario");
  window.location.href = "login.html";
});

/* ---- Variables globales ---- */
let todosBalances = [];

/* ---- Helpers ---- */
function formatearMonto(monto, moneda) {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: moneda }).format(monto);
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "numeric" });
}

/* ---- Renderizar balances ---- */
function renderizarBalances(balances) {
  const container = document.getElementById("listaBalances");

  if (!balances || balances.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:3rem;">📊</div>
        <p class="fw-bold fs-5 mb-1 mt-2">Sin balances que mostrar</p>
        <p class="text-muted small">No tienes viajes con gastos registrados aún.</p>
        <a href="dashboard.html" class="btn btn-primary mt-2 px-4">Ir al dashboard</a>
      </div>
    `;
    return;
  }

  container.innerHTML = balances.map(b => {

    // Badge del balance del usuario en este viaje
    let badgeBalance = "";
    let claseBalance = "";
    if (b.miBalance > 0) {
      badgeBalance = `<span class="badge-estado badge-activo">✅ Te deben ${formatearMonto(b.miBalance, b.moneda)}</span>`;
      claseBalance = "balance-monto-positivo";
    } else if (b.miBalance < 0) {
      badgeBalance = `<span class="badge-estado badge-deuda">⚠️ Debes ${formatearMonto(Math.abs(b.miBalance), b.moneda)}</span>`;
      claseBalance = "balance-monto-negativo";
    } else {
      badgeBalance = `<span class="badge-estado badge-pagado">✔ Saldado</span>`;
      claseBalance = "balance-monto-cero";
    }

    // Deudas detalladas (quién le debe a quién)
    const deudasHTML = b.deudas.length > 0
      ? b.deudas.map(d => `
          <div class="deuda-item">
            <div class="cuenta-avatar" style="width:32px;height:32px;font-size:0.78rem;flex-shrink:0;background:${d.deudor === usuario.id_usuario ? '#c0392b' : 'var(--color-accent)' };color:${d.deudor === usuario.id_usuario ? 'white' : 'var(--color-primary-dark)'}">
              ${d.nombreDeudor.charAt(0).toUpperCase()}
            </div>
            <div class="flex-grow-1">
              <span class="fw-semibold small">${d.nombreDeudor}</span>
              <span class="text-muted small"> debe a </span>
              <span class="fw-semibold small">${d.nombreAcreedor}</span>
            </div>
            <span class="${d.deudor === usuario.id_usuario ? 'balance-monto-negativo' : 'balance-monto-positivo'}" style="font-size:0.92rem;">
              ${formatearMonto(d.monto, b.moneda)}
            </span>
          </div>
        `).join("")
      : `<p class="text-muted small text-center py-2">✔ Todos los balances están saldados en este viaje.</p>`;

    return `
      <div class="viaje-balance-card" data-tipo="${b.miBalance > 0 ? 'tedeben' : b.miBalance < 0 ? 'debes' : 'saldado'}">
        <div class="viaje-balance-header d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <a href="viaje.html?id=${b.id_viaje}" class="fw-bold fs-6 text-decoration-none" style="color:var(--color-primary-dark)">
              ✈️ ${b.nombre}
            </a>
            <p class="text-muted small mb-0">
              ${formatearFecha(b.fecha_inicio)} — ${formatearFecha(b.fecha_fin)} · ${b.moneda}
            </p>
          </div>
          <div class="text-end">
            ${badgeBalance}
            <p class="text-muted small mb-0 mt-1">
              Total viaje: <strong>${formatearMonto(b.totalViaje, b.moneda)}</strong>
              · Por persona: <strong>${formatearMonto(b.porPersona, b.moneda)}</strong>
            </p>
          </div>
        </div>

        <!-- Detalle del balance por integrante -->
        <p class="section-label mb-2">Detalle de deudas</p>
        ${deudasHTML}

        <div class="mt-3 text-end">
          <a href="viaje.html?id=${b.id_viaje}" class="btn btn-sm btn-outline-primary px-3 fw-bold">
            Ver viaje →
          </a>
        </div>
      </div>
    `;
  }).join("");
}

/* ---- Filtros ---- */
document.querySelectorAll(".btn-filtro").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".btn-filtro").forEach(b => b.classList.remove("activo"));
    this.classList.add("activo");

    const filtro = this.getAttribute("data-filtro");

    if (filtro === "todos") {
      renderizarBalances(todosBalances);
    } else {
      const filtrados = todosBalances.filter(b => {
        if (filtro === "debes")    return b.miBalance < 0;
        if (filtro === "tedeben")  return b.miBalance > 0;
        if (filtro === "saldado")  return b.miBalance === 0;
        return true;
      });
      renderizarBalances(filtrados);
    }
  });
});

/* ---- Calcular balances ---- */
async function cargarBalances() {

  // 1. Obtener viajes donde el usuario es integrante
  const { data: integrantesData, error: errInt } = await supabase
    .from("integrantes_viaje")
    .select("id_viaje")
    .eq("id_usuario", usuario.id_usuario);

  if (errInt || !integrantesData || integrantesData.length === 0) {
    document.getElementById("spinnerBalances").style.display = "none";
    document.getElementById("contenidoBalances").classList.remove("d-none");
    renderizarBalances([]);
    return;
  }

  const idsViajes = integrantesData.map(i => i.id_viaje);

  // 2. Datos de los viajes
  const { data: viajes } = await supabase
    .from("viajes")
    .select("*")
    .in("id_viaje", idsViajes)
    .order("fecha_creacion", { ascending: false });

  // 3. Para cada viaje calcular el balance
  const balancesPromises = (viajes || []).map(async (viaje) => {

    // Integrantes del viaje
    const { data: integrantes } = await supabase
      .from("integrantes_viaje")
      .select("id_usuario, usuarios(nombre)")
      .eq("id_viaje", viaje.id_viaje);

    // Gastos del viaje
    const { data: gastos } = await supabase
      .from("gastos")
      .select("id_usuario_pagador, monto, categoria")
      .eq("id_viaje", viaje.id_viaje);

    const numIntegrantes = (integrantes || []).length;
    const totalViaje     = (gastos || []).reduce((sum, g) => sum + parseFloat(g.monto), 0);
    const porPersona     = numIntegrantes > 0 ? totalViaje / numIntegrantes : 0;

    // Cuánto pagó cada uno
    const pagadoPor = {};
    (integrantes || []).forEach(i => { pagadoPor[i.id_usuario] = 0; });
    (gastos || []).forEach(g => {
      if (pagadoPor[g.id_usuario_pagador] !== undefined) {
        pagadoPor[g.id_usuario_pagador] += parseFloat(g.monto);
      }
    });

    // Balance por persona (positivo = le deben, negativo = debe)
    const balancePorPersona = {};
    (integrantes || []).forEach(i => {
      balancePorPersona[i.id_usuario] = (pagadoPor[i.id_usuario] || 0) - porPersona;
    });

    // Mi balance en este viaje
    const miBalance = balancePorPersona[usuario.id_usuario] || 0;

    // Calcular deudas simplificadas (quién le debe a quién)
    const deudas = [];
    const deudores  = (integrantes || []).filter(i => balancePorPersona[i.id_usuario] < -0.01);
    const acreedores = (integrantes || []).filter(i => balancePorPersona[i.id_usuario] > 0.01);

    const saldosDeudores   = deudores.map(i => ({ ...i, saldo: Math.abs(balancePorPersona[i.id_usuario]) }));
    const saldosAcreedores = acreedores.map(i => ({ ...i, saldo: balancePorPersona[i.id_usuario] }));

    let di = 0, ai = 0;
    while (di < saldosDeudores.length && ai < saldosAcreedores.length) {
      const deudor   = saldosDeudores[di];
      const acreedor = saldosAcreedores[ai];
      const monto    = Math.min(deudor.saldo, acreedor.saldo);

      if (monto > 0.01) {
        deudas.push({
          deudor:         deudor.id_usuario,
          acreedor:       acreedor.id_usuario,
          nombreDeudor:   deudor.usuarios.nombre,
          nombreAcreedor: acreedor.usuarios.nombre,
          monto:          Math.round(monto * 100) / 100
        });
      }

      deudor.saldo   -= monto;
      acreedor.saldo -= monto;
      if (deudor.saldo   < 0.01) di++;
      if (acreedor.saldo < 0.01) ai++;
    }

    // Gastos por categoría
    const gastosPorCategoria = { hospedaje: 0, comida: 0, transporte: 0, actividades: 0, compras: 0, general: 0 };
    (gastos || []).forEach(g => {
      if (gastosPorCategoria[g.categoria] !== undefined) {
        gastosPorCategoria[g.categoria] += parseFloat(g.monto);
      }
    });

    return {
      id_viaje:    viaje.id_viaje,
      nombre:      viaje.nombre,
      descripcion: viaje.descripcion,
      fecha_inicio: viaje.fecha_inicio,
      fecha_fin:   viaje.fecha_fin,
      moneda:      viaje.moneda,
      estado:      viaje.estado,
      totalViaje,
      porPersona,
      miBalance:   Math.round(miBalance * 100) / 100,
      deudas,
      gastosPorCategoria
    };
  });

  todosBalances = await Promise.all(balancesPromises);

  // 4. Calcular resumen global
  let globalPagado = 0;
  let globalTeDeben = 0;
  let globalDebes  = 0;

  todosBalances.forEach(b => {
    // Total pagado por el usuario en este viaje
    globalPagado += b.totalViaje > 0
      ? (b.miBalance + b.porPersona)
      : 0;
    if (b.miBalance > 0) globalTeDeben += b.miBalance;
    if (b.miBalance < 0) globalDebes   += Math.abs(b.miBalance);
  });

  const neto = globalTeDeben - globalDebes;

  document.getElementById("globalTotalPagado").textContent = globalPagado > 0
    ? "$" + globalPagado.toFixed(2) : "$0.00";
  document.getElementById("globalTeDeben").textContent = "$" + globalTeDeben.toFixed(2);
  document.getElementById("globalDebes").textContent   = "$" + globalDebes.toFixed(2);
  document.getElementById("globalNeto").textContent    = (neto >= 0 ? "+" : "") + "$" + neto.toFixed(2);
  document.getElementById("globalNeto").style.color    = neto >= 0 ? "#74c69d" : "#f4a261";

  // 5. Mostrar contenido
  document.getElementById("spinnerBalances").style.display = "none";
  document.getElementById("contenidoBalances").classList.remove("d-none");
  renderizarBalances(todosBalances);
  renderizarDashboard(todosBalances);
}

/* ---- Renderizar dashboard con gráficas ---- */
function renderizarDashboard(balances) {
  if (!balances || balances.length === 0) return;

  // Mini stats
  const totalViajes    = balances.length;
  const totalGastos    = balances.reduce((s, b) => s + b.totalViaje, 0);
  const viajesSaldados = balances.filter(b => Math.abs(b.miBalance) < 0.01).length;
  const viajesPend     = balances.filter(b => Math.abs(b.miBalance) >= 0.01).length;

  document.getElementById("dashViajes").textContent     = totalViajes;
  document.getElementById("dashGastos").textContent     = "$" + totalGastos.toFixed(0);
  document.getElementById("dashSaldados").textContent   = viajesSaldados;
  document.getElementById("dashPendientes").textContent = viajesPend;

  const labels   = balances.map(b => b.nombre.length > 12 ? b.nombre.substring(0,12)+"..." : b.nombre);
  const colVerde = "rgba(45,106,79,0.8)";
  const colRojo  = "rgba(192,57,43,0.8)";
  const colAmbar = "rgba(212,160,23,0.8)";

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { font: { family: "Montserrat", size: 11 }, color: "#1a3d2b" } } },
    scales: {
      x: { ticks: { font: { family: "Lato", size: 10 }, color: "#52796f" }, grid: { color: "rgba(0,0,0,0.05)" } },
      y: { ticks: { font: { family: "Lato", size: 10 }, color: "#52796f" }, grid: { color: "rgba(0,0,0,0.05)" } }
    }
  };

  // 1. Gasto total por viaje (barras)
  new Chart(document.getElementById("chartGastosPorViaje"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Total gastado",
        data: balances.map(b => b.totalViaje.toFixed(2)),
        backgroundColor: balances.map((_, i) => `rgba(45,106,79,${0.5 + (i * 0.1) % 0.5})`),
        borderColor: "rgba(45,106,79,1)",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
  });

  // 2. Mi balance por viaje (barras + / -)
  new Chart(document.getElementById("chartBalancePorViaje"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Mi balance",
        data: balances.map(b => b.miBalance.toFixed(2)),
        backgroundColor: balances.map(b => b.miBalance >= 0 ? colVerde : colRojo),
        borderColor: balances.map(b => b.miBalance >= 0 ? "rgba(45,106,79,1)" : "rgba(192,57,43,1)"),
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      ...chartDefaults,
      plugins: { ...chartDefaults.plugins, legend: { display: false } },
      scales: {
        ...chartDefaults.scales,
        y: { ...chartDefaults.scales.y, beginAtZero: false }
      }
    }
  });

  // 3. Distribución: te deben / debes / saldado (dona)
  const teDeben  = balances.filter(b => b.miBalance > 0.01).length;
  const debes    = balances.filter(b => b.miBalance < -0.01).length;
  const saldados = balances.filter(b => Math.abs(b.miBalance) <= 0.01).length;

  new Chart(document.getElementById("chartDistribucion"), {
    type: "doughnut",
    data: {
      labels: ["Te deben", "Debes", "Saldado"],
      datasets: [{
        data: [teDeben, debes, saldados],
        backgroundColor: [colVerde, colRojo, colAmbar],
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { position: "bottom", labels: { font: { family: "Montserrat", size: 11 }, color: "#1a3d2b" } } }
    }
  });

  // 4. Categorías acumuladas — necesitamos los gastos de cada viaje
  // Usamos las deudas simplificadas por categoría si están disponibles
  // Por ahora calculamos desde los gastos que ya tenemos en todosBalances
  const catMap = { hospedaje: 0, comida: 0, transporte: 0, actividades: 0, compras: 0, general: 0 };
  balances.forEach(b => {
    if (b.gastosPorCategoria) {
      Object.keys(catMap).forEach(k => { catMap[k] += b.gastosPorCategoria[k] || 0; });
    }
  });
  const catLabels = ["🏨 Hospedaje", "🍽️ Comida", "🚗 Transporte", "🎯 Activ.", "🛍️ Compras", "📦 General"];
  const catData   = Object.values(catMap);
  const catColors = ["rgba(45,106,79,0.8)","rgba(82,121,111,0.8)","rgba(116,198,157,0.8)","rgba(212,160,23,0.8)","rgba(192,57,43,0.7)","rgba(26,61,43,0.7)"];

  new Chart(document.getElementById("chartCategorias"), {
    type: "doughnut",
    data: {
      labels: catLabels,
      datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 2, borderColor: "#fff" }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { position: "bottom", labels: { font: { family: "Montserrat", size: 10 }, color: "#1a3d2b" } } }
    }
  });

  // 5. Pagado vs. corresponde por viaje (barras apiladas)
  new Chart(document.getElementById("chartPagadoVsCorresponde"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Lo que pagué",
          data: balances.map(b => (b.miBalance + b.porPersona).toFixed(2)),
          backgroundColor: colVerde,
          borderRadius: 4
        },
        {
          label: "Lo que me corresponde",
          data: balances.map(b => b.porPersona.toFixed(2)),
          backgroundColor: colAmbar,
          borderRadius: 4
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: { legend: { position: "bottom", labels: { font: { family: "Montserrat", size: 11 }, color: "#1a3d2b" } } }
    }
  });
}

/* ---- Iniciar ---- */
cargarBalances();
