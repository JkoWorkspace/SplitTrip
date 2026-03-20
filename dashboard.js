import { supabase } from "./supabase.js";

/* ---- Proteger página: requiere sesión activa ---- */
const usuario = JSON.parse(localStorage.getItem("usuario"));
if (!usuario) {
  window.location.href = "login.html";
}

/* ---- Mostrar nombre en navbar y saludo ---- */
document.getElementById("navNombreUsuario").textContent = "👤 " + usuario.nombre;
document.getElementById("saludo").textContent = "Bienvenido, " + usuario.nombre + " 👋";

/* ---- Cerrar sesión ---- */
document.getElementById("btnCerrarSesion").addEventListener("click", function () {
  localStorage.removeItem("usuario");
  window.location.href = "login.html";
});

/* ---- Variable global para todos los viajes ---- */
let todosViajes = [];

/* ---- Helpers ---- */
function formatearFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "numeric" });
}

function badgeEstado(estado) {
  const map = {
    activo:  "<span class='badge-estado badge-activo'>🟢 Activo</span>",
    cerrado: "<span class='badge-estado badge-cerrado'>⚫ Cerrado</span>"
  };
  return map[estado] || `<span class='badge-estado badge-cerrado'>${estado}</span>`;
}

/* ---- Renderizar lista de viajes ---- */
function renderizarViajes(viajes) {
  const container = document.getElementById("listaViajes");

  if (!viajes || viajes.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:3rem;">🌍</div>
        <p class="fw-bold fs-5 mb-1 mt-2">Sin viajes registrados</p>
        <p class="text-muted small">Crea tu primer viaje o únete al de un amigo.</p>
        <a href="nuevo-viaje.html" class="btn btn-primary mt-2 px-4">+ Crear viaje</a>
      </div>
    `;
    return;
  }

  const tarjetas = viajes.map(v => `
    <div class="viaje-card" onclick="window.location.href='viaje.html?id=${v.id_viaje}'">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <p class="fw-bold mb-0 fs-6" style="color:var(--color-primary-dark)">${v.nombre}</p>
          ${v.descripcion ? `<p class="text-muted small mb-0">${v.descripcion}</p>` : ""}
        </div>
        ${badgeEstado(v.estado)}
      </div>
      <div class="row g-2 mt-1">
        <div class="col-6 col-md-3">
          <p class="gasto-label">Fecha inicio</p>
          <p class="gasto-valor">${formatearFecha(v.fecha_inicio)}</p>
        </div>
        <div class="col-6 col-md-3">
          <p class="gasto-label">Fecha fin</p>
          <p class="gasto-valor">${formatearFecha(v.fecha_fin)}</p>
        </div>
        <div class="col-6 col-md-3">
          <p class="gasto-label">Moneda</p>
          <p class="gasto-valor">${v.moneda}</p>
        </div>
        <div class="col-6 col-md-3">
          <p class="gasto-label">Código invitación</p>
          <p class="gasto-valor">
            <code style="color:var(--color-primary);font-weight:700;">${v.codigo_invitacion}</code>
          </p>
        </div>
      </div>
      <p class="dashboard-card-link mt-2 mb-0">Ver viaje →</p>
    </div>
  `).join("");

  container.innerHTML = tarjetas;
}

/* ---- Filtros ---- */
document.querySelectorAll(".btn-filtro").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".btn-filtro").forEach(b => b.classList.remove("activo"));
    this.classList.add("activo");

    const filtro = this.getAttribute("data-filtro");
    if (filtro === "todos") {
      renderizarViajes(todosViajes);
    } else {
      renderizarViajes(todosViajes.filter(v => v.estado === filtro));
    }
  });
});

/* ---- Cargar viajes del usuario desde Supabase ---- */
async function cargarViajes() {
  document.getElementById("spinnerViajes").style.display = "block";
  document.getElementById("listaViajes").innerHTML = "";

  // Traer viajes donde el usuario es creador O integrante
  const { data: integrantes, error: errInt } = await supabase
    .from("integrantes_viaje")
    .select("id_viaje")
    .eq("id_usuario", usuario.id_usuario);

  if (errInt) {
    document.getElementById("spinnerViajes").style.display = "none";
    document.getElementById("listaViajes").innerHTML =
      "<div class='alert alert-danger'>Error al cargar viajes: " + errInt.message + "</div>";
    return;
  }

  // Obtener ids de viajes donde es integrante
  const idsViajes = integrantes.map(i => i.id_viaje);

  if (idsViajes.length === 0) {
    document.getElementById("spinnerViajes").style.display = "none";
    renderizarViajes([]);
    return;
  }

  // Traer detalle de esos viajes
  const { data, error } = await supabase
    .from("viajes")
    .select("*")
    .in("id_viaje", idsViajes)
    .order("fecha_creacion", { ascending: false });

  document.getElementById("spinnerViajes").style.display = "none";

  if (error) {
    document.getElementById("listaViajes").innerHTML =
      "<div class='alert alert-danger'>Error al cargar viajes: " + error.message + "</div>";
    return;
  }

  todosViajes = data || [];
  renderizarViajes(todosViajes);
}

/* ---- Iniciar ---- */
cargarViajes();
