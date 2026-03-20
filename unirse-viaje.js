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
let viajeEncontrado = null;

/* ---- Helpers ---- */
function formatearFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "numeric" });
}

/* ---- Forzar mayúsculas en el input ---- */
document.getElementById("codigo").addEventListener("input", function () {
  this.value = this.value.toUpperCase();
});

/* ---- Buscar viaje por código ---- */
const formBuscar = document.getElementById("formBuscarViaje");

formBuscar.addEventListener("submit", async function (e) {
  e.preventDefault();

  document.getElementById("mensajeBusqueda").innerHTML = "";
  document.getElementById("panelViaje").classList.add("d-none");
  viajeEncontrado = null;

  const codigo = document.getElementById("codigo").value.trim().toUpperCase();

  if (!codigo) {
    document.getElementById("mensajeBusqueda").innerHTML =
      "<div class='alert alert-warning'>Por favor ingresa el código de invitación.</div>";
    return;
  }

  const btn = document.getElementById("btnBuscar");
  btn.disabled = true;
  btn.textContent = "Buscando...";

  // Buscar viaje por código
  const { data: viaje, error } = await supabase
    .from("viajes")
    .select("*")
    .eq("codigo_invitacion", codigo)
    .single();

  btn.disabled = false;
  btn.textContent = "Buscar viaje";

  if (error || !viaje) {
    document.getElementById("mensajeBusqueda").innerHTML =
      "<div class='alert alert-danger'>No se encontró ningún viaje con ese código. Verifica que esté escrito correctamente.</div>";
    return;
  }

  // Verificar que el viaje esté activo
  if (viaje.estado !== "activo") {
    document.getElementById("mensajeBusqueda").innerHTML =
      "<div class='alert alert-warning'>Este viaje ya fue cerrado y no acepta nuevos integrantes.</div>";
    return;
  }

  // Verificar si ya es integrante
  const { data: yaIntegrante } = await supabase
    .from("integrantes_viaje")
    .select("id_integrante")
    .eq("id_viaje", viaje.id_viaje)
    .eq("id_usuario", usuario.id_usuario)
    .single();

  if (yaIntegrante) {
    document.getElementById("mensajeBusqueda").innerHTML =
      "<div class='alert alert-info'>Ya eres integrante de este viaje. <a href='viaje.html?id=" + viaje.id_viaje + "'>Ver viaje →</a></div>";
    return;
  }

  // Contar integrantes actuales
  const { count } = await supabase
    .from("integrantes_viaje")
    .select("*", { count: "exact", head: true })
    .eq("id_viaje", viaje.id_viaje);

  // Mostrar panel con info del viaje
  viajeEncontrado = viaje;

  document.getElementById("viajeNombre").textContent       = viaje.nombre;
  document.getElementById("viajeFechaInicio").textContent  = formatearFecha(viaje.fecha_inicio);
  document.getElementById("viajeFechaFin").textContent     = formatearFecha(viaje.fecha_fin);
  document.getElementById("viajeMoneda").textContent       = viaje.moneda;
  document.getElementById("viajeIntegrantes").textContent  = (count || 0) + " personas";
  document.getElementById("viajeDescripcion").textContent  = viaje.descripcion || "Sin descripción";

  document.getElementById("panelViaje").classList.remove("d-none");
  document.getElementById("mensajeUnirse").innerHTML = "";

  // Reset botón unirse
  const btnUnirse = document.getElementById("btnUnirse");
  btnUnirse.disabled = false;
  btnUnirse.textContent = "✅ Unirme a este viaje";
});

/* ---- Unirse al viaje ---- */
document.getElementById("btnUnirse").addEventListener("click", async function () {
  if (!viajeEncontrado) return;

  this.disabled = true;
  this.textContent = "Uniéndote...";

  const { error } = await supabase
    .from("integrantes_viaje")
    .insert([{
      id_viaje:   viajeEncontrado.id_viaje,
      id_usuario: usuario.id_usuario
    }]);

  if (error) {
    document.getElementById("mensajeUnirse").innerHTML =
      "<div class='alert alert-danger'>Error al unirte al viaje: " + error.message + "</div>";
    this.disabled = false;
    this.textContent = "✅ Unirme a este viaje";
    return;
  }

  document.getElementById("mensajeUnirse").innerHTML =
    "<div class='alert alert-success'>🎉 ¡Te uniste exitosamente! Redirigiendo al viaje...</div>";

  setTimeout(() => {
    window.location.href = "viaje.html?id=" + viajeEncontrado.id_viaje;
  }, 1800);
});
