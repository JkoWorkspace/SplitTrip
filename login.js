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
const form = document.getElementById("formLogin");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  // Limpiar mensajes previos
  document.getElementById("errorPassword").textContent = "";
  document.getElementById("mensajeLogin").innerHTML = "";

  const correo   = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;

  if (!correo || !password) {
    document.getElementById("mensajeLogin").innerHTML =
      "<div class='alert alert-warning'>Por favor completa todos los campos.</div>";
    return;
  }

  const btn = document.getElementById("btnLogin");
  btn.disabled = true;
  btn.textContent = "Verificando...";

  // Verificar usuario en Supabase
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, nombre, correo, telefono, estado")
    .eq("correo", correo)
    .eq("password", password)
    .single();

  if (error) {
    document.getElementById("mensajeLogin").innerHTML =
      "<div class='alert alert-danger'>Correo o contraseña incorrectos.</div>";
    btn.disabled = false;
    btn.textContent = "Ingresar";
    return;
  }

  if (!data.estado) {
    document.getElementById("mensajeLogin").innerHTML =
      "<div class='alert alert-warning'>Tu cuenta está desactivada. Contacta soporte.</div>";
    btn.disabled = false;
    btn.textContent = "Ingresar";
    return;
  }

  // Guardar sesión en localStorage
  localStorage.setItem("usuario", JSON.stringify(data));

  document.getElementById("mensajeLogin").innerHTML =
    "<div class='alert alert-success'>✅ Bienvenido, " + data.nombre + ". Redirigiendo...</div>";

  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1500);
});
