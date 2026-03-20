import { supabase } from "./supabase.js";

/* ---- Mostrar / ocultar contraseña ---- */
document.querySelectorAll(".btn-toggle-password").forEach(btn => {
  btn.addEventListener("click", function () {
    const targetId = this.getAttribute("data-target");
    const input = document.getElementById(targetId);
    input.type = input.type === "password" ? "text" : "password";
    this.textContent = input.type === "password" ? "👁" : "🙈";
  });
});

/* ---- Submit del formulario ---- */
const form = document.getElementById("formRegistro");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  // Limpiar errores previos
  document.getElementById("errorPassword").textContent = "";
  document.getElementById("errorConfirmar").textContent = "";
  document.getElementById("mensajeRegistro").innerHTML = "";

  // Obtener valores
  const nombre   = document.getElementById("nombre").value.trim();
  const correo   = document.getElementById("correo").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const password = document.getElementById("password").value;
  const confirmar = document.getElementById("confirmarPassword").value;

  // Validación: contraseña mínimo 6 caracteres
  if (password.length < 6) {
    document.getElementById("errorPassword").textContent =
      "La contraseña debe tener al menos 6 caracteres.";
    return;
  }

  // Validación: contraseñas coinciden
  if (password !== confirmar) {
    document.getElementById("errorConfirmar").textContent =
      "Las contraseñas no coinciden.";
    return;
  }

  // Deshabilitar botón mientras se procesa
  const btn = document.getElementById("btnRegistrar");
  btn.disabled = true;
  btn.textContent = "Creando cuenta...";

  // Insertar en Supabase
  const { error } = await supabase
    .from("usuarios")
    .insert([{
      nombre:   nombre,
      correo:   correo,
      password: password,
      telefono: telefono || null
    }]);

  if (error) {
    if (error.code === "23505") {
      document.getElementById("mensajeRegistro").innerHTML =
        "<div class='alert alert-danger'>Este correo ya está registrado. <a href='login.html'>Inicia sesión</a></div>";
    } else {
      document.getElementById("mensajeRegistro").innerHTML =
        "<div class='alert alert-danger'>Error al registrar: " + error.message + "</div>";
    }
    btn.disabled = false;
    btn.textContent = "Crear mi cuenta";
    return;
  }

  // Éxito
  document.getElementById("mensajeRegistro").innerHTML =
    "<div class='alert alert-success'>✅ ¡Cuenta creada exitosamente! Redirigiendo...</div>";

  setTimeout(() => {
    window.location.href = "login.html";
  }, 2000);
});
