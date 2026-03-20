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

/* ---- Variable para guardar el código generado ---- */
let codigoViaje = "";
let idViaje     = null;

/* ---- Copiar código al portapapeles ---- */
window.copiarCodigo = function () {
  if (!codigoViaje) return;
  navigator.clipboard.writeText(codigoViaje).then(() => {
    const btn = document.querySelector("#panelCodigo .btn-warning");
    btn.textContent = "✅ Copiado";
    setTimeout(() => { btn.textContent = "📋 Copiar código"; }, 2000);
  });
};

/* ---- Submit del formulario ---- */
const form = document.getElementById("formNuevoViaje");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  document.getElementById("mensajeViaje").innerHTML = "";

  const nombre      = document.getElementById("nombre").value.trim();
  const descripcion = document.getElementById("descripcion").value.trim();
  const fechaInicio = document.getElementById("fechaInicio").value || null;
  const fechaFin    = document.getElementById("fechaFin").value    || null;
  const moneda      = document.getElementById("moneda").value;

  // Validación básica
  if (!nombre) {
    document.getElementById("mensajeViaje").innerHTML =
      "<div class='alert alert-warning'>Por favor ingresa el nombre del viaje.</div>";
    return;
  }

  // Validar que fecha fin no sea antes de fecha inicio
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    document.getElementById("mensajeViaje").innerHTML =
      "<div class='alert alert-warning'>La fecha de fin no puede ser anterior a la fecha de inicio.</div>";
    return;
  }

  const btn = document.getElementById("btnCrearViaje");
  btn.disabled = true;
  btn.textContent = "Creando viaje...";

  // 1. Insertar el viaje (el trigger genera el código automáticamente)
  const { data: viaje, error: errViaje } = await supabase
    .from("viajes")
    .insert([{
      nombre:            nombre,
      descripcion:       descripcion || null,
      fecha_inicio:      fechaInicio,
      fecha_fin:         fechaFin,
      moneda:            moneda,
      id_creador:        usuario.id_usuario,
      codigo_invitacion: ""   // el trigger lo reemplaza
    }])
    .select()
    .single();

  if (errViaje) {
    document.getElementById("mensajeViaje").innerHTML =
      "<div class='alert alert-danger'>Error al crear el viaje: " + errViaje.message + "</div>";
    btn.disabled = false;
    btn.textContent = "Crear viaje y obtener link";
    return;
  }

  // 2. Agregar al creador como primer integrante del viaje
  const { error: errInt } = await supabase
    .from("integrantes_viaje")
    .insert([{
      id_viaje:   viaje.id_viaje,
      id_usuario: usuario.id_usuario
    }]);

  if (errInt) {
    document.getElementById("mensajeViaje").innerHTML =
      "<div class='alert alert-warning'>Viaje creado pero hubo un error al agregarte como integrante: " + errInt.message + "</div>";
  }

  // 3. Mostrar panel con código generado
  codigoViaje = viaje.codigo_invitacion;
  idViaje     = viaje.id_viaje;

  document.getElementById("codigoGenerado").textContent = codigoViaje;
  document.getElementById("linkVerViaje").href = "viaje.html?id=" + idViaje;

  // Ocultar instrucciones y mostrar panel de código
  document.getElementById("panelInstrucciones").classList.add("d-none");
  document.getElementById("panelCodigo").classList.remove("d-none");

  btn.disabled = false;
  btn.textContent = "Crear viaje y obtener link";
});
