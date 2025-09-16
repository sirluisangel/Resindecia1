// script.js
(() => {
  const DB_NAME = "DB_Agenda";
  const DB_VER = 1;
  let dbAgenda;

  const openReq = indexedDB.open(DB_NAME, DB_VER);
  openReq.onupgradeneeded = (e) => {
    dbAgenda = e.target.result;
    if (!dbAgenda.objectStoreNames.contains("tramites")) {
      const store = dbAgenda.createObjectStore("tramites", { keyPath: "folio" }); // folio como key
      store.createIndex("fechaIng", "fechaIng", { unique: false });
      store.createIndex("usuario", "usuario", { unique: false });
    }
  };
  openReq.onsuccess = (e) => {
    dbAgenda = e.target.result;
    initApp();
  };
  openReq.onerror = () => Swal.fire("Error", "No se pudo abrir la base de agenda", "error");

  // helpers
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const currency = (n) => `$${Number(n || 0).toFixed(2)}`;

  function initApp() {
    // verify login
    const user = localStorage.getItem("sessionUser") || "Invitado";
    $("#userBadge").textContent = user;

    // navigation
    $$(".navitem[data-section]").forEach(item => {
      item.addEventListener("click", (ev) => {
        ev.preventDefault();
        $$(".navitem").forEach(n => n.classList.remove("active"));
        item.classList.add("active");
        const section = item.dataset.section;
        $$(".section").forEach(s => s.classList.remove("visible"));
        $(`#section-${section}`)?.classList.add("visible");
        if (section === "reportes") loadReportes();
      });
    });

    $("#logoutLink").addEventListener("click", (e) => {
      e.preventDefault();
      Swal.fire({
        title: "Cerrar sesión?",
        showCancelButton: true
      }).then(r => {
        if (r.isConfirmed) {
          localStorage.removeItem("sessionUser");
          window.location.href = "index.html";
        }
      });
    });

    // theme toggle (keeps your CSS)
    $("#toggleTheme")?.addEventListener("click", () => document.body.classList.toggle("light"));

    // set default fechaIng today if empty
    const hoy = new Date().toISOString().slice(0, 10);
    if (!$("#fechaIng").value) $("#fechaIng").value = hoy;

    // tramites quantity enable/disable
    $$(".chk").forEach(chk => {
      chk.addEventListener("change", () => {
        const code = chk.dataset.code;
        const inp = document.querySelector(`.cantidad[data-for="${code}"]`);
        if (chk.checked) {
          inp.disabled = false;
          if (!inp.value) inp.value = 1;
        } else {
          inp.disabled = true;
          inp.value = "";
        }
        recalcResumen();
      });
    });

    $$(".cantidad").forEach(inp => inp.addEventListener("input", recalcResumen));

    // buttons
    $("#btnGuardar").addEventListener("click", guardarRegistro);
    $("#btnActualizar").addEventListener("click", actualizarRegistro);
    $("#btnEliminar").addEventListener("click", eliminarRegistro);
    $("#btnLimpiar").addEventListener("click", limpiarFormulario);
    $("#btnBuscar").addEventListener("click", buscarDesdeFormulario);
    $("#btnBuscarFolio").addEventListener("click", buscarFolioSeccion);
    $("#btnFiltrarRep").addEventListener("click", loadReportes);
    $("#btnExportarExcel").addEventListener("click", exportarExcel);

    // initial recalc
    recalcResumen();
  }

  // obtiene items seleccionados y calcula total
  function obtenerItems() {
    const items = [];
    $$(".chk").forEach(chk => {
      if (chk.checked) {
        const code = chk.dataset.code;
        const cost = Number(chk.dataset.cost || 0);
        const cantidad = Number(document.querySelector(`.cantidad[data-for="${code}"]`).value || 0);
        const importe = cantidad * cost;
        items.push({ code, cantidad, costoUnit: cost, importe });
      }
    });
    return items;
  }

  function recalcResumen() {
    const items = obtenerItems();
    const tbody = $("#tablaResumen tbody");
    tbody.innerHTML = "";
    let total = 0;
    items.forEach(it => {
      total += it.importe;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${it.code}</td><td>${it.cantidad}</td><td>${currency(it.importe)}</td>`;
      tbody.appendChild(tr);
    });
    $("#resTotal").textContent = currency(total);
    $("#importeTotal").value = total.toFixed(2);
  }

  // leer formulario completo
  function leerFormulario() {
    const items = obtenerItems();
    const total = items.reduce((s, it) => s + it.importe, 0);
    const payload = {
      folio: $("#np").value.trim() || $("#claveExp").value.trim(),
      folioExp: $("#np").value.trim(),
      fechaIng: $("#fechaIng").value,
      nombre: $("#nombre").value.trim(),
      ubicacion: $("#ubicacion").value.trim(),
      localidad: $("#localidad").value.trim(),
      items,
      total,
      fechaProg: $("#fechaProg").value,
      fechaAut: $("#fechaAut").value,
      fechaEnt: $("#fechaEnt").value,
      telefono: $("#telefono").value.trim(),
      ordenPago: $("#ordenPago").value.trim(),
      fechaOrd: $("#fechaOrd").value,
      cantidadGlobal: Number($("#cantidadGlobal").value || 0),
      reciboPago: $("#reciboPago").value.trim(),
      servidor: $("#servidor").value.trim(),
      escan: $("#escan").value.trim(),
      noLeg: $("#noLeg").value.trim(),
      noHojas: Number($("#noHojas").value || 0),
      claveExp: $("#claveExp").value.trim(),
      obs: $("#obs").value.trim(),
      estatus: $("#estatus").value,
      usuario: localStorage.getItem("sessionUser") || "Invitado",
      fecha_guardado: new Date().toISOString().slice(0,10),
      hora_guardado: new Date().toLocaleTimeString()
    };
    return payload;
  }

  // Validaciones mínimas
  function validarAntes() {
    if (!$("#np").value.trim()) { Swal.fire("Falta NP", "Ingresa NP (folio)", "warning"); return false; }
    if (!$("#fechaIng").value) { Swal.fire("Falta fecha", "Selecciona fecha de ingreso", "warning"); return false; }
    if (!$("#nombre").value.trim()) { Swal.fire("Falta nombre", "Ingresa nombre del solicitante", "warning"); return false; }
    if (obtenerItems().length === 0) { Swal.fire("Falta trámite", "Selecciona al menos un trámite", "warning"); return false; }
    return true;
  }

  // Guardar
  function guardarRegistro() {
    if (!validarAntes()) return;
    const data = leerFormulario();
    const tx = dbAgenda.transaction("tramites", "readwrite");
    const store = tx.objectStore("tramites");
    const get = store.get(data.folio);
    get.onsuccess = () => {
      if (get.result) {
        Swal.fire({
          title: "El folio ya existe",
          text: "¿Deseas sobrescribirlo?",
          showCancelButton: true
        }).then(r => {
          if (r.isConfirmed) {
            store.put(data);
            Swal.fire("Actualizado", "Registro actualizado", "success");
          }
        });
      } else {
        store.add(data);
        Swal.fire("Guardado", "Registro creado en agenda", "success");
      }
    };
    get.onerror = () => Swal.fire("Error", "No se pudo acceder a DB", "error");
  }

  // Actualizar
  function actualizarRegistro() {
    if (!validarAntes()) return;
    const data = leerFormulario();
    const tx = dbAgenda.transaction("tramites", "readwrite");
    const store = tx.objectStore("tramites");
    const get = store.get(data.folio);
    get.onsuccess = () => {
      if (get.result) {
        store.put(data);
        Swal.fire("Actualizado", "Registro actualizado", "success");
      } else Swal.fire("No existe", "No se encontró ese folio", "warning");
    };
  }

  // Eliminar
  function eliminarRegistro() {
    const folio = $("#np").value.trim() || $("#claveExp").value.trim();
    if (!folio) return Swal.fire("Falta folio", "Escribe el folio a eliminar", "warning");
    Swal.fire({ title: "¿Eliminar registro?", text: `Folio: ${folio}`, icon: "warning", showCancelButton: true })
      .then(r => {
        if (r.isConfirmed) {
          const tx = dbAgenda.transaction("tramites", "readwrite");
          tx.objectStore("tramites").delete(folio);
          tx.oncomplete = () => {
            Swal.fire("Eliminado", "Registro eliminado", "success");
            limpiarFormulario();
            loadReportes();
          };
        }
      });
  }

  // Limpiar
  function limpiarFormulario() {
    $("#formPagos").reset();
    $$(".cantidad").forEach(i => { i.disabled = true; i.value = ""; });
    $$(".chk").forEach(c => c.checked = false);
    recalcResumen();
  }

  // Buscar por folio y rellenar (desde formulario)
  function buscarDesdeFormulario() {
    const folio = $("#np").value.trim();
    if (!folio) return Swal.fire("Falta folio", "Escribe el folio a buscar", "warning");
    buscarYRellenar(folio);
  }

  // Buscar por folio en sección buscar (mostrar desglose)
  function buscarFolioSeccion() {
    const folio = $("#buscarFolio").value.trim();
    if (!folio) return Swal.fire("Falta folio", "Escribe el folio a buscar", "warning");
    buscarYMostrar(folio);
  }

  function buscarYRellenar(folio) {
    const tx = dbAgenda.transaction("tramites", "readonly");
    const store = tx.objectStore("tramites");
    const req = store.get(folio);
    req.onsuccess = () => {
      const r = req.result;
      if (!r) return Swal.fire("No encontrado", "No existe ese folio", "info");
      // Rellenar formulario
      $("#np").value = r.folioExp || r.folio;
      $("#fechaIng").value = r.fechaIng || "";
      $("#nombre").value = r.nombre || "";
      $("#ubicacion").value = r.ubicacion || "";
      $("#localidad").value = r.localidad || "";
      $("#fechaProg").value = r.fechaProg || "";
      $("#fechaAut").value = r.fechaAut || "";
      $("#fechaEnt").value = r.fechaEnt || "";
      $("#telefono").value = r.telefono || "";
      $("#ordenPago").value = r.ordenPago || "";
      $("#fechaOrd").value = r.fechaOrd || "";
      $("#cantidadGlobal").value = r.cantidadGlobal || "";
      $("#reciboPago").value = r.reciboPago || "";
      $("#servidor").value = r.servidor || "";
      $("#escan").value = r.escan || "";
      $("#noLeg").value = r.noLeg || "";
      $("#noHojas").value = r.noHojas || "";
      $("#claveExp").value = r.claveExp || "";
      $("#obs").value = r.obs || "";
      $("#estatus").value = r.estatus || "Pendiente";
      // tramites
      $$(".chk").forEach(c => { c.checked = false; });
      $$(".cantidad").forEach(i => { i.disabled = true; i.value = ""; });
      (r.items || []).forEach(it => {
        const chk = document.querySelector(`.chk[data-code="${it.code}"]`);
        const cantidad = document.querySelector(`.cantidad[data-for="${it.code}"]`);
        if (chk && cantidad) {
          chk.checked = true;
          cantidad.disabled = false;
          cantidad.value = it.cantidad || 0;
        }
      });
      recalcResumen();
      Swal.fire("Cargado", "Registro cargado en el formulario", "success");
    };
    req.onerror = () => Swal.fire("Error", "No se pudo buscar", "error");
  }

  function buscarYMostrar(folio) {
    const tx = dbAgenda.transaction("tramites", "readonly");
    const store = tx.objectStore("tramites");
    const req = store.get(folio);
    req.onsuccess = () => {
      const r = req.result;
      if (!r) return Swal.fire("No encontrado", "No existe ese folio", "info");
      const cont = $("#resultadoBusqueda");
      const filas = (r.items || []).map(it => `<tr><td>${it.code}</td><td class="right">${it.cantidad}</td><td class="right">${currency(it.importe)}</td></tr>`).join("");
      cont.innerHTML = `
        <h3>Expediente: ${r.folioExp || "-"}</h3>
        <p><strong>Folio:</strong> ${r.folio} — <strong>Nombre:</strong> ${r.nombre || "-"} — <strong>Fecha:</strong> ${r.fecha_guardado} ${r.hora_guardado}</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Trámite</th><th>Cantidad</th><th>Importe</th></tr></thead>
            <tbody>${filas}</tbody>
            <tfoot><tr><td class="right bold">Total</td><td></td><td class="bold">${currency(r.total)}</td></tr></tfoot>
          </table>
        </div>
        <p class="muted">Usuario: ${r.usuario || "-"}</p>
      `;
    };
    req.onerror = () => Swal.fire("Error", "No se pudo buscar", "error");
  }

  // Reportes: carga todos los registros, filtra por fechaIng (si se piden)
  function loadReportes() {
    const desdeVal = $("#repDesde").value;
    const hastaVal = $("#repHasta").value;
    const desde = desdeVal ? new Date(desdeVal + "T00:00:00") : null;
    const hasta = hastaVal ? new Date(hastaVal + "T23:59:59") : null;

    const tx = dbAgenda.transaction("tramites", "readonly");
    const store = tx.objectStore("tramites");
    const req = store.getAll();
    req.onsuccess = () => {
      let rows = req.result || [];
      // map date for sorting
      rows = rows.map(r => {
        const d = r.fechaIng ? new Date(r.fechaIng + "T00:00:00") : new Date(r.fecha_guardado + "T00:00:00");
        return { ...r, _dateObj: d };
      });
      if (desde && hasta) rows = rows.filter(r => r._dateObj >= desde && r._dateObj <= hasta);
      rows.sort((a, b) => b._dateObj - a._dateObj);

      const tbody = $("#tablaReportes tbody");
      tbody.innerHTML = "";
      rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.folio}</td><td>${r.nombre || "-"}</td><td>${r.fechaIng || r.fecha_guardado || "-"}</td><td>${r.hora_guardado || "-"}</td><td>${currency(r.total||0)}</td><td>${r.usuario||"-"}</td>`;
        tbody.appendChild(tr);
      });
    };
    req.onerror = () => Swal.fire("Error", "No se pudieron cargar reportes", "error");
  }

  // Export a Excel (toda la DB, se puede filtrar primero con loadReportes)
  function exportarExcel() {
    const tx = dbAgenda.transaction("tramites", "readonly");
    const store = tx.objectStore("tramites");
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      const data = [["folio","folioExp","fechaIng","hora_guardado","nombre","total","usuario","items"]];
      rows.forEach(r => data.push([r.folio||"", r.folioExp||"", r.fechaIng||r.fecha_guardado||"", r.hora_guardado||"", r.nombre||"", r.total||0, r.usuario||"", JSON.stringify(r.items||[])]));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Pagos");
      XLSX.writeFile(wb, `pagos_${new Date().toISOString().slice(0,10)}.xlsx`);
      Swal.fire("Exportado", "Archivo Excel generado", "success");
    };
    req.onerror = () => Swal.fire("Error", "No se pudo exportar", "error");
  }

  // expose recalcResumen for other code
  window.recalcResumen = recalcResumen;
})();
function mostrarReportes() {
  const container = document.getElementById("reportesContainer");
  container.innerHTML = "";

  let tx = db.transaction("reportes", "readonly");
  let store = tx.objectStore("reportes");
  let request = store.getAll();

  request.onsuccess = (event) => {
    let reportes = event.target.result;

    if (reportes.length === 0) {
      container.innerHTML = "<p>No hay reportes registrados aún.</p>";
      return;
    }

    reportes.forEach((reporte, index) => {
      let card = document.createElement("div");
      card.classList.add("reporte-card");

      card.innerHTML = `
        <div class="reporte-header">Reporte #${index + 1}</div>
        
        <div class="reporte-section">
          <h4>📌 Datos Generales</h4>
          <p><b>Nombre:</b> ${reporte.nombre || "-"}</p>
          <p><b>Fecha:</b> ${reporte.fecha || "-"}</p>
          <p><b>Hora:</b> ${reporte.hora || "-"}</p>
          <p><b>Usuario:</b> ${reporte.usuario || "-"}</p>
        </div>

        <div class="reporte-section">
          <h4>🔒 Permisos</h4>
          <p><b>Cámara:</b> ${reporte.permisos?.camara ? "✅ Permitido" : "❌ Denegado"}</p>
          <p><b>Micrófono:</b> ${reporte.permisos?.microfono ? "✅ Permitido" : "❌ Denegado"}</p>
          <p><b>Archivos:</b> ${reporte.permisos?.archivos ? "✅ Permitido" : "❌ Denegado"}</p>
        </div>

        <div class="reporte-section">
          <h4>📄 Información Complementaria</h4>
          <p><b>Notas:</b> ${reporte.notas || "Sin notas adicionales"}</p>
          <p><b>Detalles:</b> ${reporte.detalles || "No especificados"}</p>
        </div>
      `;

      container.appendChild(card);
    });
  };
}

// === Rellenar tabla de reportes ===
function cargarReportes(filtroInicio, filtroFin) {
  const tbody = document.querySelector("#tablaReportes tbody");
  tbody.innerHTML = "";

  dbPromise.then(db => {
    const tx = db.transaction("tramites", "readonly");
    return tx.objectStore("tramites").getAll();
  }).then(registros => {
    registros
      .filter(reg => {
        if (!filtroInicio || !filtroFin) return true;
        const fecha = new Date(reg.fechaIng);
        return fecha >= new Date(filtroInicio) && fecha <= new Date(filtroFin);
      })
      .forEach(reg => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${reg.np}</td>
          <td>${reg.nombre}</td>
          <td>${reg.fechaIng}</td>
          <td>${reg.ubicacion || "-"}</td>
          <td>${reg.localidad || "-"}</td>
          <td>${reg.permisos.map(p => `${p.nombre} (${p.cantidad})`).join(", ")}</td>
          <td>${reg.telefono || "-"}</td>
          <td>${reg.ordenPago || "-"}</td>
          <td>${reg.cantidadGlobal || "-"}</td>
          <td>${reg.reciboPago || "-"}</td>
          <td>${reg.estatus}</td>
          <td>${reg.obs || "-"}</td>
          <td>$${reg.importeTotal}</td>
          <td>
            ${reg.pdf ? `<button class="btn small" onclick="verPDF('${reg.pdf}')"><i class="fa-solid fa-file-pdf"></i> Ver</button>` : "Sin PDF"}
          </td>
        `;
        tbody.appendChild(tr);
      });
  });
}

// Ver PDF en nueva ventana
function verPDF(base64) {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

// Exportar Excel
document.getElementById("btnExportExcel").addEventListener("click", () => {
  const wb = XLSX.utils.table_to_book(document.getElementById("tablaReportes"), {sheet:"Reportes"});
  XLSX.writeFile(wb, "reportes.xlsx");
});

// Exportar PDF con jsPDF
document.getElementById("btnExportPDF").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "pt", "a4");
  doc.text("Reportes de Trámites", 40, 30);
  doc.autoTable({ html: "#tablaReportes", startY: 50 });
  doc.save("reportes.pdf");
});

// Filtrar
document.getElementById("btnFiltrar").addEventListener("click", () => {
  const inicio = document.getElementById("filtroInicio").value;
  const fin = document.getElementById("filtroFin").value;
  cargarReportes(inicio, fin);
});

// Cargar inicial
cargarReportes();
