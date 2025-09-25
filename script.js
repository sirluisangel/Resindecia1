/* ================================
   script1.js - Agenda Control de Pagos
   Versión optimizada y modular
   ================================ */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const DB_KEY = 'DB_Agenda';
const REG_KEY = 'DB_Registros';

// Formatos y utilidades
const currency = v => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(v||0));
const round2 = n => Math.round((Number(n)||0)*100)/100;

// ================================
// Inicialización
// ================================
document.addEventListener('DOMContentLoaded', () => {
  verificarUsuario();
  initNav();
  initTheme();
  initEstatusWatcher();
  initTramites();
  initFormButtons();
  renderResumen();
  renderReportes();
});

// ================================
// Usuario / Login
// ================================
function verificarUsuario() {
  let usuario = localStorage.getItem("usuario") || "Invitado";
  localStorage.setItem("usuario", usuario);
  mostrarUsuario(usuario);
}

function mostrarUsuario(usuario){
  const box = $("#userBox");
  if(box) box.innerHTML = `<i class="fa fa-user-circle"></i> Bienvenido, <strong>${usuario}</strong>`;
}

function login(nombre){
  if(nombre && nombre.trim()!==""){
    localStorage.setItem("usuario", nombre.trim());
    mostrarUsuario(nombre.trim());
  } else verificarUsuario();
}

function logout(){
  localStorage.removeItem("usuario");
  verificarUsuario();
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
