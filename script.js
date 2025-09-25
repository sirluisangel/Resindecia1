// ==============================
// Helper selectors
// ==============================
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ==============================
// Formato moneda y redondeo
// ==============================
const currency = v => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(v||0));
const round2 = n => Math.round((Number(n)||0) * 100) / 100;

// ==============================
// IndexedDB
// ==============================
const DB_NAME = 'AgendaDB';
const DB_VERSION = 1;
let db;

// Inicialización DB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = e => reject(e.target.error);
        request.onsuccess = e => {
            db = e.target.result;
            resolve(db);
        };
        request.onupgradeneeded = e => {
            db = e.target.result;
            if(!db.objectStoreNames.contains('registros')){
                const store = db.createObjectStore('registros', {keyPath: 'np'});
                store.createIndex('fecha', 'fechaIng', {unique: false});
            }
        };
    });
}

// ==============================
// Inicialización al cargar
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
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
// Estatus watcher
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
// Tramites
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

        regBtn?.addEventListener('click', ()=> registrarMonto(label));
        verBtn?.addEventListener('click', ()=> verRegistrosTramite(label.dataset.code));
    });
}

// ==============================
// Registrar monto histórico
// ==============================
async function registrarMonto(label){
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
    }).then(async res=>{
        if(res.isConfirmed){
            const tx = db.transaction('registros', 'readwrite');
            const store = tx.objectStore('registros');
            const registro = await store.get(np);
            let registros = [];
            if(registro && registro.historico) registros = registro.historico;
            registros.push({ code, cantidad, precio, importe, fecha:new Date().toISOString(), usuario:$("#userBadge")?.textContent.trim() || 'Admin' });

            const newRec = { np, historico: registros };
            store.put(newRec);

            tx.oncomplete = () => Swal.fire('Registrado','El monto fue registrado correctamente.','success');
        }
    });
}

// ==============================
// Ver registros por código
// ==============================
async function verRegistrosTramite(code){
    const np = $('#np').value.trim();
    const tx = db.transaction('registros', 'readonly');
    const store = tx.objectStore('registros');
    const rec = await store.get(np);
    if(!rec || !rec.historico) return Swal.fire('Sin registros', 'No hay registros para este trámite', 'info');

    const filtered = rec.historico.filter(r=>r.code===code);
    if(filtered.length === 0) return Swal.fire('Sin registros', `No hay registros para ${code}`, 'info');

    const html = filtered.map(r=>`<div style="margin-bottom:8px">
        <b>NP:</b> ${np} — <b>Importe:</b> ${currency(r.importe)} — <b>Cant:</b> ${r.cantidad} — <b>Fecha:</b> ${new Date(r.fecha).toLocaleString()}
    </div>`).join('');
    Swal.fire({title:`Registros ${code}`, html, width:800});
}

// ==============================
// Render resumen
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
// Guardar / Actualizar / Eliminar registros
// ==============================
async function guardarRegistro(){
    const rec = await construirRegistroDesdeForm();
    const tx = db.transaction('registros', 'readwrite');
    const store = tx.objectStore('registros');

    const existing = await store.get(rec.np);
    if(existing){ Swal.fire('Error','NP ya existe. Usa actualizar.','warning'); return; }

    await store.put(rec);
    tx.oncomplete = () => { Swal.fire('Guardado','Registro guardado correctamente.','success'); renderResumen(); };
}

async function actualizarRegistro(){
    const rec = await construirRegistroDesdeForm();
    const tx = db.transaction('registros', 'readwrite');
    const store = tx.objectStore('registros');

    const existing = await store.get(rec.np);
    if(!existing){ Swal.fire('Error','NP no existe.','warning'); return; }

    await store.put(rec);
    tx.oncomplete = () => { Swal.fire('Actualizado','Registro actualizado correctamente.','success'); renderResumen(); };
}

async function deleteRegistro(np){
    const tx = db.transaction('registros', 'readwrite');
    const store = tx.objectStore('registros');
    await store.delete(np);
    tx.oncomplete = () => Swal.fire('Eliminado','Registro eliminado correctamente.','success');
}

// ==============================
// Buscar
// ==============================
async function buscarYMostrar(np){
    const tx = db.transaction('registros', 'readonly');
    const store = tx.objectStore('registros');
    const rec = await store.get(np);
    if(!rec){ Swal.fire('No encontrado','NP no existe','info'); return; }

    Object.keys(rec).forEach(k=>{
        const el = $('#'+k);
        if(el) el.value = rec[k] || '';
    });
    renderResumen();
}

// ==============================
// Reportes
// ==============================
function renderReportes(){
    const tbody = document.querySelector("#tablaReportes tbody");
    if(!tbody) return;
    tbody.innerHTML = '';

    const tx = db.transaction('registros', 'readonly');
    const store = tx.objectStore('registros');
    store.openCursor().onsuccess = function(event){
        const cursor = event.target.result;
        if(cursor){
            const r = cursor.value;
            const tr = document.createElement("tr");
            let tramitesText = r.tramites ? r.tramites.map(t=>`${t.code}:${t.cantidad}`).join(' ') : '';
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
            cursor.continue();
        }
    };
}
// ==============================
// Form buttons: Guardar / Actualizar / Eliminar / Buscar / Limpiar
// ==============================
function initFormButtons(){

    // ----------------------
    // Guardar
    // ----------------------
    $('#btnGuardar')?.addEventListener('click', async ()=>{
        const np = $('#np').value.trim();
        if(!np){ Swal.fire('Falta NP','Ingresa el NP antes de guardar.','warning'); return; }

        Swal.fire({
            title: 'Guardar registro',
            text: `¿Deseas guardar el registro NP: ${np}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, guardar'
        }).then(async (res)=>{
            if(res.isConfirmed){
                try{
                    await guardarRegistro();
                } catch(e){
                    Swal.fire('Error', e.message || e, 'error');
                }
            }
        });
    });

    // ----------------------
    // Actualizar
    // ----------------------
    $('#btnActualizar')?.addEventListener('click', async ()=>{
        const np = $('#np').value.trim();
        if(!np){ Swal.fire('Falta NP','Ingresa el NP a actualizar.','warning'); return; }

        Swal.fire({
            title: 'Actualizar registro',
            text: `¿Deseas actualizar el registro NP: ${np}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, actualizar'
        }).then(async (res)=>{
            if(res.isConfirmed){
                try{
                    await actualizarRegistro();
                } catch(e){
                    Swal.fire('Error', e.message || e, 'error');
                }
            }
        });
    });

    // ----------------------
    // Eliminar
    // ----------------------
    $('#btnEliminar')?.addEventListener('click', ()=>{
        const np = $('#np').value.trim();
        if(!np){ Swal.fire('Falta NP','Ingresa el NP a eliminar.','warning'); return; }

        Swal.fire({
            title:'Eliminar registro',
            text:`¿Eliminar expediente NP: ${np}?`,
            icon:'warning',
            showCancelButton:true,
            confirmButtonText: 'Sí, eliminar'
        }).then(res=>{
            if(res.isConfirmed) deleteRegistro(np);
        });
    });

    // ----------------------
    // Buscar
    // ----------------------
    $('#btnBuscar')?.addEventListener('click', async ()=>{
        const np = $('#np').value.trim();
        if(!np){ Swal.fire('Falta NP','Ingresa el NP para buscar.','warning'); return; }

        Swal.fire({
            title:'Buscar registro',
            text:`¿Deseas buscar el registro NP: ${np}?`,
            icon:'question',
            showCancelButton:true,
            confirmButtonText:'Sí, buscar'
        }).then(async res=>{
            if(res.isConfirmed){
                try{
                    await buscarYMostrar(np);
                } catch(e){
                    Swal.fire('Error', e.message || e,'error');
                }
            }
        });
    });

    // ----------------------
    // Limpiar
    // ----------------------
    $('#btnLimpiar')?.addEventListener('click', ()=>{
        Swal.fire({
            title:'Limpiar formulario',
            text:'¿Deseas limpiar todos los campos del formulario?',
            icon:'question',
            showCancelButton:true,
            confirmButtonText:'Sí, limpiar'
        }).then(res=>{
            if(res.isConfirmed){
                $('#formPagos')?.reset();
                renderResumen();
                Swal.fire('Formulario limpio','Todos los campos fueron restablecidos','success');
            }
        });
    });

}
