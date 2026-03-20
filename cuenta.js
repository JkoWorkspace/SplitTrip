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

/* ---- Mostrar / ocultar contraseña ---- */
document.querySelectorAll(".btn-toggle-password").forEach(btn => {
  btn.addEventListener("click", function () {
    const input = document.getElementById(this.getAttribute("data-target"));
    input.type = input.type === "password" ? "text" : "password";
    this.textContent = input.type === "password" ? "👁" : "🙈";
  });
});

/* ---- Helpers ---- */
function formatearFechaCorta(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short" });
}

/* ---- Cargar datos del perfil y estadísticas ---- */
async function cargarPerfil() {

  // Datos frescos del usuario desde Supabase
  const { data: datosUsuario, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id_usuario", usuario.id_usuario)
    .single();

  if (error || !datosUsuario) return;

  // Header perfil
  document.getElementById("avatarInicial").textContent  = datosUsuario.nombre.charAt(0).toUpperCase();
  document.getElementById("perfilNombre").textContent   = datosUsuario.nombre;
  document.getElementById("perfilCorreo").textContent   = datosUsuario.correo;

  // Prellenar formulario de edición
  document.getElementById("editNombre").value   = datosUsuario.nombre;
  document.getElementById("editCorreo").value   = datosUsuario.correo;
  document.getElementById("editTelefono").value = datosUsuario.telefono || "";

  // Fecha de registro
  document.getElementById("statMiembro").textContent = formatearFechaCorta(datosUsuario.fecha_registro);

  // Estadísticas: viajes del usuario
  const { data: integrantesData } = await supabase
    .from("integrantes_viaje")
    .select("id_viaje")
    .eq("id_usuario", usuario.id_usuario);

  const idsViajes = (integrantesData || []).map(i => i.id_viaje);
  document.getElementById("statViajes").textContent = idsViajes.length;

  if (idsViajes.length > 0) {
    // Gastos pagados por el usuario
    const { count: countGastos } = await supabase
      .from("gastos")
      .select("*", { count: "exact", head: true })
      .eq("id_usuario_pagador", usuario.id_usuario);

    document.getElementById("statGastos").textContent = countGastos || 0;

    // Compañeros únicos (otros integrantes en sus mismos viajes)
    const { data: companeros } = await supabase
      .from("integrantes_viaje")
      .select("id_usuario")
      .in("id_viaje", idsViajes)
      .neq("id_usuario", usuario.id_usuario);

    const unicos = new Set((companeros || []).map(c => c.id_usuario));
    document.getElementById("statCompaneros").textContent = unicos.size;
  } else {
    document.getElementById("statGastos").textContent    = 0;
    document.getElementById("statCompaneros").textContent = 0;
  }
}

/* ---- Editar perfil ---- */
document.getElementById("formEditarPerfil").addEventListener("submit", async function (e) {
  e.preventDefault();
  document.getElementById("mensajePerfil").innerHTML = "";

  const nombre   = document.getElementById("editNombre").value.trim();
  const correo   = document.getElementById("editCorreo").value.trim();
  const telefono = document.getElementById("editTelefono").value.trim();

  if (!nombre || !correo) {
    document.getElementById("mensajePerfil").innerHTML =
      "<div class='alert alert-warning'>Nombre y correo son obligatorios.</div>";
    return;
  }

  const btn = document.getElementById("btnGuardarPerfil");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const { error } = await supabase
    .from("usuarios")
    .update({
      nombre:   nombre,
      correo:   correo,
      telefono: telefono || null
    })
    .eq("id_usuario", usuario.id_usuario);

  if (error) {
    document.getElementById("mensajePerfil").innerHTML =
      "<div class='alert alert-danger'>Error al guardar: " + error.message + "</div>";
    btn.disabled = false;
    btn.textContent = "Guardar cambios";
    return;
  }

  // Actualizar localStorage con los nuevos datos
  const usuarioActualizado = { ...usuario, nombre, correo, telefono: telefono || null };
  localStorage.setItem("usuario", JSON.stringify(usuarioActualizado));

  document.getElementById("perfilNombre").textContent  = nombre;
  document.getElementById("avatarInicial").textContent = nombre.charAt(0).toUpperCase();

  document.getElementById("mensajePerfil").innerHTML =
    "<div class='alert alert-success'>✅ Perfil actualizado correctamente.</div>";

  btn.disabled = false;
  btn.textContent = "Guardar cambios";
});

/* ---- Cambiar contraseña ---- */
document.getElementById("formCambiarPassword").addEventListener("submit", async function (e) {
  e.preventDefault();
  document.getElementById("mensajePassword").innerHTML      = "";
  document.getElementById("errorPasswordConfirmar").textContent = "";

  const actual    = document.getElementById("passwordActual").value;
  const nuevo     = document.getElementById("passwordNuevo").value;
  const confirmar = document.getElementById("passwordConfirmar").value;

  if (nuevo.length < 6) {
    document.getElementById("mensajePassword").innerHTML =
      "<div class='alert alert-warning'>La nueva contraseña debe tener al menos 6 caracteres.</div>";
    return;
  }

  if (nuevo !== confirmar) {
    document.getElementById("errorPasswordConfirmar").textContent =
      "Las contraseñas no coinciden.";
    return;
  }

  const btn = document.getElementById("btnCambiarPassword");
  btn.disabled = true;
  btn.textContent = "Verificando...";

  // Verificar contraseña actual
  const { data: verificacion, error: errVerif } = await supabase
    .from("usuarios")
    .select("id_usuario")
    .eq("id_usuario", usuario.id_usuario)
    .eq("password", actual)
    .single();

  if (errVerif || !verificacion) {
    document.getElementById("mensajePassword").innerHTML =
      "<div class='alert alert-danger'>La contraseña actual es incorrecta.</div>";
    btn.disabled = false;
    btn.textContent = "Cambiar contraseña";
    return;
  }

  // Actualizar contraseña
  const { error: errUpdate } = await supabase
    .from("usuarios")
    .update({ password: nuevo })
    .eq("id_usuario", usuario.id_usuario);

  if (errUpdate) {
    document.getElementById("mensajePassword").innerHTML =
      "<div class='alert alert-danger'>Error al cambiar la contraseña: " + errUpdate.message + "</div>";
    btn.disabled = false;
    btn.textContent = "Cambiar contraseña";
    return;
  }

  document.getElementById("mensajePassword").innerHTML =
    "<div class='alert alert-success'>✅ Contraseña actualizada correctamente.</div>";

  document.getElementById("formCambiarPassword").reset();
  btn.disabled = false;
  btn.textContent = "Cambiar contraseña";
});

/* ---- Iniciar ---- */
cargarPerfil();
