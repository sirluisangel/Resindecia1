(() => {
  const DB_NAME = "DB_Usuarios";
  const DB_VER = 1;
  let dbUsers;

  const openReq = indexedDB.open(DB_NAME, DB_VER);
  openReq.onupgradeneeded = e => {
    dbUsers = e.target.result;
    if (!dbUsers.objectStoreNames.contains("usuarios")) {
      dbUsers.createObjectStore("usuarios", { keyPath: "usuario" });
    }
  };
  openReq.onsuccess = e => dbUsers = e.target.result;
  openReq.onerror = () => Swal.fire("Error", "No se pudo abrir la base de usuarios", "error");

  document.addEventListener("DOMContentLoaded", () => {
    // Cambiar tabs
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab + "Form").classList.add("active");
      });
    });

    // Mostrar/ocultar contraseña
    document.querySelectorAll(".toggle-pass").forEach(icon => {
      icon.addEventListener("click", () => {
        const input = document.getElementById(icon.dataset.target);
        input.type = input.type === "password" ? "text" : "password";
        icon.classList.toggle("fa-eye-slash");
      });
    });

    // Fuerza de contraseña
    const regPass = document.getElementById("regPass");
    const strengthBar = document.querySelector(".strength-bar");
    regPass?.addEventListener("input", () => {
      const val = regPass.value;
      let strength = 0;
      if (val.length >= 6) strength++;
      if (/[A-Z]/.test(val)) strength++;
      if (/[0-9]/.test(val)) strength++;
      if (/[^A-Za-z0-9]/.test(val)) strength++;
      strengthBar.style.width = (strength * 25) + "%";
      strengthBar.style.background = strength < 2 ? "#ef4444" : strength < 3 ? "#facc15" : "#22c55e";
    });

    // Registro
    document.getElementById("registerForm")?.addEventListener("submit", e => {
      e.preventDefault();
      const usuario = document.getElementById("regUser").value.trim();
      const pass = document.getElementById("regPass").value;
      if (!usuario || !pass) return Swal.fire("Atención", "Completa usuario y contraseña", "warning");

      const tx = dbUsers.transaction("usuarios", "readwrite");
      const store = tx.objectStore("usuarios");
      const req = store.add({ usuario, pass });
      req.onsuccess = () => {
        Swal.fire({ icon:"success", title:"Registrado", text:"Usuario creado", timer:1200, showConfirmButton:false })
          .then(() => { localStorage.setItem("sessionUser", usuario); window.location.href = "main.html"; });
      };
      req.onerror = () => Swal.fire("Error", "El usuario ya existe", "error");
    });

    // Login
    document.getElementById("loginForm")?.addEventListener("submit", e => {
      e.preventDefault();
      const usuario = document.getElementById("loginUser").value.trim();
      const pass = document.getElementById("loginPass").value;
      if (!usuario || !pass) return Swal.fire("Atención", "Completa usuario y contraseña", "warning");

      const tx = dbUsers.transaction("usuarios", "readonly");
      const store = tx.objectStore("usuarios");
      const req = store.get(usuario);
      req.onsuccess = () => {
        if (req.result && req.result.pass === pass) {
          localStorage.setItem("sessionUser", usuario);
          Swal.fire({ icon:"success", title:"Bienvenido", text:`Hola ${usuario}`, timer:1000, showConfirmButton:false })
            .then(() => window.location.href = "main.html");
        } else {
          Swal.fire("Error", "Usuario o contraseña incorrectos", "error");
        }
      };
    });
  });
})();
