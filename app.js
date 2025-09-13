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
