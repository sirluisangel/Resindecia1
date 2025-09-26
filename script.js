// ==============================
// Helper selectors
// ==============================
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ==============================
// Keys localStorage
// ==============================
const DB_KEY = 'DB_Agenda';     // Datos de registros
const REG_KEY = 'DB_Registros'; // Histórico de montos

// ==============================
// Formato moneda y redondeo
// ==============================
const currency = v => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(v||0));
const round2 = n => Math.round((Number(n)||0) * 100) / 100;

// ==============================
// Inicialización al cargar
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  renderReportes();
});

// ==============================
// Inicialización general
// ==============================
function initApp() {
  mostrarUsuario();

  initNav();
  initTheme();
  initEstatusWatcher();
  initTramites();
  initFormButtons();
  renderResumen();
}

// ==============================
// Mostrar usuario en badge
// ==============================
function mostrarUsuario() {
  const user = localStorage.getItem("sessionUser") || "Invitado";
  const badge = $("#userBadge");
  if(badge) badge.textContent = user;
}

// ==============================
// Navigation
// ==============================
function initNav(){
  const navs = $$('.navitem');
  navs.forEach(a => a.addEventListener('click', (e) => {
    navs.forEach(n=>n.classList.remove('active'));
    a.classList.add('active');
    const target = a.dataset.section;
    showSection(target);
  }));
}

function showSection(id){
  $$('.section').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(`section-${id}`) || document.getElementById(id);
  if(el) el.classList.remove('hidden');
}

// ==============================
// Tema oscuro / claro
// ==============================
function initTheme(){
  const saved = localStorage.getItem('theme') || 'light';
  setTheme(saved);
  $('#toggleTheme')?.addEventListener('click', () => {
    const current = document.body.classList.contains('dark') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  const chk = $('#chkDarkMode');
  if(chk){
    chk.checked = (saved === 'dark');
    chk.addEventListener('change', e => setTheme(e.target.checked ? 'dark' : 'light'));
  }
}

function setTheme(t){
  if(t === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  localStorage.setItem('theme', t);
  if($('#chkDarkMode')) $('#chkDarkMode').checked = (t === 'dark');
}

// ==============================
// Estatus watcher (mostrar campos Entregado)
// ==============================
function initEstatusWatcher(){
  const est = $('#estatus');
  const targetFields = $('#entregadoFields');
  if(est && targetFields){
    est.addEventListener('change', e=>{
      if(e.target.value === 'Entregado') targetFields.classList.remove('hidden');
      else targetFields.classList.add('hidden');
    });
  }
}

// ==============================
// Tramites: habilitar y calcular
// ==============================
function initTramites(){
  const tramites = $$('#tramitesContainer .tramite');
  tramites.forEach(label => {
    const chk = label.querySelector('.chk');
    const cantidad = label.querySelector('.cantidad');
    const precio = label.querySelector('.precio');
    const importe = label.querySelector('.importe');
    const regBtn = label.querySelector('.reg-btn');
    const verBtn = label.querySelector('.ver-btn');

    const updateImporte = () => {
      const q = parseFloat(cantidad.value) || 0;
      const p = parseFloat(precio.value) || 0;
      importe.value = round2(q*p).toFixed(2);
      renderResumen();
    };

    // Cambio checkbox
    chk.addEventListener('change', e=>{
      const enabled = e.target.checked;
      cantidad.disabled = !enabled;
      precio.disabled = !enabled;
      regBtn.disabled = !enabled;
      if(!enabled){
        cantidad.value = '';
        importe.value = (0).toFixed(2);
      } else {
        if(!cantidad.value) cantidad.value = 1;
        updateImporte();
      }
      renderResumen();
    });

    cantidad?.addEventListener('input', updateImporte);
    precio?.addEventListener('input', updateImporte);

    // Registrar monto histórico
    regBtn?.addEventListener('click', ()=> registrarMonto(label));
    verBtn?.addEventListener('click', ()=> verRegistrosTramite(label.dataset.code));
  });
}

// ==============================
// Registrar monto histórico
// ==============================
function registrarMonto(label){
  const np = $('#np').value.trim();
  if(!np){ Swal.fire('Falta NP','Ingresa el NP antes de registrar montos.','warning'); return; }
  const code = label.dataset.code;
  const cantidad = parseFloat(label.querySelector('.cantidad').value) || 0;
  const precio = parseFloat(label.querySelector('.precio').value) || 0;
  const importe = round2(cantidad*precio);

  Swal.fire({
    title: `Registrar monto — ${code}`,
    html: `NP: <b>${np}</b><br>Importe: <b>${currency(importe)}</b><br>¿Deseas guardar este registro?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, registrar'
  }).then(res=>{
    if(res.isConfirmed){
      const registros = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
      const now = new Date();
      registros.push({
        np, code, cantidad, precio, importe,
        usuario: $("#userBadge")?.textContent.trim() || 'Admin',
        fechaGuardado: now.toISOString().slice(0,10),
        horaGuardado: now.toTimeString().slice(0,8)
      });
      localStorage.setItem(REG_KEY, JSON.stringify(registros));
      Swal.fire('Registrado','El monto fue registrado correctamente.','success');
    }
  });
}

// ==============================
// Ver registros por código
// ==============================
function verRegistrosTramite(code){
  const np = $('#np').value.trim();
  const registros = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
  const filtered = registros.filter(r => r.code === code && (np ? r.np === np : true));

  if(filtered.length === 0){ Swal.fire('Sin registros', `No hay registros para ${code}${np ? ' en NP: '+np : ''}.`, 'info'); return; }

  const html = filtered.map(r=>`<div style="margin-bottom:8px">
    <b>NP:</b> ${r.np} — <b>Importe:</b> ${currency(r.importe)} — <b>Cant:</b> ${r.cantidad} — <b>Fecha:</b> ${r.fechaGuardado} ${r.horaGuardado}
  </div>`).join('');
  Swal.fire({title:`Registros ${code}`, html, width:800});
}

// ==============================
// Render resumen de tramites
// ==============================
function renderResumen(){
  const tbody = $('#tablaResumen tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  let total = 0;
  $$('#tramitesContainer .tramite').forEach(label=>{
    const chk = label.querySelector('.chk');
    if(!chk.checked) return;
    const code = label.dataset.code;
    const labelName = label.querySelector('.tramite-label').textContent.trim();
    const cant = parseFloat(label.querySelector('.cantidad').value) || 0;
    const imp = round2(parseFloat(label.querySelector('.importe').value) || 0);
    total += imp;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${labelName} (${code})</td><td>${cant}</td><td>${currency(imp)}</td>`;
    tbody.appendChild(tr);
  });
  $('#resTotal').textContent = currency(total);
  $('#importeTotal').value = currency(total);
}

// ==============================
// Form buttons: Guardar / Actualizar / Eliminar / Buscar / Limpiar
// ==============================
function initFormButtons(){
  // Guardar
  $('#btnGuardar')?.addEventListener('click', async ()=>{
    try { await guardarRegistro(); } catch(e){ Swal.fire('Error', e.message || e, 'error'); }
  });
  // Actualizar
  $('#btnActualizar')?.addEventListener('click', async ()=>{ try{ await actualizarRegistro(); }catch(e){ Swal.fire('Error', e.message || e,'error'); } });
  // Eliminar
  $('#btnEliminar')?.addEventListener('click', ()=>{
    const np = $('#np').value.trim();
    if(!np){ Swal.fire('Falta NP','Ingresa el NP a eliminar.','warning'); return; }
    Swal.fire({ title:'Eliminar registro', text:`¿Eliminar expediente NP: ${np}?`, icon:'warning', showCancelButton:true }).then(res=>{ if(res.isConfirmed) deleteRegistro(np); });
  });
  // Buscar
  $('#btnBuscar')?.addEventListener('click', ()=>{
    const np = $('#np').value.trim();
    if(!np){ Swal.fire('Falta NP','Ingresa el NP para buscar.','warning'); return; }
    buscarYMostrar(np);
  });
  // Limpiar
  $('#btnLimpiar')?.addEventListener('click', ()=>{
    $('#formPagos')?.reset();
    renderResumen();
  });
  // Buscar folio en sección buscar
  $('#btnBuscarFolio')?.addEventListener('click', ()=>{
    const fol = $('#buscarFolio').value.trim();
    if(!fol){ Swal.fire('Falta folio','Ingresa folio a buscar.','warning'); return; }
    buscarYMostrarEnDiv(fol);
  });
  // Export / reportes
  $('#btnFiltrarRep')?.addEventListener('click', ()=>renderReportes());
  $('#btnExportarExcel')?.addEventListener('click', exportarExcel);
  $('#btnExportarPDF')?.addEventListener('click', exportarPDF);
}

// ==============================
// Guardar / Actualizar / Eliminar registros
// ==============================
async function construirRegistroDesdeForm(){
  const np = $('#np').value.trim();
  const fechaIng = $('#fechaIng').value;
  const nombre = $('#nombre').value.trim();
  if(!np || !fechaIng || !nombre) throw new Error('NP, Fecha de Ingreso y Nombre son obligatorios.');

  const tramites = [];
  $$('#tramitesContainer .tramite').forEach(label=>{
    const chk = label.querySelector('.chk');
    if(!chk.checked) return;
    const code = label.dataset.code;
    const cantidad = parseFloat(label.querySelector('.cantidad').value) || 0;
    const precio = parseFloat(label.querySelector('.precio').value) || 0;
    const importe = round2(parseFloat(label.querySelector('.importe').value) || (cantidad*precio));
    tramites.push({ code, cantidad, precio, importe });
  });

  let pdfData = null;
  const fileInput = $('#pdfExp');
  if(fileInput && fileInput.files[0]) pdfData = await fileToDataUrl(fileInput.files[0]);

  const importeTotal = tramites.reduce((s,t)=> s + Number(t.importe||0),0);
  const now = new Date();
  return {
    np, fechaIng, nombre, ubicacion: $('#ubicacion')?.value, localidad: $('#localidad')?.value,
    tramites,
    fechaProg: $('#fechaProg')?.value,
    fechaAut: $('#fechaAut')?.value,
    fechaEnt: $('#fechaEnt')?.value,
    telefono: $('#telefono')?.value,
    ordenPago: $('#ordenPago')?.value,
    fechaOrd: $('#fechaOrd')?.value,
    cantidadGlobal: $('#cantidadGlobal')?.value,
    reciboPago: $('#reciboPago')?.value,
    servidor: $('#servidor')?.value,
    escan: $('#escan')?.value,
    claveExp: $('#claveExp')?.value,
    obs: $('#obs')?.value,
    estatus: $('#estatus')?.value,
    noRecibo: $('#noRecibo')?.value,
    noHojas: $('#noHojas')?.value,
    noLeg: $('#noLeg')?.value,
    importeTotal: round2(importeTotal),
    usuario: $("#userBadge")?.textContent.trim() || 'Admin',
    fechaGuardado: now.toISOString().slice(0,10),
    horaGuardado: now.toTimeString().slice(0,8),
    pdfData
  };
}

async function guardarRegistro(){
  try{
    const rec = await construirRegistroDesdeForm();
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const exists = db.find(r=>r.np === rec.np);
    if(exists) { Swal.fire('Error','NP ya existe. Usa actualizar.','warning'); return; }
    db.push(rec);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    Swal.fire('Guardado','Registro guardado correctamente.','success');
    renderResumen();
  } catch(e){ Swal.fire('Error', e.message,'error'); }
}

async function actualizarRegistro(){
  try{
    const rec = await construirRegistroDesdeForm();
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const idx = db.findIndex(r=>r.np === rec.np);
    if(idx <0) { Swal.fire('Error','NP no existe.','warning'); return; }
    db[idx] = rec;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    Swal.fire('Actualizado','Registro actualizado correctamente.','success');
    renderResumen();
  } catch(e){ Swal.fire('Error', e.message,'error'); }
}

function deleteRegistro(np){
    // Borrar registro principal
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const idx = db.findIndex(r => r.np === np);
    if(idx >= 0){
        db.splice(idx, 1);
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    // Borrar todos los registros históricos relacionados
    const registros = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
    const nuevosRegistros = registros.filter(r => r.np !== np);
    localStorage.setItem(REG_KEY, JSON.stringify(nuevosRegistros));

    Swal.fire('Eliminado', `Expediente NP: ${np} y todos sus registros relacionados han sido eliminados.`, 'success');

    // Actualizar vistas
    renderResumen();
    renderReportes();
}


// ==============================
// Buscar
// ==============================
function buscarYMostrar(np){
  const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  const rec = db.find(r=>r.np===np);
  if(!rec){ Swal.fire('No encontrado','NP no existe','info'); return; }
  Object.keys(rec).forEach(k=>{
    const el = $('#'+k);
    if(el) el.value = rec[k];
  });
  renderResumen();
}

function buscarYMostrarEnDiv(fol){
  const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  const rec = db.find(r=>r.np===fol);
  if(!rec){ Swal.fire('No encontrado','Folio no existe','info'); return; }
  const html = `<pre>${JSON.stringify(rec,null,2)}</pre>`;
  Swal.fire({title:`Folio: ${fol}`, html, width:800});
}

// ==============================
// Convertir archivo a base64
// ==============================
function fileToDataUrl(file){
  return new Promise((res, rej)=>{
    const reader = new FileReader();
    reader.onload = e=>res(e.target.result);
    reader.onerror = e=>rej(e);
    reader.readAsDataURL(file);
  });
}

// ==============================
// Reportes / PDF / Excel
// ==============================
function renderReportes(){
  const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  const tbody = $('#tbodyReportes');
  if(!tbody) return;
  tbody.innerHTML = '';
  db.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.np}</td><td>${r.nombre}</td><td>${r.fechaIng}</td><td>${r.estatus}</td><td>${r.importeTotal}</td>`;
    tbody.appendChild(tr);
  });
}

function exportarExcel(){ Swal.fire('Exportar','Función exportar Excel aún no implementada','info'); }
function exportarPDF(){ Swal.fire('Exportar','Función exportar PDF aún no implementada','info'); }

// ==============================
// Logout
// ==============================
$('#logoutLink')?.addEventListener('click', e=>{
  e.preventDefault();
  Swal.fire({title:'Cerrar sesión?', showCancelButton:true}).then(r=>{
    if(r.isConfirmed){
      localStorage.removeItem("sessionUser");
      location.href="index.html";
    }
  });
});

/* -------------------
   Buscar folio en localStorage
------------------- */
document.getElementById("btnBuscarFolio").addEventListener("click", () => {
    const folio = document.getElementById("buscarFolio").value.trim();
    if (!folio) return Swal.fire("Aviso", "Ingresa un folio para buscar", "warning");

    const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const data = db.find(r => r.np === folio);

    if (!data) {
        Swal.fire("No encontrado", "El folio no existe en la base de datos", "error");
        return;
    }

    // Rellenar formulario
    document.getElementById("np").value = data.np;
    document.getElementById("fechaIng").value = data.fechaIng;
    document.getElementById("nombre").value = data.nombre;
    document.getElementById("ubicacion").value = data.ubicacion || "";
    document.getElementById("localidad").value = data.localidad || "";
    document.getElementById("estatus").value = data.estatus || "Pendiente";

    // Mostrar campos entregado si aplica
    if (data.estatus === "Entregado") {
        document.getElementById("entregadoFields").classList.remove("hidden");
        document.getElementById("noHojas").value = data.noHojas || "";
        document.getElementById("noLeg").value = data.noLeg || "";
    } else {
        document.getElementById("entregadoFields").classList.add("hidden");
    }

    // Rellenar trámites
    const tramites = ["LUS", "CIZ", "CANO", "CUS", "VBCUS"];
    tramites.forEach(code => {
        const tramite = document.querySelector(`.tramite[data-code="${code}"]`);
        if (!tramite) return;
        const checkbox = tramite.querySelector(".chk");
        const cantidad = tramite.querySelector(".cantidad");
        const precio = tramite.querySelector(".precio");
        const importe = tramite.querySelector(".importe");
        const regBtn = tramite.querySelector(".reg-btn");

        const t = data.tramites.find(t => t.code === code);
        if (t) {
            checkbox.checked = true;
            cantidad.value = t.cantidad;
            precio.value = t.precio;
            importe.value = round2(t.importe).toFixed(2);
            cantidad.disabled = false;
            precio.disabled = false;
            regBtn.disabled = false;
        } else {
            checkbox.checked = false;
            cantidad.value = "";
            precio.value = "";
            importe.value = "0.00";
            cantidad.disabled = true;
            precio.disabled = true;
            regBtn.disabled = true;
        }
    });

    // Otros campos
    document.getElementById("fechaProg").value = data.fechaProg || "";
    document.getElementById("fechaAut").value = data.fechaAut || "";
    document.getElementById("fechaEnt").value = data.fechaEnt || "";
    document.getElementById("telefono").value = data.telefono || "";
    document.getElementById("ordenPago").value = data.ordenPago || "";
    document.getElementById("fechaOrd").value = data.fechaOrd || "";
    document.getElementById("cantidadGlobal").value = data.cantidadGlobal || "";
    document.getElementById("reciboPago").value = data.reciboPago || "";
    document.getElementById("servidor").value = data.servidor || "";
    document.getElementById("escan").value = data.escan || "";
    document.getElementById("claveExp").value = data.claveExp || "";
    document.getElementById("obs").value = data.obs || "";
    document.getElementById("importeTotal").value = data.importeTotal || "0.00";
    document.getElementById("noRecibo").value = data.noRecibo || "";
});

function renderReportes(){
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const tbody = document.querySelector("#tablaReportes tbody");
    if(!tbody) return;
    tbody.innerHTML = '';

    db.forEach(r => {
        const tr = document.createElement("tr");

        // Trámites en formato código:cantidad
        let tramitesText = r.tramites.map(t => `${t.code}:${t.cantidad}`).join(' ');

        tr.innerHTML = `
            <td>${r.np}</td>
            <td>${r.fechaIng || ""}</td>
            <td>${r.nombre || ""}</td>
            <td>${r.ubicacion || ""}</td>
            <td>${r.localidad || ""}</td>
            <td>${tramitesText}</td>
            <td>${r.fechaProg || ""}</td>
            <td>${r.fechaAut || ""}</td>
            <td>${r.fechaEnt || ""}</td>
            <td>${r.telefono || ""}</td>
            <td>${r.ordenPago || ""}</td>
            <td>${r.fechaOrd || ""}</td>
            <td>${r.cantidadGlobal || ""}</td>
            <td>${r.reciboPago || ""}</td>
            <td>${r.servidor || ""}</td>
            <td>${r.escan || ""}</td>
            <td>${r.noLeg || ""}</td>
            <td>${r.noHojas || ""}</td>
            <td>${r.claveExp || ""}</td>
            <td>${r.obs || ""}</td>
            <td>${r.estatus || ""}</td>
            <td>${r.importeTotal || ""}</td>
            <td>${r.usuario || ""}</td>
            <td>${r.fechaGuardado || ""}</td>
            <td>${r.horaGuardado || ""}</td>
        `;

        tbody.appendChild(tr);
    });
}

// ==============================
// Exportar a Excel usando SheetJS (xlsx)
// ==============================
// ==============================
// Exportar Excel con todas las columnas
// ==============================
function exportarExcel(){
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    if(!db.length){ Swal.fire('Aviso','No hay registros para exportar','info'); return; }

    const wsData = db.map(r => {
        const tramitesText = r.tramites.map(t => `${t.code}:${t.cantidad}`).join(', ');
        return {
            NP: r.np,
            FechaIngreso: r.fechaIng,
            Nombre: r.nombre,
            Ubicacion: r.ubicacion,
            Localidad: r.localidad,
            Tramites: tramitesText,
            FechaProg: r.fechaProg,
            FechaAut: r.fechaAut,
            FechaEnt: r.fechaEnt,
            Telefono: r.telefono,
            OrdenPago: r.ordenPago,
            FechaOrden: r.fechaOrd,
            Cantidad: r.cantidadGlobal,
            Recibo: r.reciboPago,
            ServidorPub: r.servidor,
            Escaner: r.escan,
            NoLeg: r.noLeg,
            NoHojas: r.noHojas,
            ClaveExp: r.claveExp,
            Observaciones: r.obs,
            Estatus: r.estatus,
            ImporteTotal: r.importeTotal,
            Usuario: r.usuario,
            FechaGuardado: r.fechaGuardado,
            HoraGuardado: r.horaGuardado
        };
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AgendaPagos");
    XLSX.writeFile(wb, `AgendaPagos_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ==============================
// Mostrar expediente en tabla en sección Buscar Expediente
// ==============================
function buscarYMostrarExpediente(np){
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const rec = db.find(r => r.np === np);
    const cont = document.getElementById("buscarExpedienteResult");
    if(!cont) return;
    cont.innerHTML = ''; // limpiar contenido previo

    if(!rec){
        cont.innerHTML = `<div class="no-result">No se encontró expediente NP: ${np}</div>`;
        return;
    }

    // Mapa de códigos a nombres completos
    const tramitesNombres = {
        "LUS": "L.U.S",
        "CIZ": "C.I.Z",
        "CANO": "C.A.N.O",
        "CUS": "C.U.S",
        "VBCUS": "V.B.C.U.S"
    };

    // Construir tabla simple
    const table = document.createElement('table');
    table.classList.add('expediente-table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Folio (NP)</th>
                <th>Fecha de Ingreso</th>
                <th>Nombre del Solicitante</th>
                <th>Ubicación del Predio</th>
                <th>Localidad / Colonia</th>
                <th>Permisos Solicitados</th>
                <th>Usuario</th>
                <th>Hora de Guardado</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${rec.np}</td>
                <td>${rec.fechaIng || ''}</td>
                <td>${rec.nombre || ''}</td>
                <td>${rec.ubicacion || ''}</td>
                <td>${rec.localidad || ''}</td>
                <td>${permisosList}</td>
                <td>${rec.usuario || ''}</td>
                <td>${rec.horaGuardado || ''}</td>
            </tr>
        </tbody>
    `;
    cont.appendChild(table);

    // PDF (si existe)
    if(rec.pdfData){
        const pdfContainer = document.createElement('div');
        pdfContainer.style.marginTop = '10px';
        pdfContainer.innerHTML = `<iframe src="${rec.pdfData}" style="width:100%;height:600px;" frameborder="0"></iframe>`;
        cont.appendChild(pdfContainer);
    }

    // Botón ir a formulario/agenda
    const btnForm = document.createElement('button');
    btnForm.textContent = "Ir a Agenda de Pagos";
    btnForm.className = "btn btn-primary";
    btnForm.style.marginTop = "10px";
    btnForm.addEventListener('click', ()=> showSection('section-pagos')); 
    cont.appendChild(btnForm);
}

// ==============================
// Evento buscar folio
// ==============================
$('#btnBuscarFolio')?.addEventListener('click', ()=> {
    const fol = $('#buscarFolio').value.trim();
    if(!fol){ Swal.fire('Aviso','Ingresa folio a buscar','warning'); return; }
    buscarYMostrarExpediente(fol);
});
