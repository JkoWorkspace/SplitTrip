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

/* ---- Obtener id del viaje desde URL ---- */
const params  = new URLSearchParams(window.location.search);
const idViaje = parseInt(params.get("id"));

if (!idViaje) {
  window.location.href = "dashboard.html";
}

/* ---- Link volver al viaje ---- */
document.getElementById("linkVolverViaje").href = "viaje.html?id=" + idViaje;

/* ---- Variables globales ---- */
let integrantes    = [];
let monedaViaje    = "USD";
let nombreViaje    = "";
let totalGastos    = 0;
let numGastos      = 0;
let archivoFactura = null;

/* ---- Helpers ---- */
function formatearMonto(monto, moneda) {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: moneda }).format(monto);
}

/* ---- Poner fecha de hoy por defecto ---- */
const hoy = new Date().toISOString().split("T")[0];
document.getElementById("fecha").value = hoy;

/* ---- Preview división al escribir monto ---- */
document.getElementById("monto").addEventListener("input", function () {
  const monto = parseFloat(this.value);
  const num   = integrantes.length;

  if (!isNaN(monto) && monto > 0 && num > 0) {
    const porPersona = monto / num;
    document.getElementById("numIntegrantes").textContent  = num;
    document.getElementById("montoPorPersona").textContent = formatearMonto(porPersona, monedaViaje);
    document.getElementById("previewDivision").classList.remove("d-none");
  } else {
    document.getElementById("previewDivision").classList.add("d-none");
  }
});

/* ---- Manejo de archivo de factura ---- */
const facturaInput  = document.getElementById("facturaInput");
const facturaPreview = document.getElementById("facturaPreview");
const uploadArea    = document.getElementById("uploadArea");
const btnQuitar     = document.getElementById("btnQuitarFactura");

facturaInput.addEventListener("change", function () {
  const archivo = this.files[0];
  if (!archivo) return;

  // Validar tamaño (5MB)
  if (archivo.size > 5 * 1024 * 1024) {
    alert("El archivo no puede superar los 5MB.");
    this.value = "";
    return;
  }

  archivoFactura = archivo;

  // Mostrar nombre del archivo
  document.getElementById("uploadTexto").classList.add("d-none");
  document.getElementById("uploadNombre").classList.remove("d-none");
  document.getElementById("nombreArchivo").textContent = archivo.name;
  uploadArea.classList.add("tiene-imagen");
  btnQuitar.classList.remove("d-none");

  // Preview si es imagen
  if (archivo.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      facturaPreview.src = e.target.result;
      facturaPreview.style.display = "block";
    };
    reader.readAsDataURL(archivo);
  } else {
    // PDF: mostrar ícono en lugar de preview
    facturaPreview.style.display = "none";
  }
});

/* ---- Quitar imagen ---- */
btnQuitar.addEventListener("click", function () {
  archivoFactura = null;
  facturaInput.value = "";
  facturaPreview.style.display = "none";
  facturaPreview.src = "";
  document.getElementById("uploadTexto").classList.remove("d-none");
  document.getElementById("uploadNombre").classList.add("d-none");
  uploadArea.classList.remove("tiene-imagen");
  btnQuitar.classList.add("d-none");
});

/* ---- Subir factura a Supabase Storage ---- */
async function subirFactura(archivo, idGasto) {
  // Nombre único: idViaje/idGasto_timestamp.ext
  const ext      = archivo.name.split(".").pop();
  const fileName = `${idViaje}/${idGasto}_${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("facturas")
    .upload(fileName, archivo, {
      cacheControl: "3600",
      upsert: false,
      contentType: archivo.type
    });

  if (error) {
    console.error("Error subiendo factura:", error.message);
    return null;
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from("facturas")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/* ---- Submit del formulario ---- */
const form = document.getElementById("formNuevoGasto");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  document.getElementById("mensajeGasto").innerHTML  = "";
  document.getElementById("errorMonto").textContent  = "";

  const descripcion = document.getElementById("descripcion").value.trim();
  const monto       = parseFloat(document.getElementById("monto").value);
  const categoria   = document.getElementById("categoria").value;
  const fecha       = document.getElementById("fecha").value;
  const pagador     = parseInt(document.getElementById("pagador").value);

  // Validaciones
  if (!descripcion) {
    document.getElementById("mensajeGasto").innerHTML =
      "<div class='alert alert-warning'>Por favor describe el gasto.</div>";
    return;
  }
  if (isNaN(monto) || monto <= 0) {
    document.getElementById("errorMonto").textContent = "Ingresa un monto válido mayor a 0.";
    return;
  }
  if (!fecha) {
    document.getElementById("mensajeGasto").innerHTML =
      "<div class='alert alert-warning'>Por favor selecciona una fecha.</div>";
    return;
  }
  if (!pagador) {
    document.getElementById("mensajeGasto").innerHTML =
      "<div class='alert alert-warning'>Por favor selecciona quién pagó.</div>";
    return;
  }

  const btn = document.getElementById("btnGuardarGasto");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  // 1. Insertar el gasto (sin factura aún)
  const { data: gasto, error: errGasto } = await supabase
    .from("gastos")
    .insert([{
      id_viaje:           idViaje,
      id_usuario_pagador: pagador,
      descripcion:        descripcion,
      monto:              monto,
      categoria:          categoria,
      fecha:              fecha,
      url_factura:        null
    }])
    .select()
    .single();

  if (errGasto) {
    document.getElementById("mensajeGasto").innerHTML =
      "<div class='alert alert-danger'>Error al guardar el gasto: " + errGasto.message + "</div>";
    btn.disabled = false;
    btn.textContent = "Guardar gasto";
    return;
  }

  // 2. Si hay factura, subirla y actualizar el gasto
  if (archivoFactura) {
    btn.textContent = "Subiendo factura...";

    const urlFactura = await subirFactura(archivoFactura, gasto.id_gasto);

    if (urlFactura) {
      await supabase
        .from("gastos")
        .update({ url_factura: urlFactura })
        .eq("id_gasto", gasto.id_gasto);
    }
  }

  // Éxito
  document.getElementById("mensajeGasto").innerHTML =
    "<div class='alert alert-success'>✅ Gasto registrado exitosamente. Redirigiendo al viaje...</div>";

  setTimeout(() => {
    window.location.href = "viaje.html?id=" + idViaje;
  }, 1800);
});

/* ---- Cargar datos del viaje e integrantes ---- */
async function cargarDatos() {
  // Viaje
  const { data: viaje } = await supabase
    .from("viajes")
    .select("nombre, moneda")
    .eq("id_viaje", idViaje)
    .single();

  if (!viaje) {
    window.location.href = "dashboard.html";
    return;
  }

  monedaViaje = viaje.moneda;
  nombreViaje = viaje.nombre;

  document.getElementById("subtituloViaje").textContent = "Viaje: " + viaje.nombre;
  document.getElementById("simboloMoneda").textContent  = viaje.moneda;

  // Integrantes
  const { data: dataInt } = await supabase
    .from("integrantes_viaje")
    .select("id_usuario, usuarios(nombre)")
    .eq("id_viaje", idViaje);

  integrantes = dataInt || [];

  // Llenar select de pagador
  const selectPagador = document.getElementById("pagador");
  selectPagador.innerHTML = integrantes.map(i => `
    <option value="${i.id_usuario}" ${i.id_usuario === usuario.id_usuario ? "selected" : ""}>
      ${i.usuarios.nombre}${i.id_usuario === usuario.id_usuario ? " (tú)" : ""}
    </option>
  `).join("");

  // Gastos existentes para el resumen
  const { data: gastos } = await supabase
    .from("gastos")
    .select("monto")
    .eq("id_viaje", idViaje);

  totalGastos = (gastos || []).reduce((sum, g) => sum + parseFloat(g.monto), 0);
  numGastos   = (gastos || []).length;

  const promedio = integrantes.length > 0 ? totalGastos / integrantes.length : 0;

  document.getElementById("resumenTotal").textContent        = formatearMonto(totalGastos, monedaViaje);
  document.getElementById("resumenIntegrantes").textContent  = integrantes.length + " personas";
  document.getElementById("resumenNumGastos").textContent    = numGastos + " gastos";
  document.getElementById("resumenPromedio").textContent     = formatearMonto(promedio, monedaViaje);

  document.getElementById("spinnerResumen").style.display = "none";
  document.getElementById("resumenViaje").classList.remove("d-none");
}

/* ---- Iniciar ---- */
cargarDatos();
