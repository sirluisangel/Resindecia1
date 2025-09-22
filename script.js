// ================================
// Inicialización IndexedDB
// ================================
let db;
const DB_NAME = "DB_Agenda";
const DB_VERSION = 1;

const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = function (e) {
  db = e.target.result;

  if (!db.objectStoreNames.contains("tramites")) {
    const store = db.createObjectStore("tramites", { keyPath: "np" });
    store.createIndex("nombre", "nombre", { unique: false });
    store.createIndex("fechaIng", "fechaIng", { unique: false });
  }
};

request.onsuccess = function (e) {
  db = e.target.result;
  console.log("IndexedDB inicializado");
  loadReportes();
  recalcResumen();
};

request.onerror = function (e) {
  console.error("Error DB:", e);
};

// ================================
// BroadcastChannel Sync
// ================================
const agendaChannel = new BroadcastChannel("agendaChannel");

agendaChannel.onmessage = (e) => {
  const { type } = e.data;
  if (type === "sync") {
    console.log("🔄 Actualización recibida desde otra pestaña");
    loadReportes();
    recalcResumen();
  }
};

function enviarSync() {
  agendaChannel.postMessage({ type: "sync" });
}

// ================================
// Utilidades
// ================================
function getFormData() {
  return {
    np: document.getElementById("np").value.trim(),
    fechaIng: document.getElementById("fechaIng").value,
    nombre: document.getElementById("nombre").value,
    ubicacion: document.getElementById("ubicacion").value,
    localidad: document.getElementById("localidad").value,
    fechaProg: document.getElementById("fechaProg").value,
    fechaAut: document.getElementById("fechaAut").value,
    fechaEnt: document.getElementById("fechaEnt").value,
    telefono: document.getElementById("telefono").value,
    ordenPago: document.getElementById("ordenPago").value,
    fechaOrd: document.getElementById("fechaOrd").value,
    cantidadGlobal: document.getElementById("cantidadGlobal").value,
    reciboPago: document.getElementById("reciboPago").value,
    servidor: document.getElementById("servidor").value,
    escan: document.getElementById("escan").value,
    noLeg: document.getElementById("noLeg").value,
    noHojas: document.getElementById("noHojas").value,
    claveExp: document.getElementById("claveExp").value,
    estatus: document.getElementById("estatus").value,
    obs: document.getElementById("obs").value,
    importeTotal: document.getElementById("importeTotal").value,
    noRecibo: document.getElementById("noRecibo").value,
    usuario: localStorage.getItem("usuario") || "Desconocido",
    fechaGuardado: new Date().toLocaleDateString(),
    horaGuardado: new Date().toLocaleTimeString(),
  };
}

// ================================
// Guardar Registro
// ================================
async function guardarRegistro() {
  const data = getFormData();
  const fileInput = document.getElementById("pdfFile");

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    data.pdf = await file.arrayBuffer();
    data.pdfName = file.name;
  }

  const tx = db.transaction("tramites", "readwrite");
  tx.objectStore("tramites").add(data);

  tx.oncomplete = () => {
    Swal.fire("Guardado", "Registro creado en agenda", "success");
    loadReportes();
    recalcResumen();
    enviarSync();
  };
}

// ================================
// Actualizar Registro
// ================================
async function actualizarRegistro() {
  const data = getFormData();
  const fileInput = document.getElementById("pdfFile");

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    data.pdf = await file.arrayBuffer();
    data.pdfName = file.name;
  }

  const tx = db.transaction("tramites", "readwrite");
  tx.objectStore("tramites").put(data);

  tx.oncomplete = () => {
    Swal.fire("Actualizado", "Registro actualizado", "success");
    loadReportes();
    recalcResumen();
    enviarSync();
  };
}

// ================================
// Eliminar Registro
// ================================
function eliminarRegistro() {
  const np = document.getElementById("np").value.trim();
  if (!np) return;

  const tx = db.transaction("tramites", "readwrite");
  tx.objectStore("tramites").delete(np);

  tx.oncomplete = () => {
    Swal.fire("Eliminado", "Registro eliminado", "success");
    limpiarFormulario();
    loadReportes();
    recalcResumen();
    enviarSync();
  };
}

// ================================
// Cargar Reportes
// ================================
function loadReportes() {
  const tbody = document.querySelector("#tablaReportes tbody");
  tbody.innerHTML = "";

  const tx = db.transaction("tramites", "readonly");
  const req = tx.objectStore("tramites").openCursor();

  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const t = cursor.value;
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${t.np}</td><td>${t.fechaIng}</td><td>${t.nombre}</td>
        <td>${t.ubicacion}</td><td>${t.localidad}</td>
        <td>${t.tramites || ""}</td><td>${t.fechaProg}</td>
        <td>${t.fechaAut}</td><td>${t.fechaEnt}</td><td>${t.telefono}</td>
        <td>${t.ordenPago}</td><td>${t.fechaOrd}</td><td>${t.cantidadGlobal}</td>
        <td>${t.reciboPago}</td><td>${t.servidor}</td><td>${t.escan}</td>
        <td>${t.noLeg}</td><td>${t.noHojas}</td><td>${t.claveExp}</td>
        <td>${t.obs}</td><td>${t.estatus}</td>
        <td>${t.importeTotal}</td><td>${t.usuario}</td>
        <td>${t.fechaGuardado}</td><td>${t.horaGuardado}</td>
        <td>${t.pdfName ? `<a href="#" onclick="descargarPDF('${t.np}')">${t.pdfName}</a>` : ""}</td>
      `;

      tbody.appendChild(tr);
      cursor.continue();
    }
  };
}

// ================================
// Descargar PDF
// ================================
function descargarPDF(np) {
  const tx = db.transaction("tramites", "readonly");
  const req = tx.objectStore("tramites").get(np);

  req.onsuccess = () => {
    const t = req.result;
    if (t && t.pdf) {
      const blob = new Blob([t.pdf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = t.pdfName || "documento.pdf";
      a.click();
      URL.revokeObjectURL(url);
    }
  };
}

// ================================
// Resumen
// ================================
function recalcResumen() {
  const tbody = document.querySelector("#tablaResumen tbody");
  tbody.innerHTML = "";
  let total = 0;

  const tx = db.transaction("tramites", "readonly");
  const req = tx.objectStore("tramites").openCursor();

  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const t = cursor.value;
      total += parseFloat(t.importeTotal || 0);
      cursor.continue();
    } else {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2">Total Global</td><td>$${total.toFixed(2)}</td>`;
      tbody.appendChild(tr);
      document.getElementById("resTotal").innerText = `$${total.toFixed(2)}`;
    }
  };
}

// ================================
// Limpiar Formulario
// ================================
function limpiarFormulario() {
  document.getElementById("formPagos").reset();
}

// ================================
// Eventos Botones
// ================================
document.getElementById("btnGuardar").addEventListener("click", guardarRegistro);
document.getElementById("btnActualizar").addEventListener("click", actualizarRegistro);
document.getElementById("btnEliminar").addEventListener("click", eliminarRegistro);
document.getElementById("btnLimpiar").addEventListener("click", limpiarFormulario);
