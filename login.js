// login.js
(() => {
  const DB_NAME = "DB_Usuarios";
  const DB_VER = 1;
  let dbUsers;

  const openReq = indexedDB.open(DB_NAME, DB_VER);
  openReq.onupgradeneeded = e => {
    dbUsers = e.target.result;
    if (!dbUsers.objectStoreNames.contains("usuarios")) {
      const store = dbUsers.createObjectStore("usuarios", { keyPath: "usuario" });
      store.createIndex("usuario", "usuario", { unique: true });
    }
  };
  openReq.onsuccess = e => dbUsers = e.target.result;
  openReq.onerror = () => Swal.fire("Error", "No se pudo abrir la base de usuarios", "error");

  document.addEventListener("DOMContentLoaded", () => {
    // tabs behavior (keeps your HTML tabs)
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const tabName = btn.dataset.tab;
        // we expect form ids: loginForm and registerForm
        if (tabName === "login") document.getElementById("loginForm").classList.add("active");
        if (tabName === "register") document.getElementById("registerForm").classList.add("active");
      });
    });

    // Register
    const registerForm = document.getElementById("registerForm");
    registerForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const usuario = document.getElementById("regUser").value.trim();
      const pass = document.getElementById("regPass").value;

      if (!usuario || !pass) return Swal.fire("Atención", "Completa usuario y contraseña", "warning");
      const tx = dbUsers.transaction("usuarios", "readwrite");
      const store = tx.objectStore("usuarios");
      const req = store.add({ usuario, pass });

      req.onsuccess = () => {
        Swal.fire({ icon: "success", title: "Registrado", text: "Usuario creado", timer: 1300, showConfirmButton: false })
          .then(() => {
            // login automatically
            localStorage.setItem("sessionUser", usuario);
            window.location.href = "main.html";
          });
      };
      req.onerror = () => Swal.fire("Error", "El usuario ya existe o no se pudo registrar", "error");
    });

    // Login
    const loginForm = document.getElementById("loginForm");
    loginForm?.addEventListener("submit", (e) => {
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
          Swal.fire({ icon: "success", title: "Bienvenido", text: `Hola ${usuario}`, timer: 900, showConfirmButton: false })
            .then(() => window.location.href = "main.html");
        } else {
          Swal.fire("Error", "Usuario o contraseña incorrectos", "error");
        }
      };
      req.onerror = () => Swal.fire("Error", "No se pudo validar usuario", "error");
    });
  });
})();
