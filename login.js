(() => {
const DB_NAME="DB_Usuarios",DB_VER=1;let dbUsers;

const openReq=indexedDB.open(DB_NAME,DB_VER);
openReq.onupgradeneeded=e=>{
  dbUsers=e.target.result;
  if(!dbUsers.objectStoreNames.contains("usuarios")){
    const store=dbUsers.createObjectStore("usuarios",{keyPath:"usuario"});
    store.createIndex("usuario","usuario",{unique:true});
  }
};
openReq.onsuccess=e=>dbUsers=e.target.result;
openReq.onerror=()=>Swal.fire("Error","No se pudo abrir la base de usuarios","error");

document.addEventListener("DOMContentLoaded",()=>{
  // Tabs
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab+"Form").classList.add("active");
    });
  });

  // Toggle password
  document.querySelectorAll(".toggle-pass").forEach(t=>{
    t.addEventListener("click",()=>{
      const input=t.previousElementSibling;
      input.type = input.type==="password"?"text":"password";
      t.innerHTML=`<i class="fa-solid fa-${input.type==="password"?"eye":"eye-slash"}"></i>`;
    });
  });

  // Password strength
  const regPass=document.getElementById("regPass");
  const strengthBar=document.querySelector(".strength-bar");
  regPass.addEventListener("input",()=>{
    const val=regPass.value;
    let strength=0;
    if(val.length>=6) strength++;
    if(/[A-Z]/.test(val)) strength++;
    if(/[0-9]/.test(val)) strength++;
    if(/[^A-Za-z0-9]/.test(val)) strength++;
    strengthBar.style.width=`${(strength/4)*100}%`;
  });

  // Register
  document.getElementById("registerForm").addEventListener("submit",e=>{
    e.preventDefault();
    const usuario=document.getElementById("regUser").value.trim();
    const pass=document.getElementById("regPass").value;
    if(!usuario||!pass) return Swal.fire("Atención","Completa usuario y contraseña","warning");
    const tx=dbUsers.transaction("usuarios","readwrite");
    const store=tx.objectStore("usuarios");
    const req=store.add({usuario,pass});
    req.onsuccess=()=>{localStorage.setItem("sessionUser",usuario);window.location.href="main.html";}
    req.onerror=()=>Swal.fire("Error","El usuario ya existe o no se pudo registrar","error");
  });

  // Login
  document.getElementById("loginForm").addEventListener("submit",e=>{
    e.preventDefault();
    const usuario=document.getElementById("loginUser").value.trim();
    const pass=document.getElementById("loginPass").value;
    if(!usuario||!pass) return Swal.fire("Atención","Completa usuario y contraseña","warning");
    const tx=dbUsers.transaction("usuarios","readonly");
    const store=tx.objectStore("usuarios");
    const req=store.get(usuario);
    req.onsuccess=()=>{if(req.result&&req.result.pass===pass){localStorage.setItem("sessionUser",usuario);window.location.href="main.html"} else Swal.fire("Error","Usuario o contraseña incorrectos","error")};
    req.onerror=()=>Swal.fire("Error","No se pudo validar usuario","error");
  });

  // Auto-login
  const sessionUser=localStorage.getItem("sessionUser");
  if(sessionUser) window.location.href="main.html";

  // Partículas fondo
  const canvas=document.getElementById("particles");
  const ctx=canvas.getContext("2d");
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  let particles=[];
  for(let i=0;i<80;i++){particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*2+1,dx:(Math.random()-0.5)*0.5,dy:(Math.random()-0.5)*0.5})}
  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      p.x+=p.dx; p.y+=p.dy;
      if(p.x<0||p.x>canvas.width)p.dx*=-1;
      if(p.y<0||p.y>canvas.height)p.dy*=-1;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba(91,140,255,0.6)";ctx.fill();ctx.closePath();
    });
    requestAnimationFrame(animate);
  }
  animate();
});
})();
