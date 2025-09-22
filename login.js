(() => {
  const DB_NAME = "DB_Usuarios";
  const DB_VER = 1;
  let dbUsers;

  const openReq = indexedDB.open(DB_NAME, DB_VER);
  openReq.onupgradeneeded = e => {
    dbUsers = e.target.result;
    if(!dbUsers.objectStoreNames.contains("usuarios")){
      const store = dbUsers.createObjectStore("usuarios",{keyPath:"usuario"});
      store.createIndex("usuario","usuario",{unique:true});
    }
  };
  openReq.onsuccess = e => dbUsers = e.target.result;
  openReq.onerror = () => Swal.fire("Error","No se pudo abrir la base de usuarios","error");

  document.addEventListener("DOMContentLoaded",()=>{
    // Tabs
    document.querySelectorAll(".tab").forEach(btn=>{
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p=>p.classList.remove("active"));
        btn.classList.add("active");
        const tabName=btn.dataset.tab;
        document.getElementById(tabName+"Form").classList.add("active");
      });
    });

    // Mostrar/ocultar contraseña
    document.querySelectorAll(".toggle-pass").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const input=btn.previousElementSibling;
        input.type = input.type === "password" ? "text" : "password";
        btn.querySelector("i").classList.toggle("fa-eye-slash");
      });
    });

    const registerForm=document.getElementById("registerForm");
    registerForm?.addEventListener("submit",e=>{
      e.preventDefault();
      const usuario=document.getElementById("regUser").value.trim();
      const pass=document.getElementById("regPass").value;
      if(!usuario||!pass) return Swal.fire("Atención","Completa usuario y contraseña","warning");

      const tx=dbUsers.transaction("usuarios","readwrite");
      const store=tx.objectStore("usuarios");
      const req=store.add({usuario,pass});
      req.onsuccess=()=>{
        Swal.fire({icon:"success",title:"Registrado",text:"Usuario creado",timer:1200,showConfirmButton:false})
          .then(()=>{
            localStorage.setItem("sessionUser",usuario);
            window.location.href="main.html";
          });
      };
      req.onerror=()=>Swal.fire("Error","El usuario ya existe","error");
    });

    const loginForm=document.getElementById("loginForm");
    loginForm?.addEventListener("submit",e=>{
      e.preventDefault();
      const usuario=document.getElementById("loginUser").value.trim();
      const pass=document.getElementById("loginPass").value;
      if(!usuario||!pass) return Swal.fire("Atención","Completa usuario y contraseña","warning");

      const tx=dbUsers.transaction("usuarios","readonly");
      const store=tx.objectStore("usuarios");
      const req=store.get(usuario);
      req.onsuccess=()=>{
        if(req.result && req.result.pass===pass){
          localStorage.setItem("sessionUser",usuario);
          Swal.fire({icon:"success",title:"Bienvenido",text:`Hola ${usuario}`,timer:900,showConfirmButton:false})
            .then(()=>window.location.href="main.html");
        } else Swal.fire("Error","Usuario o contraseña incorrectos","error");
      };
    });

    // Export DB
    document.getElementById("exportDB").addEventListener("click",()=>{
      const tx=dbUsers.transaction("usuarios","readonly");
      const store=tx.objectStore("usuarios");
      const req=store.getAll();
      req.onsuccess=()=>{
        const data=JSON.stringify(req.result);
        const blob=new Blob([data],{type:"application/json"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url; a.download="usuarios.json"; a.click();
        URL.revokeObjectURL(url);
      };
    });

    // Import DB
    const importInput=document.getElementById("importDB");
    document.getElementById("importDBBtn").addEventListener("click",()=>importInput.click());
    importInput.addEventListener("change",(e)=>{
      const file=e.target.files[0];
      if(!file) return;
      const reader=new FileReader();
      reader.onload=function(evt){
        try{
          const users=JSON.parse(evt.target.result);
          const tx=dbUsers.transaction("usuarios","readwrite");
          const store=tx.objectStore("usuarios");
          users.forEach(u=>store.put(u));
          Swal.fire("Éxito","Usuarios importados","success");
        } catch(err){Swal.fire("Error","Archivo inválido","error");}
      };
      reader.readAsText(file);
    });

    // Autologin
    const sessionUser=localStorage.getItem("sessionUser");
    if(sessionUser) window.location.href="main.html";

  });
})();
