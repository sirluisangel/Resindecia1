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

  document.addEventListener("DOMContentLoaded", () => {
    // Tabs
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab + "Form").classList.add("active");
      });
    });

    // Mostrar / ocultar contraseña
    document.querySelectorAll(".toggle-pass").forEach(icon => {
      icon.addEventListener("click", () => {
        const input = document.getElementById(icon.dataset.target);
        input.type = input.type === "password" ? "text" : "password";
        icon.classList.toggle("fa-eye-slash");
      });
    });

    // Barra de fuerza contraseña
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

    // Animación de partículas
    const canvas = document.getElementById("particles");
    const ctx = canvas.getContext("2d");
    let particles = [];
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Particle {
      constructor(){this.x=Math.random()*canvas.width;this.y=Math.random()*canvas.height;
        this.size=Math.random()*2+1;this.speedX=(Math.random()-0.5)*1.5;this.speedY=(Math.random()-0.5)*1.5;}
      update(){this.x+=this.speedX;this.y+=this.speedY;
        if(this.x<0||this.x>canvas.width)this.speedX*=-1;
        if(this.y<0||this.y>canvas.height)this.speedY*=-1;}
      draw(){ctx.fillStyle="#5b8cff";ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();}
    }
    function init(){particles=[];for(let i=0;i<80;i++){particles.push(new Particle());}}
    function animate(){ctx.clearRect(0,0,canvas.width,canvas.height);
      particles.forEach(p=>{p.update();p.draw();});requestAnimationFrame(animate);}
    init();animate();
    window.addEventListener("resize",()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;init();});
  });
})();
