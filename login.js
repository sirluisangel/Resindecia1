(() => {
  const DB_NAME="DB_Usuarios", DB_VER=1; let dbUsers;
  const openReq=indexedDB.open(DB_NAME,DB_VER);
  openReq.onupgradeneeded=e=>{dbUsers=e.target.result;
    if(!dbUsers.objectStoreNames.contains("usuarios")){let store=dbUsers.createObjectStore("usuarios",{keyPath:"usuario"});store.createIndex("usuario","usuario",{unique:true});}
  };
  openReq.onsuccess=e=>dbUsers=e.target.result;
  openReq.onerror=()=>Swal.fire("Error","No se pudo abrir la base de usuarios","error");

  document.addEventListener("DOMContentLoaded",()=>{
    const authCard=document.getElementById("authCard");
    const toRegister=document.getElementById("toRegister");
    const toLogin=document.getElementById("toLogin");

    toRegister.addEventListener("click",()=>{authCard.style.transform="rotateY(180deg)";});
    toLogin.addEventListener("click",()=>{authCard.style.transform="rotateY(0deg)";});

    // mostrar/ocultar contraseña
    document.querySelectorAll(".toggle-pass").forEach(icon=>{
      icon.addEventListener("click",()=>{
        const input=icon.previousElementSibling;
        if(input.type==="password"){input.type="text";icon.classList.replace("fa-eye","fa-eye-slash");}
        else{input.type="password";icon.classList.replace("fa-eye-slash","fa-eye");}
      });
    });

    // fuerza contraseña
    const regPass=document.getElementById("regPass");
    const strengthBar=document.querySelector(".strength-bar");
    regPass?.addEventListener("input",()=>{
      const val=regPass.value; let strength=0;
      if(val.match(/[a-z]+/)) strength++;
      if(val.match(/[A-Z]+/)) strength++;
      if(val.match(/[0-9]+/)) strength++;
      if(val.match(/[$@#&!]+/)) strength++;
      if(val.length>=8) strength++;
      const perc=(strength/5)*100;
      strengthBar.style.width=perc+"%";
      strengthBar.style.background = perc<40?"var(--danger)":perc<80?"orange":"var(--success)";
    });

    // Registro
    document.getElementById("registerForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      const usuario=document.getElementById("regUser").value.trim();
      const pass=regPass.value;
      if(!usuario||!pass)return Swal.fire("Atención","Completa usuario y contraseña","warning");
      const tx=dbUsers.transaction("usuarios","readwrite");
      const store=tx.objectStore("usuarios");
      const req=store.add({usuario,pass});
      req.onsuccess=()=>{Swal.fire({icon:"success",title:"Registrado",text:"Usuario creado",timer:1200,showConfirmButton:false}).then(()=>{localStorage.setItem("sessionUser",usuario);window.location.href="main.html";});};
      req.onerror=()=>Swal.fire("Error","El usuario ya existe o no se pudo registrar","error");
    });

    // Login
    document.getElementById("loginForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      const btn=e.target.querySelector("button"); btn.disabled=true;
      btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i> Entrando...`;
      setTimeout(()=>{
        const usuario=document.getElementById("loginUser").value.trim();
        const pass=document.getElementById("loginPass").value;
        const tx=dbUsers.transaction("usuarios","readonly");
        const store=tx.objectStore("usuarios");
        const req=store.get(usuario);
        req.onsuccess=()=>{
          btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Entrar';
          if(req.result && req.result.pass===pass){localStorage.setItem("sessionUser",usuario);Swal.fire({icon:"success",title:"Bienvenido",text:`Hola ${usuario}`,timer:900,showConfirmButton:false}).then(()=>window.location.href="main.html");}
          else Swal.fire("Error","Usuario o contraseña incorrectos","error");
        };
        req.onerror=()=>{btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Entrar';Swal.fire("Error","No se pudo validar usuario","error");};
      },1000);
    });

    // partículas
    const canvas=document.getElementById("particles"), ctx=canvas.getContext("2d"); let particles=[];
    const resize=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
    window.addEventListener("resize",resize); resize();
    for(let i=0;i<80;i++){particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,dx:(Math.random()-0.5)*1.5,dy:(Math.random()-0.5)*1.5,r:Math.random()*3+2});}
    function animate(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(91,140,255,0.7)";
      particles.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();p.x+=p.dx;p.y+=p.dy;if(p.x<0||p.x>canvas.width)p.dx*=-1;if(p.y<0||p.y>canvas.height)p.dy*=-1;});requestAnimationFrame(animate);}
    animate();
  });
})();
