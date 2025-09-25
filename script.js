// script.js
(() => {
  const DB_NAME = "DB_Agenda";
  const REG_KEY = 'DB_Registros';
  const DB_VER = 1;
  let dbAgenda;

  const openReq = indexedDB.open(DB_NAME, DB_VER);
  openReq.onupgradeneeded = (e) => {
    dbAgenda = e.target.result;
    if (!dbAgenda.objectStoreNames.contains("tramites")) {
      const store = dbAgenda.createObjectStore("tramites", { keyPath: "folio" });
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

    $("#toggleTheme")?.addEventListener("click", () => document.body.classList.toggle("light"));

    // default fechaIng
    const hoy = new Date().toISOString().slice(0, 10);
    if (!$("#fechaIng").value) $("#fechaIng").value = hoy;

    // tramites enable/disable cantidad + mostrar importe por permiso
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
    $("#btnExportarExcel").addEventListener("click", () => exportarExcel(true));
    $("#btnExportarPDF").addEventListener("click", () => exportarPDF(true));

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
    // actualizar mini-info por permiso
    $$(".mini-info").forEach(mi => mi.textContent = "$0.00");
    items.forEach(it => {
      total += it.importe;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${it.code}</td><td>${it.cantidad}</td><td>${currency(it.importe)}</td>`;
      tbody.appendChild(tr);
      // actualizar mini info
      const mini = document.querySelector(`.mini-info[data-imp-for="${it.code}"]`);
      if (mini) mini.textContent = currency(it.importe);
    });
    $("#resTotal").textContent = currency(total);
    $("#importeTotal").value = total.toFixed(2);
  }

  // leer formulario completo (incluye PDF blob si existe)
  async function leerFormulario() {
    const items = obtenerItems();
    const total = items.reduce((s, it) => s + it.importe, 0);
    const fileInput = $("#pdfFile");
    let pdfBlob = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      // opcional: limitar tamaño 10MB
      if (file.size > 10 * 1024 * 1024) {
        await Swal.fire("Archivo grande", "El PDF excede 10MB. Usa un archivo más pequeño.", "warning");
        throw new Error("PDF demasiado grande");
      }
      pdfBlob = file.slice(0, file.size, file.type);
    }

    const payload = {
      folio: $("#np").value.trim() || (`folio_${Date.now()}`),
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
      hora_guardado: new Date().toLocaleTimeString(),
      pdf: pdfBlob // Blob or null
    };
    return payload;
  }

  // Validaciones
  function validarAntes() {
    if (!$("#np").value.trim()) { Swal.fire("Falta NP", "Ingresa NP (folio)", "warning"); return false; }
    if (!$("#fechaIng").value) { Swal.fire("Falta fecha", "Selecciona fecha de ingreso", "warning"); return false; }
    if (!$("#nombre").value.trim()) { Swal.fire("Falta nombre", "Ingresa nombre del solicitante", "warning"); return false; }
    if (obtenerItems().length === 0) { Swal.fire("Falta trámite", "Selecciona al menos un trámite", "warning"); return false; }
    return true;
  }

  // Guardar: guarda todo incluido pdf blob
  async function guardarRegistro() {
    try {
      if (!validarAntes()) return;
      const data = await leerFormulario();
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
              tx.oncomplete = () => { Swal.fire("Actualizado", "Registro actualizado", "success"); loadReportes(); }
            }
          });
        } else {
          store.add(data);
          tx.oncomplete = () => { Swal.fire("Guardado", "Registro creado en agenda", "success"); loadReportes(); }
        }
      };
      get.onerror = () => Swal.fire("Error", "No se pudo acceder a DB", "error");
    } catch (err) {
      if (err.message !== "PDF demasiado grande") console.error(err);
    }
  }

  // Actualizar (similar a guardar)
  async function actualizarRegistro() {
    try {
      if (!validarAntes()) return;
      const data = await leerFormulario();
      const tx = dbAgenda.transaction("tramites", "readwrite");
      const store = tx.objectStore("tramites");
      const get = store.get(data.folio);
      get.onsuccess = () => {
        if (get.result) {
          // si no adjuntó PDF ahora, mantenemos el existente
          if (!data.pdf && get.result.pdf) data.pdf = get.result.pdf;
          store.put(data);
          tx.oncomplete = () => { Swal.fire("Actualizado", "Registro actualizado", "success"); loadReportes(); }
        } else Swal.fire("No existe", "No se encontró ese folio", "warning");
      };
    } catch (err) {
      if (err.message !== "PDF demasiado grande") console.error(err);
    }
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
    $$(".mini-info").forEach(mi => mi.textContent = "$0.00");
    recalcResumen();
  }

  // Buscar y rellenar desde formulario
  function buscarDesdeFormulario() {
    const folio = $("#np").value.trim();
    if (!folio) return Swal.fire("Falta folio", "Escribe el folio a buscar", "warning");
    buscarYRellenar(folio);
  }

  // Buscar por folio en sección buscar y mostrar desglose con botón ver pdf
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
      // if pdf exists, let user know
      if (r.pdf) {
        // show small banner with view button
        $("#resultadoBusqueda").innerHTML = `<div class="desglose"><h3>Expediente: ${r.folio}</h3>
          <p><strong>Nombre:</strong> ${r.nombre || "-"} — <strong>Fecha:</strong> ${r.fecha_guardado} ${r.hora_guardado}</p>
          <div style="margin-top:8px"><button class="btn info" id="btnVerPdfBusqueda">📄 Ver PDF</button></div></div>`;
        $("#btnVerPdfBusqueda").addEventListener("click", () => verPDF(r.folio));
      } else {
        $("#resultadoBusqueda").innerHTML = `<div class="desglose"><h3>Expediente: ${r.folio}</h3>
          <p><strong>Nombre:</strong> ${r.nombre || "-"} — <strong>Fecha:</strong> ${r.fecha_guardado} ${r.hora_guardado}</p>
          <p class="muted">No tiene PDF adjunto.</p></div>`;
      }
      recalcResumen();
      Swal.fire("Cargado", "Registro cargado en el formulario", "success");
    };
    req.onerror = () => Swal.fire("Error", "No se pudo buscar", "error");
  }

  function buscarYMostrar(folio) {
    // similar to buscarYRellenar but for mostrar en desglose con tabla de items y ver pdf
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
        <div style="margin-top:8px">${r.pdf ? `<button class="btn info" id="btnVerPdfBusqueda">📄 Ver PDF</button>` : `<small class="muted">No tiene PDF adjunto.</small>`}</div>
      `;
      if (r.pdf) {
        $("#btnVerPdfBusqueda").addEventListener("click", () => verPDF(r.folio));
      }
    };
    req.onerror = () => Swal.fire("Error", "No se pudo buscar", "error");
  }

  // Reportes: carga todos los registros, filtra por fechaIng (si se piden) y muestra columnas completas
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
      rows = rows.map(r => {
        const d = r.fechaIng ? new Date(r.fechaIng + "T00:00:00") : new Date((r.fecha_guardado || "").slice(0,10) + "T00:00:00");
        return { ...r, _dateObj: d };
      });
      if (desde && hasta) rows = rows.filter(r => r._dateObj >= desde && r._dateObj <= hasta);
      rows.sort((a, b) => b._dateObj - a._dateObj);

      const tbody = $("#tablaReportes tbody");
      tbody.innerHTML = "";
      rows.forEach(r => {
        const tr = document.createElement("tr");
        // create summary for permisos as "CODE:qty, CODE:qty"
        const perms = (r.items || []).map(it => `${it.code}:${it.cantidad}`).join(", ");
        // build row cells
        tr.innerHTML = `
          <td>${r.folio || ""}</td>
          <td>${r.fechaIng || r.fecha_guardado || ""}</td>
          <td>${r.nombre || ""}</td>
          <td>${r.ubicacion || ""}</td>
          <td>${r.localidad || ""}</td>
          <td>${perms || "-"}</td>
          <td>${r.fechaProg || ""}</td><td>${r.fechaAut || ""}</td><td>${r.fechaEnt || ""}</td>
          <td>${r.telefono || ""}</td>
          <td>${r.ordenPago || ""}</td><td>${r.fechaOrd || ""}</td><td>${r.cantidadGlobal || ""}</td><td>${r.reciboPago || ""}</td>
          <td>${r.servidor || ""}</td><td>${r.escan || ""}</td><td>${r.noLeg || ""}</td><td>${r.noHojas || ""}</td>
          <td>${r.claveExp || ""}</td><td>${r.obs || ""}</td><td>${r.estatus || ""}</td>
          <td>${currency(r.total||0)}</td><td>${r.usuario||""}</td><td>${r.fecha_guardado||""}</td><td>${r.hora_guardado||""}</td>
          <td class="center"><button class="btn pdf-btn" data-folio="${r.folio}">📄 Ver PDF</button></td>
        `;
        tbody.appendChild(tr);
      });

      // attach handlers for all pdf buttons
      $$(".pdf-btn").forEach(b => b.addEventListener("click", (ev) => {
        const fol = ev.currentTarget.dataset.folio;
        verPDF(fol);
      }));
    };
    req.onerror = () => Swal.fire("Error", "No se pudieron cargar reportes", "error");
  }

  // verPDF: obtiene blob de IndexedDB y abre en nueva pestaña
  function verPDF(folio) {
    const tx = dbAgenda.transaction("tramites", "readonly");
    const store = tx.objectStore("tramites");
    const req = store.get(folio);
    req.onsuccess = () => {
      const r = req.result;
      if (!r) return Swal.fire("No encontrado", "No existe ese folio", "info");
      if (!r.pdf) return Swal.fire("Sin PDF", "Ese trámite no tiene PDF adjunto.", "info");
      // crear url y abrir
      const url = URL.createObjectURL(r.pdf);
      window.open(url, "_blank");
      // opcional: revoke after some time (browser handles open)
      setTimeout(() => URL.revokeObjectURL(url), 1000 * 60);
    };
    req.onerror = () => Swal.fire("Error", "No se pudo recuperar el PDF", "error");
  }

  // Export a Excel (filtrado por fecha si applyFilter true)
  function exportarExcel(applyFilter = false) {
    const desdeVal = $("#repDesde").value;
    const hastaVal = $("#repHasta").value;
    const desde = desdeVal ? new Date(desdeVal + "T00:00:00") : null;
    const hasta = hastaVal ? new Date(hastaVal + "T23:59:59") : null;

    const tx = dbAgenda.transaction("tramites", "readonly");
    const store = tx.objectStore("tramites");
    const req = store.getAll();
    req.onsuccess = () => {
      let rows = req.result || [];
      rows = rows.map(r => ({ ...r, _dateObj: r.fechaIng ? new Date(r.fechaIng + "T00:00:00") : new Date((r.fecha_guardado||"").slice(0,10) + "T00:00:00") }));
      if (applyFilter && desde && hasta) rows = rows.filter(r => r._dateObj >= desde && r._dateObj <= hasta);
      // prepare data array for XLSX
      const data = rows.map(r => {
        return {
          NP: r.folio || "",
          FechaIngreso: r.fechaIng || r.fecha_guardado || "",
          Nombre: r.nombre || "",
          Ubicacion: r.ubicacion || "",
          Localidad: r.localidad || "",
          Tramites: (r.items || []).map(it => `${it.code}:${it.cantidad}`).join(", "),
          FechaProg: r.fechaProg || "",
          FechaAut: r.fechaAut || "",
          FechaEnt: r.fechaEnt || "",
          Telefono: r.telefono || "",
          OrdenPago: r.ordenPago || "",
          FechaOrden: r.fechaOrd || "",
          Cantidad: r.cantidadGlobal || "",
          Recibo: r.reciboPago || "",
          ServidorPub: r.servidor || "",
          Escan: r.escan || "",
          NoLeg: r.noLeg || "",
          NoHojas: r.noHojas || "",
          ClaveExp: r.claveExp || "",
          Observaciones: r.obs || "",
          Estatus: r.estatus || "",
          ImporteTotal: r.total || 0,
          Usuario: r.usuario || "",
          FechaGuardado: r.fecha_guardado || "",
          HoraGuardado: r.hora_guardado || ""
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reportes");
      XLSX.writeFile(wb, `reportes_${new Date().toISOString().slice(0,10)}.xlsx`);
      Swal.fire("Exportado", "Excel generado", "success");
    };
    req.onerror = () => Swal.fire("Error", "No se pudo exportar", "error");
  }

  // Export PDF using jsPDF + autoTable
  function exportarPDF(applyFilter = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'pt', 'a4'); // landscape
    const desdeVal = $("#repDesde").value;
    const hastaVal = $("#repHasta").value;
    const desde = desdeVal ? new Date(desdeVal + "T00:00:00") : null;
    const hasta = hastaVal ? new Date(hastaVal + "T23:59:59") : null;

    const tx = dbAgenda.transaction("tramites", "readonly");
    const store = tx.objectStore("tramites");
    const req = store.getAll();
    req.onsuccess = () => {
      let rows = req.result || [];
      rows = rows.map(r => ({ ...r, _dateObj: r.fechaIng ? new Date(r.fechaIng + "T00:00:00") : new Date((r.fecha_guardado||"").slice(0,10) + "T00:00:00") }));
      if (applyFilter && desde && hasta) rows = rows.filter(r => r._dateObj >= desde && r._dateObj <= hasta);

      const headers = [
        "NP","FechaIng","Nombre","Ubicacion","Localidad","Tramites","FechaProg","FechaAut","FechaEnt",
        "Telefono","OrdenPago","FechaOrden","Cantidad","Recibo","Servidor","Escan","NoLeg","NoHojas",
        "ClaveExp","Observaciones","Estatus","ImporteTotal","Usuario","FechaGuardado","HoraGuardado"
      ];
      const body = rows.map(r => [
        r.folio||"",
        r.fechaIng || r.fecha_guardado || "",
        r.nombre || "",
        r.ubicacion || "",
        r.localidad || "",
        (r.items || []).map(it => `${it.code}:${it.cantidad}`).join(", "),
        r.fechaProg || "", r.fechaAut || "", r.fechaEnt || "",
        r.telefono || "", r.ordenPago || "", r.fechaOrd || "", r.cantidadGlobal || "",
        r.reciboPago || "", r.servidor || "", r.escan || "", r.noLeg || "", r.noHojas || "",
        r.claveExp || "", r.obs || "", r.estatus || "", (r.total||0).toFixed(2), r.usuario || "", r.fecha_guardado || "", r.hora_guardado || ""
      ]);

      doc.autoTable({
        head: [headers],
        body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [11,18,32] },
        startY: 20,
        margin: { left: 20, right: 20 }
      });
      doc.save(`reportes_${new Date().toISOString().slice(0,10)}.pdf`);
      Swal.fire("Exportado", "PDF generado", "success");
    };
    req.onerror = () => Swal.fire("Error", "No se pudo exportar a PDF", "error");
  }

  // expose recalcResumen for other contexts
  window.recalcResumen = recalcResumen;

})();

document.querySelectorAll(".chk").forEach(chk => {
  chk.addEventListener("change", () => {
    const row = chk.closest(".tramite");
    const cantidad = row.querySelector(".cantidad");
    const importe = row.querySelector(".importe");

    if (chk.checked) {
      cantidad.disabled = false;
      importe.disabled = false;
    } else {
      cantidad.disabled = true;
      importe.disabled = true;
      cantidad.value = "";
      importe.value = "0.00";
    }
  });
});

document.querySelectorAll(".cantidad").forEach(input => {
  input.addEventListener("input", () => {
    const row = input.closest(".tramite");
    const chk = row.querySelector(".chk");
    const importe = row.querySelector(".importe");
    const costo = parseFloat(chk.dataset.cost);
    const cantidad = parseInt(input.value) || 0;
    importe.value = (cantidad * costo).toFixed(2);
  });
});
// ================================
// Navegación secciones
// ================================
function initNav(){
  $$('.navitem').forEach(a => {
    a.addEventListener('click', ()=> {
      $$('.navitem').forEach(n=>n.classList.remove('active'));
      a.classList.add('active');
      showSection(a.dataset.section);
    });
  });
}

function showSection(id){
  $$('.section').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if(el) el.classList.remove('hidden');
}
// ================================
// Tema oscuro / claro
// ================================
function initTheme(){
  const saved = localStorage.getItem('theme') || 'light';
  setTheme(saved);

  $('#toggleTheme')?.addEventListener('click', ()=> {
    setTheme(document.body.classList.contains('dark')?'light':'dark');
  });

  const chk = $('#chkDarkMode');
  if(chk){
    chk.checked = saved==='dark';
    chk.addEventListener('change', e=> setTheme(e.target.checked?'dark':'light'));
  }
}

function setTheme(theme){
  document.body.classList.toggle('dark', theme==='dark');
  localStorage.setItem('theme', theme);
  $('#chkDarkMode') && ($('#chkDarkMode').checked = theme==='dark');
}

// ================================
// Navegación secciones
// ================================
function initNav(){
  $$('.navitem').forEach(a => {
    a.addEventListener('click', ()=> {
      $$('.navitem').forEach(n=>n.classList.remove('active'));
      a.classList.add('active');
      showSection(a.dataset.section);
    });
  });
}

function showSection(id){
  $$('.section').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if(el) el.classList.remove('hidden');
}

// ================================
// Tema oscuro / claro
// ================================
function initTheme(){
  const saved = localStorage.getItem('theme') || 'light';
  setTheme(saved);

  $('#toggleTheme')?.addEventListener('click', ()=> {
    setTheme(document.body.classList.contains('dark')?'light':'dark');
  });

  const chk = $('#chkDarkMode');
  if(chk){
    chk.checked = saved==='dark';
    chk.addEventListener('change', e=> setTheme(e.target.checked?'dark':'light'));
  }
}

function setTheme(theme){
  document.body.classList.toggle('dark', theme==='dark');
  localStorage.setItem('theme', theme);
  $('#chkDarkMode') && ($('#chkDarkMode').checked = theme==='dark');
}

// ================================
// Estatus y campos adicionales
// ================================
function initEstatusWatcher(){
  const est = $('#estatus');
  const target = $('#entregadoFields');
  if(est && target){
    est.addEventListener('change', e => {
      target.classList.toggle('hidden', e.target.value !== 'Entregado');
    });
  }
}

// ================================
// Tramites: habilitar, calcular importe
// ================================
function initTramites(){
  $$('#tramitesContainer .tramite').forEach(label=>{
    const chk = label.querySelector('.chk');
    const cant = label.querySelector('.cantidad');
    const precio = label.querySelector('.precio');
    const imp = label.querySelector('.importe');
    const regBtn = label.querySelector('.reg-btn');
    const verBtn = label.querySelector('.ver-btn');

    chk.addEventListener('change', e=>{
      const enabled = e.target.checked;
      [cant, precio].forEach(el=>el.disabled = !enabled);
      if(!enabled){ cant.value=''; imp.value='0.00'; regBtn.disabled=true; }
      else { if(!cant.value) cant.value=1; updateImporte(); regBtn.disabled=false; }
      renderResumen();
    });

    const updateImporte = ()=>{
      const total = round2((parseFloat(cant.value)||0)*(parseFloat(precio.value)||0));
      imp.value = total.toFixed(2);
      renderResumen();
    };

    cant.addEventListener('input', updateImporte);
    precio.addEventListener('input', updateImporte);

    regBtn?.addEventListener('click', ()=> registrarMonto(label));
    verBtn?.addEventListener('click', ()=> verRegistrosTramite(label.dataset.code));
  });
}

// ================================
// Registro histórico de tramites
// ================================
function registrarMonto(label){
  const np = $('#np').value.trim();
  if(!np) return Swal.fire('Falta NP','Ingresa el NP antes de registrar montos','warning');

  const cantidad = parseFloat(label.querySelector('.cantidad').value) || 0;
  const precio = parseFloat(label.querySelector('.precio').value) || 0;
  const importe = round2(cantidad*precio);
  const code = label.dataset.code;

  Swal.fire({
    title: `Registrar monto — ${code}`,
    html: `NP: <b>${np}</b><br>Importe: <b>${currency(importe)}</b><br>¿Deseas guardar?`,
    icon:'question',
    showCancelButton:true,
    confirmButtonText:'Sí, registrar'
  }).then(res=>{
    if(res.isConfirmed){
      const registros = JSON.parse(localStorage.getItem(REG_KEY)||'[]');
      const now = new Date();
      registros.push({
        np, code, cantidad, precio, importe,
        usuario: $('#userBadge')?.textContent.trim()||'Admin',
        fechaGuardado: now.toISOString().slice(0,10),
        horaGuardado: now.toTimeString().slice(0,8)
      });
      localStorage.setItem(REG_KEY, JSON.stringify(registros));
      Swal.fire('Registrado','Monto registrado correctamente','success');
    }
  });
}

function verRegistrosTramite(code){
  const np = $('#np').value.trim();
  const registros = JSON.parse(localStorage.getItem(REG_KEY)||'[]');
  const filtrados = registros.filter(r=>r.code===code && (np?r.np===np:true));
  if(filtrados.length===0) return Swal.fire('Sin registros', `No hay registros para ${code}${np?' NP: '+np:''}`, 'info');
  const html = filtrados.map(r=>`<div><b>NP:</b>${r.np} - <b>Imp:</b>${currency(r.importe)} - <b>Cant:</b>${r.cantidad} - <b>Fecha:</b>${r.fechaGuardado} ${r.horaGuardado}</div>`).join('');
  Swal.fire({title:`Registros ${code}`, html, width:800});
}

// ================================
// Resumen y tabla reportes
// ================================
function renderResumen(){
  const tbody = $('#tablaResumen tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  let total=0;
  $$('#tramitesContainer .tramite').forEach(label=>{
    if(!label.querySelector('.chk').checked) return;
    const nombre = label.querySelector('.tramite-label').textContent.trim();
    const code = label.dataset.code;
    const cant = parseFloat(label.querySelector('.cantidad').value)||0;
    const imp = parseFloat(label.querySelector('.importe').value)||0;
    total+=imp;
    const tr = document.createElement('tr');
    tr.innerHTML=`<td>${nombre} (${code})</td><td>${cant}</td><td>${currency(imp)}</td>`;
    tbody.appendChild(tr);
  });
  $('#resTotal') && ($('#resTotal').textContent=currency(total));
  $('#importeTotal') && ($('#importeTotal').value=currency(total));
}

// ================================
// Form Buttons: Guardar / Actualizar / Eliminar / Buscar / Limpiar
// ================================
function initFormButtons(){
  $('#btnGuardar')?.addEventListener('click', guardarRegistro);
  $('#btnActualizar')?.addEventListener('click', actualizarRegistro);
  $('#btnEliminar')?.addEventListener('click', eliminarRegistro);
  $('#btnBuscar')?.addEventListener('click', ()=> buscarYMostrar($('#np').value.trim()));
  $('#btnLimpiar')?.addEventListener('click', ()=> { $('#formPagos').reset(); renderResumen(); });
  $('#btnBuscarFolio')?.addEventListener('click', ()=> buscarYMostrarEnDiv($('#buscarFolio').value.trim()));
  $('#btnFiltrarRep')?.addEventListener('click', renderReportes);
  $('#btnExportarExcel')?.addEventListener('click', exportarExcel);
  $('#btnExportarPDF')?.addEventListener('click', exportarPDF);
}

// ================================
// CRUD completo
// ================================
async function construirRegistroDesdeForm(){
  const np = $('#np').value.trim();
  const fechaIng = $('#fechaIng').value;
  const nombre = $('#nombre').value.trim();
  if(!np || !fechaIng || !nombre) throw new Error('NP, Fecha de Ingreso y Nombre son obligatorios');

  const tramites = [];
  $$('#tramitesContainer .tramite').forEach(label=>{
    if(!label.querySelector('.chk').checked) return;
    const code = label.dataset.code;
    const cantidad = parseFloat(label.querySelector('.cantidad').value)||0;
    const precio = parseFloat(label.querySelector('.precio').value)||0;
    tramites.push({code,cantidad,precio,importe:round2(cantidad*precio)});
  });

  let pdfData = null;
  const fileInput = $('#pdfExp');
  if(fileInput?.files?.[0]) pdfData = await fileToDataUrl(fileInput.files[0]);

  const registro = {
    np, fechaIng, nombre, ubicacion: $('#ubicacion').value, localidad: $('#localidad').value,
    tramites, fechaProg: $('#fechaProg').value, fechaAut: $('#fechaAut').value, fechaEnt: $('#fechaEnt').value,
    telefono: $('#telefono').value, ordenPago: $('#ordenPago').value, fechaOrd: $('#fechaOrd').value,
    cantidadGlobal: $('#cantidadGlobal').value, reciboPago: $('#reciboPago').value,
    servidor: $('#servidor').value, escan: $('#escan').value, claveExp: $('#claveExp').value,
    obs: $('#obs').value, estatus: $('#estatus').value, noRecibo: $('#noRecibo').value,
    noHojas: $('#noHojas').value, noLeg: $('#noLeg').value,
    importeTotal: round2(tramites.reduce((s,t)=>s+t.importe,0)),
    usuario: $('#userBadge')?.textContent.trim()||'Admin',
    fechaGuardado: new Date().toISOString().slice(0,10),
    horaGuardado: new Date().toTimeString().slice(0,8),
    pdfData
  };
  return registro;
}

async function guardarRegistro(){
  try{
    const rec = await construirRegistroDesdeForm();
    const db = JSON.parse(localStorage.getItem(DB_KEY)||'[]');
    const exists = db.find(r=>r.np===rec.np);
    if(exists){
      const res = await Swal.fire({title:'NP ya existe', html:`NP <b>${rec.np}</b> ya existe. Sobrescribir?`, icon:'warning', showCancelButton:true, confirmButtonText:'Sí'});
      if(!res.isConfirmed) return;
      db[db.findIndex(r=>r.np===rec.np)] = rec;
      Swal.fire('Actualizado','Registro actualizado correctamente','success');
    } else { db.push(rec); Swal.fire('Guardado','Registro guardado correctamente','success'); }
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    renderReportes();
  } catch(e){ Swal.fire('Error', e.message||String(e), 'error'); }
}

async function actualizarRegistro(){ await guardarRegistro(); }

function eliminarRegistro(){
  const np = $('#np').value.trim();
  if(!np) return Swal.fire('Falta NP','Ingresa NP para eliminar','warning');
  Swal.fire({title:'Eliminar registro', text:`Eliminar NP ${np}?`, icon:'warning', showCancelButton:true, confirmButtonText:'Sí'}).then(res=>{
    if(res.isConfirmed){
      const db = JSON.parse(localStorage.getItem(DB_KEY)||'[]');
      const idx = db.findIndex(r=>r.np===np);
      if(idx===-1) return Swal.fire('No encontrado','Registro no existe','info');
      db.splice(idx,1);
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      Swal.fire('Eliminado','Registro eliminado','success');
      renderReportes();
    }
  });
}

// ================================
// Buscar / Llenar formulario / PDF
// ================================
function buscarYMostrar(np){
  if(!np) return Swal.fire('Falta NP','Ingresa NP para buscar','warning');
  const rec = (JSON.parse(localStorage.getItem(DB_KEY)||'[]')).find(r=>r.np===np);
  if(!rec) return Swal.fire('No encontrado',`No existe NP ${np}`,'info');
  llenarFormularioConRegistro(rec);
  Swal.fire('Cargado',`Expediente NP: ${np} cargado`,'success');
}

function llenarFormularioConRegistro(rec){
  Object.keys(rec).forEach(k=>{
    const el = $(`#${k}`);
    if(el) el.value = rec[k];
  });
  // Tramites
  $$('#tramitesContainer .tramite').forEach(label=>{
    const t = rec.tramites.find(x=>x.code===label.dataset.code);
    const chk = label.querySelector('.chk');
    const cant = label.querySelector('.cantidad');
    const precio = label.querySelector('.precio');
    const imp = label.querySelector('.importe');
    const regBtn = label.querySelector('.reg-btn');
    if(t){
      chk.checked=true; cant.value=t.cantidad; precio.value=t.precio; imp.value=t.importe.toFixed(2);
      [cant, precio, regBtn].forEach(el=>el.disabled=false);
    } else { chk.checked=false; [cant, precio, imp, regBtn].forEach(el=>el.disabled=true); }
  });
  renderResumen();
}

function buscarYMostrarEnDiv(np){
  const rec = (JSON.parse(localStorage.getItem(DB_KEY)||'[]')).find(r=>r.np===np);
  const cont = $('#resultadoBusqueda'); if(!cont) return;
  if(!rec) return cont.innerHTML=`<div class="card small"><b>No encontrado</b><p>No existe folio ${np}.</p></div>`;
  const trámitesHtml = rec.tramites.map(t=>`${t.code}:${t.cantidad}`).join(', ');
  cont.innerHTML=`<div class="card small">
    <h3>NP: ${rec.np} — ${rec.nombre}</h3>
    <p><b>Fecha:</b>${rec.fechaIng} — <b>Estatus:</b>${rec.estatus}</p>
    <p><b>Trámites:</b>${trámitesHtml}</p>
    <p><b>Total:</b>${currency(rec.importeTotal)}</p>
    <div>
      <button class="btn" id="btnAbrirRec">Abrir en formulario</button>
      ${rec.pdfData?`<button class="btn info" id="btnVerPdfRes">Ver PDF</button>`:''}
    </div>
  </div>`;
  $('#btnAbrirRec')?.addEventListener('click', ()=> { llenarFormularioConRegistro(rec); showSection('section-pagos'); });
  $('#btnVerPdfRes')?.addEventListener('click', ()=> mostrarPDFInline(rec));
}

// ================================
// PDF / Excel / Utilities
// ================================
function fileToDataUrl(file){ return new Promise((res,rej)=>{ const fr = new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); }); }

function mostrarPDFInline(rec){
  if(!rec.pdfData) return Swal.fire('Sin PDF','No hay PDF adjunto','info');
  Swal.fire({title:`PDF NP: ${rec.np}`, html:`<div style="height:600px"><iframe src="${rec.pdfData}" style="width:100%;height:100%;border:0;"></iframe></div>`, width:900, showCloseButton:true, showConfirmButton:false});
}

function renderReportes(){
  let db = JSON.parse(localStorage.getItem(DB_KEY)||'[]');
  const desde = $('#repDesde').value; const hasta = $('#repHasta').value;
  if(desde) db=db.filter(r=>r.fechaIng>=desde); if(hasta) db=db.filter(r=>r.fechaIng<=hasta);

  const tbody = $('#tablaReportes tbody'); if(!tbody) return; tbody.innerHTML='';
  db.forEach(r=>{
    const tramitesStr = r.tramites.map(t=>`${t.code}:${t.cantidad}`).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML=`
      <td>${r.np}</td><td>${r.fechaIng}</td><td>${r.nombre}</td><td>${r.localidad||''}</td>
      <td>${tramitesStr}</td><td>${currency(r.importeTotal)}</td><td>${r.estatus||''}</td>
      <td>${r.pdfData?`<button class="btn info small" data-viewpdf="${r.np}">Ver PDF</button>`:'-'}</td>
      <td>
        <button class="btn" data-edit="${r.np}">Editar</button>
        <button class="btn danger" data-delete="${r.np}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-viewpdf]').forEach(btn=>{
    btn.addEventListener('click', ()=> { const np = btn.dataset.viewpdf; mostrarPDFInline(JSON.parse(localStorage.getItem(DB_KEY)||'[]').find(x=>x.np===np)); });
  });
  tbody.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=> { const np = btn.dataset.edit; const rec = JSON.parse(localStorage.getItem(DB_KEY)||'[]').find(x=>x.np===np); if(rec){ llenarFormularioConRegistro(rec); showSection('section-pagos'); Swal.fire('Editar','Cargado para editar','info'); }});
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn=>{
    btn.addEventListener('click', ()=> { const np = btn.dataset.delete; Swal.fire({title:'Confirmar', text:`Eliminar NP ${np}?`, icon:'warning', showCancelButton:true}).then(res=>{ if(res.isConfirmed) eliminarRegistro(); }); });
  });
}

function exportarExcel(){
  const db = JSON.parse(localStorage.getItem(DB_KEY)||'[]');
  if(db.length===0) return Swal.fire('Sin datos','No hay registros para exportar','info');
  const rows = db.map(r=>({NP:r.np, Fecha:r.fechaIng, Nombre:r.nombre, Tramites:r.tramites.map(t=>`${t.code}:${t.cantidad}`).join(';'), Total:r.importeTotal, Estatus:r.estatus}));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reportes');
  XLSX.writeFile(wb, `reportes_agenda_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportarPDF(){
  const db = JSON.parse(localStorage.getItem(DB_KEY)||'[]');
  if(db.length===0) return Swal.fire('Sin datos','No hay registros para exportar','info');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt', format:'letter'});
  const cols = ['NP','Fecha','Nombre','Localidad','Trámites','Total','Estatus'];
  const rows = db.map(r=>[r.np,r.fechaIng,r.nombre,r.localidad||'',r.tramites.map(t=>`${t.code}:${t.cantidad}`).join(','),currency(r.importeTotal),r.estatus]);
  doc.setFontSize(12); doc.text('Reportes - Agenda Control de Pagos',40,40);
  doc.autoTable({head:[cols], body:rows, startY:60, styles:{fontSize:8}, theme:'striped', margin:{left:20,right:20}});
  doc.save(`reportes_agenda_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ================================
// Inicial render
// ================================
renderReportes();
