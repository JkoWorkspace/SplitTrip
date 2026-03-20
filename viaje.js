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

/* ---- Obtener id del viaje desde la URL ---- */
const params  = new URLSearchParams(window.location.search);
const idViaje = parseInt(params.get("id"));

if (!idViaje) {
  window.location.href = "dashboard.html";
}

/* ---- Variables globales ---- */
let todosGastos    = [];
let integrantes    = [];
let monedaViaje    = "USD";
let codigoViaje    = "";
let viajeData      = null;   // datos completos del viaje

/* ---- Helpers ---- */
function formatearFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "numeric" });
}

function formatearMonto(monto, moneda) {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: moneda }).format(monto);
}

function badgeEstado(estado) {
  const map = {
    activo:  "<span class='badge-estado badge-activo'>🟢 Activo</span>",
    cerrado: "<span class='badge-estado badge-cerrado'>⚫ Cerrado</span>"
  };
  return map[estado] || `<span class='badge-estado badge-cerrado'>${estado}</span>`;
}

function badgeCategoria(cat) {
  const map = {
    hospedaje:   { icon: "🏨", clase: "badge-recibido" },
    comida:      { icon: "🍽️", clase: "badge-activo"   },
    transporte:  { icon: "🚗", clase: "badge-pendiente" },
    actividades: { icon: "🎯", clase: "badge-pagado"    },
    compras:     { icon: "🛍️", clase: "badge-deuda"     },
    general:     { icon: "📦", clase: "badge-cerrado"   }
  };
  const c = map[cat] || { icon: "📦", clase: "badge-cerrado" };
  return `<span class="badge-estado ${c.clase}">${c.icon} ${cat}</span>`;
}

/* ---- Copiar código de invitación ---- */
window.copiarCodigo = function () {
  if (!codigoViaje) return;
  navigator.clipboard.writeText(codigoViaje).then(() => {
    const btn = document.querySelector("[onclick='copiarCodigo()']");
    const original = btn.textContent;
    btn.textContent = "✅";
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
};

/* ---- Ver factura en modal ---- */
window.verFactura = function (url, descripcion) {
  document.getElementById("modalFacturaLabel").textContent = "🧾 " + descripcion;
  document.getElementById("imagenFactura").src = url;
  new bootstrap.Modal(document.getElementById("modalFactura")).show();
};

/* ---- Ver balance detallado en modal ---- */
window.verBalanceDetalle = function () {
  const body = document.getElementById("modalBalanceBody");

  if (integrantes.length === 0 || todosGastos.length === 0) {
    body.innerHTML = "<p class='text-muted text-center py-3'>No hay gastos registrados aún.</p>";
    new bootstrap.Modal(document.getElementById("modalBalance")).show();
    return;
  }

  // Calcular cuánto pagó cada uno y cuánto le corresponde
  const totalGastos = todosGastos.reduce((sum, g) => sum + parseFloat(g.monto), 0);
  const porPersona  = totalGastos / integrantes.length;

  const pagadoPor = {};
  integrantes.forEach(i => { pagadoPor[i.id_usuario] = 0; });
  todosGastos.forEach(g => {
    if (pagadoPor[g.id_usuario_pagador] !== undefined) {
      pagadoPor[g.id_usuario_pagador] += parseFloat(g.monto);
    }
  });

  // Balance por persona (positivo = le deben, negativo = debe)
  const balances = integrantes.map(i => ({
    nombre:  i.usuarios.nombre,
    balance: (pagadoPor[i.id_usuario] || 0) - porPersona
  }));

  const filas = balances.map(b => `
    <div class="balance-item d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center gap-2">
        <div class="cuenta-avatar" style="width:36px;height:36px;font-size:0.85rem;">
          ${b.nombre.charAt(0).toUpperCase()}
        </div>
        <span class="fw-semibold">${b.nombre}</span>
      </div>
      <div class="text-end">
        <span class="fw-bold" style="color:${b.balance >= 0 ? 'var(--color-primary)' : '#c0392b'}">
          ${b.balance >= 0 ? "+" : ""}${formatearMonto(b.balance, monedaViaje)}
        </span>
        <br>
        <small class="text-muted">${b.balance >= 0 ? "le deben" : "debe"}</small>
      </div>
    </div>
  `).join("");

  body.innerHTML = `
    <div class="dashboard-banner rounded-3 p-3 mb-4">
      <div class="row text-center">
        <div class="col-6">
          <p class="text-white-50 small mb-0 text-uppercase fw-bold">Total del viaje</p>
          <p class="text-white fw-bold fs-5 mb-0">${formatearMonto(totalGastos, monedaViaje)}</p>
        </div>
        <div class="col-6">
          <p class="text-white-50 small mb-0 text-uppercase fw-bold">Por persona</p>
          <p class="text-white fw-bold fs-5 mb-0">${formatearMonto(porPersona, monedaViaje)}</p>
        </div>
      </div>
    </div>
    <p class="section-label">Desglose por integrante</p>
    ${filas}
    <p class="text-muted small mt-3">
      ✅ Positivo = pagó más de lo que le correspondía (le deben dinero)<br>
      ❌ Negativo = pagó menos de lo que le correspondía (debe dinero)
    </p>
  `;

  new bootstrap.Modal(document.getElementById("modalBalance")).show();
};

/* ---- Renderizar integrantes ---- */
function renderizarIntegrantes(data) {
  const container = document.getElementById("listaIntegrantes");
  if (!data || data.length === 0) {
    container.innerHTML = "<p class='text-muted small'>Sin integrantes aún.</p>";
    return;
  }
  container.innerHTML = data.map(i => `
    <div class="d-flex align-items-center gap-2 mb-2">
      <div class="cuenta-avatar" style="width:36px;height:36px;font-size:0.85rem;flex-shrink:0;">
        ${i.usuarios.nombre.charAt(0).toUpperCase()}
      </div>
      <div>
        <p class="mb-0 fw-semibold small">${i.usuarios.nombre}</p>
        <p class="mb-0 text-muted" style="font-size:0.75rem;">${i.usuarios.correo}</p>
      </div>
      ${i.id_usuario === usuario.id_usuario
        ? "<span class='badge-estado badge-activo ms-auto' style='font-size:0.7rem;'>Tú</span>"
        : ""}
    </div>
  `).join("");
}

/* ---- Renderizar gastos ---- */
function renderizarGastos(gastos) {
  const container = document.getElementById("listaGastos");

  if (!gastos || gastos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:2.5rem;">💸</div>
        <p class="fw-bold mt-2 mb-1">Sin gastos registrados</p>
        <p class="text-muted small">Agrega el primer gasto del viaje.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = gastos.map(g => `
    <div class="gasto-card">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <p class="fw-bold mb-0" style="color:var(--color-primary-dark)">${g.descripcion}</p>
          <p class="text-muted small mb-0">
            Pagado por: <strong>${g.usuarios?.nombre || "—"}</strong> ·
            ${formatearFecha(g.fecha)}
          </p>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          ${badgeCategoria(g.categoria)}
          ${g.url_factura
            ? `<button class="btn btn-sm btn-outline-primary px-2 py-1 fw-bold"
                onclick="verFactura('${g.url_factura}', '${g.descripcion.replace(/'/g, "\\'")}')">
                🧾 Ver factura
               </button>`
            : ""}
        </div>
      </div>
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <p class="gasto-label mb-0">Monto total</p>
          <p class="fw-bold mb-0 fs-5" style="color:var(--color-primary)">
            ${formatearMonto(g.monto, monedaViaje)}
          </p>
        </div>
        <div class="text-end">
          <p class="gasto-label mb-0">Cada quien debe</p>
          <p class="fw-bold mb-0" style="color:var(--color-secondary)">
            ${formatearMonto(g.monto / integrantes.length, monedaViaje)}
          </p>
        </div>
      </div>
    </div>
  `).join("");
}

/* ---- Filtros por categoría ---- */
document.querySelectorAll(".btn-filtro").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".btn-filtro").forEach(b => b.classList.remove("activo"));
    this.classList.add("activo");
    const filtro = this.getAttribute("data-filtro");
    renderizarGastos(filtro === "todos" ? todosGastos : todosGastos.filter(g => g.categoria === filtro));
  });
});

/* ---- Botón agregar gasto ---- */
document.querySelector("[onclick*='nuevo-gasto']").addEventListener("click", function () {
  window.location.href = "nuevo-gasto.html?id=" + idViaje;
});

/* ---- Cargar todo ---- */
async function cargarViaje() {
  // 1. Datos del viaje
  const { data: viaje, error: errViaje } = await supabase
    .from("viajes")
    .select("*")
    .eq("id_viaje", idViaje)
    .single();

  if (errViaje || !viaje) {
    window.location.href = "dashboard.html";
    return;
  }

  // Verificar que el usuario es integrante
  const { data: esIntegrante } = await supabase
    .from("integrantes_viaje")
    .select("id_integrante")
    .eq("id_viaje", idViaje)
    .eq("id_usuario", usuario.id_usuario)
    .single();

  if (!esIntegrante) {
    window.location.href = "dashboard.html";
    return;
  }

  // Guardar datos del viaje
  viajeData   = viaje;
  monedaViaje = viaje.moneda;
  codigoViaje = viaje.codigo_invitacion;

  document.getElementById("tituloViaje").textContent         = viaje.nombre;
  document.getElementById("descripcionViaje").textContent    = viaje.descripcion || "";
  document.getElementById("badgeEstadoViaje").innerHTML      = badgeEstado(viaje.estado);
  document.getElementById("infoFechaInicio").textContent     = formatearFecha(viaje.fecha_inicio);
  document.getElementById("infoFechaFin").textContent        = formatearFecha(viaje.fecha_fin);
  document.getElementById("infoMoneda").textContent          = viaje.moneda;
  document.getElementById("infoCodigo").textContent          = viaje.codigo_invitacion;

  // 2. Integrantes con datos de usuario
  const { data: dataInt } = await supabase
    .from("integrantes_viaje")
    .select("id_usuario, usuarios(nombre, correo)")
    .eq("id_viaje", idViaje);

  integrantes = dataInt || [];
  renderizarIntegrantes(integrantes);

  // 3. Gastos con datos del pagador
  const { data: dataGastos } = await supabase
    .from("gastos")
    .select("*, usuarios(nombre)")
    .eq("id_viaje", idViaje)
    .order("fecha_creacion", { ascending: false });

  todosGastos = dataGastos || [];

  // Total de gastos
  const total = todosGastos.reduce((sum, g) => sum + parseFloat(g.monto), 0);
  document.getElementById("infoTotalGastos").textContent = formatearMonto(total, monedaViaje);

  // Resumen del balance
  const porPersona = integrantes.length > 0 ? total / integrantes.length : 0;
  document.getElementById("resumenBalance").textContent =
    `Total: ${formatearMonto(total, monedaViaje)} · Cada quien: ${formatearMonto(porPersona, monedaViaje)}`;

  renderizarGastos(todosGastos);

  // Mostrar botones de editar/cerrar solo si el usuario es el creador
  if (viaje.id_creador === usuario.id_usuario) {
    document.getElementById("btnEditarViaje").classList.remove("d-none");
    if (viaje.estado === "activo") {
      document.getElementById("btnCerrarViaje").classList.remove("d-none");
    }
  }

  // Mostrar contenido
  document.getElementById("spinnerViaje").style.display  = "none";
  document.getElementById("contenidoViaje").classList.remove("d-none");
}


/* ---- Abrir modal de editar con datos actuales ---- */
window.abrirModalEditar = function () {
  if (!viajeData) return;
  document.getElementById("editNombre").value       = viajeData.nombre;
  document.getElementById("editDescripcion").value  = viajeData.descripcion || "";
  document.getElementById("editFechaInicio").value  = viajeData.fecha_inicio || "";
  document.getElementById("editFechaFin").value     = viajeData.fecha_fin    || "";
  document.getElementById("editMoneda").value       = viajeData.moneda;
  document.getElementById("mensajeEdicion").innerHTML = "";
  new bootstrap.Modal(document.getElementById("modalEditarViaje")).show();
};

/* ---- Guardar edición del viaje ---- */
document.getElementById("formEditarViaje").addEventListener("submit", async function (e) {
  e.preventDefault();
  document.getElementById("mensajeEdicion").innerHTML = "";

  const nombre      = document.getElementById("editNombre").value.trim();
  const descripcion = document.getElementById("editDescripcion").value.trim();
  const fechaInicio = document.getElementById("editFechaInicio").value || null;
  const fechaFin    = document.getElementById("editFechaFin").value    || null;
  const moneda      = document.getElementById("editMoneda").value;

  if (!nombre) {
    document.getElementById("mensajeEdicion").innerHTML =
      "<div class='alert alert-warning'>El nombre del viaje es obligatorio.</div>";
    return;
  }

  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    document.getElementById("mensajeEdicion").innerHTML =
      "<div class='alert alert-warning'>La fecha fin no puede ser anterior a la fecha inicio.</div>";
    return;
  }

  const btn = document.getElementById("btnGuardarEdicion");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const { error } = await supabase
    .from("viajes")
    .update({
      nombre:      nombre,
      descripcion: descripcion || null,
      fecha_inicio: fechaInicio,
      fecha_fin:   fechaFin,
      moneda:      moneda
    })
    .eq("id_viaje", idViaje);

  if (error) {
    document.getElementById("mensajeEdicion").innerHTML =
      "<div class='alert alert-danger'>Error al guardar: " + error.message + "</div>";
    btn.disabled = false;
    btn.textContent = "Guardar cambios";
    return;
  }

  // Actualizar datos locales y vista
  viajeData.nombre      = nombre;
  viajeData.descripcion = descripcion || null;
  viajeData.fecha_inicio = fechaInicio;
  viajeData.fecha_fin   = fechaFin;
  viajeData.moneda      = moneda;
  monedaViaje           = moneda;

  document.getElementById("tituloViaje").textContent      = nombre;
  document.getElementById("descripcionViaje").textContent = descripcion || "";
  document.getElementById("infoFechaInicio").textContent  = formatearFecha(fechaInicio);
  document.getElementById("infoFechaFin").textContent     = formatearFecha(fechaFin);
  document.getElementById("infoMoneda").textContent       = moneda;

  document.getElementById("mensajeEdicion").innerHTML =
    "<div class='alert alert-success'>✅ Viaje actualizado correctamente.</div>";

  btn.disabled = false;
  btn.textContent = "Guardar cambios";

  setTimeout(() => {
    bootstrap.Modal.getInstance(document.getElementById("modalEditarViaje")).hide();
  }, 1500);
});

/* ---- Cerrar viaje ---- */
window.confirmarCerrarViaje = function () {
  if (!confirm("¿Estás seguro de que deseas cerrar este viaje? Ya no se podrán agregar nuevos gastos ni integrantes.")) return;

  supabase
    .from("viajes")
    .update({ estado: "cerrado" })
    .eq("id_viaje", idViaje)
    .then(({ error }) => {
      if (error) {
        alert("Error al cerrar el viaje: " + error.message);
        return;
      }
      viajeData.estado = "cerrado";
      document.getElementById("badgeEstadoViaje").innerHTML = badgeEstado("cerrado");
      document.getElementById("btnCerrarViaje").classList.add("d-none");
      document.getElementById("btnEditarViaje").classList.add("d-none");
      alert("✅ El viaje fue cerrado exitosamente.");
    });
};

/* ---- Iniciar ---- */
cargarViaje();
