/* TPV BETA V1 · Simulador TPV «Las Moreras» (HOTR0208)
   © 2026 Ángel Manuel Domínguez Lavado. Todos los derechos reservados.
   Inicio de sesión con Firebase Authentication y datos en Cloud Firestore.
   Quién puede leer o escribir cada dato lo deciden las reglas del servidor (firestore.rules). */
'use strict';
const CFG = window.TPV_CONFIG || {};

/* ---------- Utilidades ---------- */
/* ---------- Utilidades ---------- */
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r2 = n => Math.round(n*100)/100;
const eur = n => r2(n).toFixed(2).replace(".", ",") + " €";
const num = s => { const v = parseFloat(String(s).replace(",", ".")); return isNaN(v) ? NaN : r2(v); };
const today = () => new Date().toISOString().slice(0,10);
const hhmm = t => new Date(t).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
const mins = t => Math.max(0, Math.round((Date.now()-t)/60000));
const fmtDate = s => { const [y,m,d] = String(s).split("-"); return d ? `${d}/${m}/${y}` : s; };
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true,2600); }
function load(key, fallback){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }catch(e){ return fallback; } }
function save(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
function shuffle(a){ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; }
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clean = v => v===undefined ? null : JSON.parse(JSON.stringify(v));
const r1 = n => Math.round(n*10)/10;
const coma = v => v==null||v==="" ? "" : String(v).replace(".", ",");
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function seeded(a, seed){ const b=a.slice(); let x=hashStr(seed)||1; const rnd=()=>{ x^=x<<13; x>>>=0; x^=x>>>17; x^=x<<5; x>>>=0; return x/4294967296; }; for(let i=b.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; }

/* ---------- Firebase ---------- */
firebase.initializeApp(CFG.firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ignoreUndefinedProperties:true, merge:true});
// Solo para pruebas en el ordenador del desarrollador (nunca en la app publicada)
const EMU = CFG.emulador === true && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
if(EMU){ auth.useEmulator("http://localhost:9099"); db.useEmulator("localhost", 8080); }
const FV = firebase.firestore.FieldValue;
const correo = u => { u = String(u||"").trim().toLowerCase(); return u.includes("@") ? u : `${u}@${CFG.dominioUsuarios}`; };
const usuarioDe = email => String(email||"").split("@")[0];
const ROL_TXT = {admin:"Administrador", docente:"Docente", alumno:"Alumno"};

/* ---------- Estado ---------- */
let U = {user:null, perfil:null};
let mode = "app";          // app | tpv (docente viendo el TPV) | licencia | clave
let prevMode = "app";
let subs = [];              // escuchas de la sesión
let subSv = [];             // escuchas del servicio
const parar = arr => { arr.forEach(f=>{ try{ f(); }catch(e){} }); arr.length = 0; };
const STEPS = [["a","Preparar","A"],["sala","Sala","B"],["barra","Barra","B"],["cocina","Cocina","B"],["caja","Caja","C"],["d","Cierre","D"],["test","Cuestionario","?"],["resumen","Resumen","✓"]];
const FRESH = () => ({step:0, team:"", caja:100, a:[], d:[], orders:[], nOrder:0, tickets:[], nTicket:0, cashErrRot:{1:0}, cardDenied:0, arqueo:null, fecha:today(), abierto:false, nRot:1, rot:1});
let S = FRESH();
let SID = null, SV = null, svDenied = false;
const blankDraft = mesa => ({mesa, lines:{}, notas:{}, obs:"", stage:"menu", asked:null, allergies:[]});
let draft = blankDraft("Mesa 1");
let pay = null;
const esDocente = () => U.perfil && U.perfil.rol==="docente";
const yo = () => U.user ? U.user.uid : "";

/* ---------- Derivados ---------- */
/* ---------- Derivados ---------- */
const lineStation = l => item(l.pid).st;
function orderStations(o){ return [...new Set(o.lines.map(lineStation))]; }
function openOrders(mesa){ return S.orders.filter(o=>o.mesa===mesa && !o.paid); }
function mesaTotal(mesa){ return r2(openOrders(mesa).reduce((s,o)=>s+o.lines.reduce((t,l)=>t+item(l.pid).p*l.q,0),0)); }
function pending(st){ return S.orders.filter(o=>o.st[st] && o.st[st]!=="listo" && o.st[st]!=="servido").length; }
function aggLines(orders){
  const m = {};
  orders.forEach(o=>o.lines.forEach(l=>{ m[l.pid]=(m[l.pid]||0)+l.q; }));
  return Object.entries(m).map(([pid,q])=>({pid,q,n:item(pid).n,p:item(pid).p,imp:r2(item(pid).p*q)}));
}
function ivaSplit(total){ const base = r2(total/(1+IVA)); return {base, iva:r2(total-base), total:r2(total)}; }
const nombreDe = uid => (SV && SV.nombres && SV.nombres[uid]) || "—";
const whoLine = () => !SV ? "" : ["sala","barra","cocina"].map(k=>`${ROLES[k]}: ${((SV.puestos||{})[k]||[]).map(u=>esc(nombreDe(u))).join(", ")||"—"}`).join(" · ");
function puestoDe(uid, sv){ sv = sv||SV; const p=(sv&&sv.puestos)||{}; return ["sala","barra","cocina"].filter(k=>(p[k]||[]).includes(uid)); }

/* ---------- Pintado ---------- */
let pendingRender = false;
function repaint(){
  const a = document.activeElement;
  if(a && a.matches && a.matches("input,textarea,select")){ pendingRender = true; return; }
  render();
}
document.addEventListener("focusout", ()=>{ if(pendingRender){ pendingRender=false; setTimeout(()=>{ const a=document.activeElement; if(!(a&&a.matches&&a.matches("input,textarea,select"))) render(); else pendingRender=true; }, 50); } });

function pintarCabecera(){
  const w = $("#who"); if(!w) return;
  if(!U.user || !U.perfil){ w.innerHTML = U.user ? `<button type="button" class="btn small ghost" data-act="salir">Salir</button>` : ""; return; }
  const p = U.perfil;
  const toggle = p.rol==="docente" && p.activo ? (mode==="tpv" ? `<button type="button" class="btn small" data-act="panel">Panel docente</button>` : `<button type="button" class="btn small" data-act="vertpv">Ver el TPV</button>`) : "";
  w.innerHTML = `<span>${esc(p.nombre)}${p.inicial?` ${esc(p.inicial)}.`:""} · ${ROL_TXT[p.rol]||""}</span><span class="row" style="gap:6px;justify-content:flex-end">${toggle}<button type="button" class="btn small ghost" data-act="clave">Contraseña</button><button type="button" class="btn small ghost" data-act="salir">Salir</button></span>`;
}

function render(){
  pintarCabecera();
  const app = $("#app");
  if(mode==="licencia"){ app.innerHTML = vLicencia(); return; }
  if(!U.user){ app.innerHTML = vLogin(); return; }
  if(mode==="clave"){ app.innerHTML = vCambioClave(); return; }
  if(U.cargando){ app.innerHTML = `<p class="muted">Cargando…</p>`; return; }
  if(!U.perfil){ app.innerHTML = vSinPerfil(); return; }
  if(!U.perfil.activo){ app.innerHTML = vPendiente(); return; }
  if(U.perfil.rol==="admin"){ app.innerHTML = vAdmin(); return; }
  if(U.perfil.rol==="docente" && mode!=="tpv"){ app.innerHTML = vDocente(); return; }
  app.innerHTML = vTPV();
}

/* ---------- Acceso ---------- */
let loginMsg = "";
function vLogin(){
  return `<form class="card stack" id="formLogin" style="max-width:460px" autocomplete="on">
    <div><div class="eyebrow">TPV BETA V1</div><h2>Entrar</h2></div>
    <p class="muted">Entra con el usuario y la contraseña que te ha dado el Administrador.</p>
    ${loginMsg?`<div class="note bad">${esc(loginMsg)}</div>`:""}
    <label class="field"><span>Usuario</span><input type="text" name="u" required autocapitalize="none" autocomplete="username" placeholder="alumno01"></label>
    <label class="field"><span>Contraseña</span><input type="password" name="p" required autocomplete="current-password"></label>
    <button class="btn">Entrar</button>
    <p class="muted" style="font-size:.9rem">Al pulsar Salir, la app borra sus datos de este dispositivo. Cierra siempre tu sesión al terminar.</p>
  </form>`;
}
function vSinPerfil(){
  return `<form class="card stack" id="formAlta" style="max-width:520px">
    <div><div class="eyebrow">Primera vez</div><h2>Tu cuenta no está dada de alta</h2></div>
    <p>Escribe tu nombre y la inicial de tu primer apellido. Es el único dato personal que guarda la app. El Administrador tendrá que activar tu cuenta.</p>
    <label class="field"><span>Nombre</span><input type="text" name="nombre" required maxlength="40" autocomplete="off"></label>
    <label class="field"><span>Inicial del primer apellido</span><input type="text" name="inicial" required maxlength="2" autocomplete="off" style="max-width:6rem"></label>
    <div class="row"><button class="btn">Enviar al Administrador</button><button type="button" class="btn ghost" data-act="salir">Salir</button></div></form>`;
}
function vPendiente(){
  return `<div class="card stack" style="max-width:520px"><div><div class="eyebrow">Cuenta pendiente</div><h2>Hola, ${esc(U.perfil.nombre)}</h2></div>
    <p>El Administrador tiene que activar tu cuenta. Esta pantalla cambiará sola cuando lo haga.</p>
    <div class="row"><button type="button" class="btn ghost" data-act="salir">Salir</button></div></div>`;
}
let claveMsg = "";
function vCambioClave(){
  return `<form class="card stack" id="formClave" style="max-width:460px">
    <div><div class="eyebrow">Tu cuenta</div><h2>Cambiar la contraseña</h2></div>
    ${claveMsg}
    <label class="field"><span>Contraseña actual</span><input type="password" name="actual" required autocomplete="current-password"></label>
    <label class="field"><span>Contraseña nueva (mínimo 8 caracteres)</span><input type="password" name="nueva" required minlength="8" autocomplete="new-password"></label>
    <label class="field"><span>Repite la contraseña nueva</span><input type="password" name="repite" required minlength="8" autocomplete="new-password"></label>
    <div class="row"><button class="btn">Cambiar</button><button type="button" class="btn ghost" data-act="volver">Volver</button></div></form>`;
}

document.addEventListener("submit", async ev=>{
  const f = ev.target; ev.preventDefault();
  if(f.id==="formLogin"){
    const b=f.querySelector("button"); b.disabled=true;
    try{ await auth.signInWithEmailAndPassword(correo(f.u.value), f.p.value); loginMsg=""; }
    catch(er){ loginMsg = ["auth/invalid-credential","auth/wrong-password","auth/user-not-found","auth/invalid-email","auth/invalid-login-credentials"].includes(er.code) ? "Usuario o contraseña incorrectos." : er.code==="auth/network-request-failed" ? "Sin conexión a internet." : er.code==="auth/user-disabled" ? "Esta cuenta está desactivada." : er.code==="auth/too-many-requests" ? "Demasiados intentos. Espera unos minutos." : "No se ha podido entrar: "+(er.code||er.message); render(); }
  }
  if(f.id==="formAlta"){
    const d = {nombre:f.nombre.value.trim().slice(0,40), inicial:f.inicial.value.trim().replace(".","").slice(0,2).toUpperCase(), usuario:usuarioDe(U.user.email).slice(0,40)||"?", rol:"alumno", activo:false, creadoEn:FV.serverTimestamp()};
    if(U.user.email===correo(CFG.usuarioAdmin)) Object.assign(d, {rol:"admin", activo:true, nombre:d.nombre||"Administrador"});
    try{ await db.doc("usuarios/"+U.user.uid).set(d); }catch(er){ toast("No se ha podido enviar: "+(er.code||er.message)); }
  }
  if(f.id==="formClave"){
    if(f.nueva.value!==f.repite.value){ claveMsg=`<div class="note bad">Las dos contraseñas nuevas no coinciden.</div>`; render(); return; }
    if(f.nueva.value.length<8){ claveMsg=`<div class="note bad">La contraseña nueva debe tener al menos 8 caracteres.</div>`; render(); return; }
    try{
      const cred = firebase.auth.EmailAuthProvider.credential(U.user.email, f.actual.value);
      await U.user.reauthenticateWithCredential(cred); await U.user.updatePassword(f.nueva.value);
      claveMsg=""; mode=prevMode; render(); toast("Contraseña cambiada.");
    }catch(er){ claveMsg=`<div class="note bad">${["auth/wrong-password","auth/invalid-credential","auth/invalid-login-credentials"].includes(er.code)?"La contraseña actual no es correcta.":er.code==="auth/weak-password"?"La contraseña nueva es demasiado débil.":"No se ha podido cambiar: "+esc(er.code||er.message)}</div>`; render(); }
  }
  if(f.id==="formCrear") crearCuenta(f);
});

async function salir(){
  parar(subSv); parar(subs);
  try{ await auth.signOut(); }catch(e){}
  try{ localStorage.clear(); sessionStorage.clear(); }catch(e){}
  try{ if(window.caches) for(const k of await caches.keys()) await caches.delete(k); }catch(e){}
  location.reload();
}

let perfilUnsub = null;
auth.onAuthStateChanged(u=>{
  if(perfilUnsub){ perfilUnsub(); perfilUnsub=null; }
  parar(subSv); parar(subs);
  U = {user:u, perfil:null, cargando:!!u}; mode="app"; SID=null; SV=null; S=FRESH();
  render();
  if(!u) return;
  perfilUnsub = db.doc("usuarios/"+u.uid).onSnapshot(d=>{
    if(d.metadata.hasPendingWrites) return;
    const antes = U.perfil; U.cargando=false;
    U.perfil = d.exists ? d.data() : null;
    const cambio = !antes || !U.perfil || antes.rol!==U.perfil.rol || antes.activo!==U.perfil.activo;
    if(cambio){ parar(subSv); parar(subs); SID=null; SV=null; if(U.perfil && U.perfil.activo) arrancar(); }
    render();
  }, er=>{ console.warn(er); U.cargando=false; U.perfil=null; render(); });
});
function arrancar(){
  const r = U.perfil.rol;
  if(r==="admin") arrancarAdmin();
  else { escucharActual(); if(r==="docente") arrancarDocente(); }
}

/* ---------- Servicio en curso ---------- */
function escucharActual(){
  subs.push(db.doc("config/actual").onSnapshot(d=>{
    const sid = d.exists ? d.data().servicio : null;
    if(sid!==SID) conectar(sid);
  }, er=>console.warn("actual", er)));
}
let reintento = null;
function conectar(sid){
  parar(subSv); clearTimeout(reintento);
  SID = sid; SV = null; svDenied = false; const step = S.step; S = FRESH(); S.step = step; pay = null; Q.doc=null; Q.enviado=null; Q.qid=null;
  if(!sid){ render(); return; }
  const ref = db.doc("servicios/"+sid);
  subSv.push(ref.onSnapshot(d=>{
    svDenied = false;
    SV = d.exists ? Object.assign({id:d.id}, d.data()) : null;
    if(SV){
      S.team=SV.team||""; S.caja=SV.caja!=null?SV.caja:100; S.a=SV.a||[]; S.d=SV.d||[]; S.arqueo=SV.arqueo||null;
      S.abierto = SV.estado==="abierto"; S.fecha=SV.fecha||today(); S.nOrder=SV.nOrder||0; S.nTicket=SV.nTicket||0;
      S.cashErrRot={1:SV.cashErr||0}; S.cardDenied=SV.cardDenied||0;
      if(!esDocente()) escucharCuestionarioAlumno();
    }
    repaint();
  }, er=>{
    // Un alumno que no está en este servicio no puede leerlo. Se vuelve a intentar por si el docente lo añade.
    svDenied = true; SV = null; repaint();
    if(SID===sid) reintento = setTimeout(()=>{ if(SID===sid && U.user) conectar(sid); }, 8000);
  }));
  subSv.push(ref.collection("comandas").onSnapshot(s=>{ S.orders = s.docs.map(x=>normOrder(x.data())).sort((a,b)=>a.t-b.t); repaint(); }, ()=>{}));
  subSv.push(ref.collection("tiques").onSnapshot(s=>{ S.tickets = s.docs.map(x=>Object.assign({pagos:[], lines:[], cliente:{}}, x.data())).sort((a,b)=>String(a.num).localeCompare(String(b.num))); repaint(); }, ()=>{}));
}
function normOrder(o){
  o.lines = o.lines||[]; o.allergies = o.allergies||[]; o.st = o.st||{}; o.tm = o.tm||{};
  Object.keys(o.st).forEach(s=>{ o.tm[s]=o.tm[s]||{}; }); o.obs=o.obs||""; o.paid=!!o.paid; return o;
}

/* Escritura en la base de datos */
const fallo = e => { console.warn(e); toast("No se ha podido guardar. Revisa la conexión."); };
function share(part, id){
  if(!SID) return;
  const ref = db.doc("servicios/"+SID);
  if(part==="order"){ const o=S.orders.find(x=>x.id===id); if(o) ref.collection("comandas").doc(id).set(clean(o)).catch(fallo); }
  else if(part==="ticket"){ const t=S.tickets.find(x=>x.id===id); if(t) ref.collection("tiques").doc(id).set(clean(t)).catch(fallo); }
  else if(["a","d","arqueo"].includes(part)) ref.update({[part]:clean(S[part])}).catch(fallo);
}
async function nextCounter(name){
  const ref = db.doc("servicios/"+SID);
  return db.runTransaction(async tx=>{ const d = await tx.get(ref); const n = ((d.data()||{})[name]||0)+1; tx.update(ref, {[name]:n}); return n; });
}
function bump(path, local){
  local();
  if(!SID) return;
  const campo = path.startsWith("cashErr") ? "cashErr" : path;
  db.doc("servicios/"+SID).update({[campo]:FV.increment(1)}).catch(fallo);
}
function persist(){}

/* ---------- TPV ---------- */
function pasosPermitidos(){
  if(esDocente()) return ["a","sala","barra","cocina","caja","d","resumen"];
  const out = [];
  if(S.abierto){
    const p = puestoDe(yo());
    out.push("a");
    if(p.includes("sala")) out.push("sala");
    if(p.includes("barra")) out.push("barra");
    if(p.includes("cocina")) out.push("cocina");
    if(p.includes("sala")) out.push("caja");
    out.push("d");
  }
  if(quizVisible()) out.push("test");
  return out;
}
function vTPV(){
  if(!SID) return `<div class="card stack"><h2>No hay ningún servicio abierto</h2><p>${esDocente()?"Abre un servicio desde el panel docente.":"Espera a que el docente abra el servicio. Esta pantalla cambiará sola."}</p></div>`;
  if(!SV) return svDenied
    ? `<div class="card stack"><h2>No estás en este servicio</h2><p>El docente no te ha asignado a sala, barra ni cocina en el servicio de hoy. Avísale. Esta pantalla cambiará sola cuando te asigne.</p></div>`
    : `<p class="muted">Cargando el servicio…</p>`;
  const allowed = pasosPermitidos();
  if(!allowed.length) return `<div class="card stack"><h2>El servicio está cerrado</h2><p>${esc(S.team||"Servicio")} · ${fmtDate(S.fecha)}. Gracias por tu trabajo.</p></div>`;
  if(!allowed.includes(STEPS[S.step][0])) S.step = STEPS.findIndex(s=>s[0]===allowed[0]);
  const badges = {barra:pending("barra"), cocina:pending("cocina")};
  const nav = `<nav class="phases" aria-label="Pantallas del TPV" style="grid-template-columns:repeat(${allowed.length},minmax(0,1fr))">${STEPS.map(([k,n,l],i)=>!allowed.includes(k)?"":`<button type="button" data-go="${i}" ${S.step===i?'aria-current="step"':''}><b>${l}</b>${n}${badges[k]?`<span class="badge" aria-label="${badges[k]} pendientes">${badges[k]}</span>`:''}</button>`).join("")}</nav>`;
  const mios = puestoDe(yo());
  const rb = `<div class="rotbar">${S.abierto?"Servicio abierto":"Servicio cerrado"}${esDocente()?"":` · tu puesto: ${mios.map(k=>ROLES[k]).join(", ")||"—"}`}<span class="muted" style="font-weight:400">${whoLine()}</span></div>`;
  const k = STEPS[S.step][0];
  const views = {a:vFaseA, sala:vSala, barra:()=>vStation("barra"), cocina:()=>vStation("cocina"), caja:vCaja, d:vCierre, test:vTest, resumen:vResumen};
  return nav + `<section class="stack">${rb}${(!S.abierto && !["test","resumen"].includes(k))?vCerrado():views[k]()}</section>`;
}
function vCerrado(){ return `<div class="card stack"><h2>El servicio está cerrado</h2><p>No se pueden hacer cambios en un servicio cerrado.</p></div>`; }
function go(k){ S.step = STEPS.findIndex(s=>s[0]===k); render(); window.scrollTo({top:0}); }

/* ---------- Fases A, B, C y D ---------- */
/* ---------- Fase A ---------- */
function checklist(list, sel, key){
  return `<ul class="checklist">${list.map(t=>`<li><label class="check"><input type="checkbox" data-check="${key}" value="${esc(t)}" ${sel.includes(t)?'checked':''}><span>${esc(t)}</span></label></li>`).join("")}</ul>`;
}
function bar(n,total){ return `<span class="muted">${n} de ${total} hechos</span><div class="progress" aria-hidden="true"><span style="width:${total?Math.round(n/total*100):0}%"></span></div>`; }
function vFaseA(){
  const total = FASE_A.reduce((n,g)=>n+g.items.length,0);
  return `<div><div class="eyebrow">Fase A</div><h2>Preservicio, higiene y puesta a punto</h2></div>
    <p>Marcad cada punto cuando lo hayáis hecho de verdad en el aula-taller. El cambio inicial de la caja es <b>${eur(S.caja)}</b>.</p>${bar(S.a.length,total)}
    ${FASE_A.map(g=>`<div class="stack" style="gap:8px"><h3>${g.g}</h3>${checklist(g.items,S.a,"a")}</div>`).join("")}
    <div class="next"><span></span>${pasosPermitidos().includes("sala")?`<button type="button" class="btn" data-goto="sala">Ir a la sala</button>`:""}</div>`;
}

/* ---------- Sala (toma de comandas) ---------- */
function allergenTags(a){ return a.length? a.map(x=>`<span class="tag">${x}</span>`).join("") : `<span class="tag none">Sin alérgenos</span>`; }
function stateLabel(s){ return {nuevo:"Enviada",recibido:"Recibida",prep:"En preparación",listo:"Lista para pase",servido:"Servida"}[s]||s; }
function vSala(){
  const tables = `<div class="tables">${MESAS.map(m=>{ const o=openOrders(m); const t=mesaTotal(m);
    return `<button type="button" class="table-btn ${o.length?'busy':''}" data-mesa="${m}" aria-pressed="${draft.mesa===m}"><b>${m}</b><small>${o.length?`${o.length} comanda${o.length>1?'s':''} · ${eur(t)}`:'Libre'}</small></button>`; }).join("")}</div>`;
  const lines = Object.entries(draft.lines).filter(([,q])=>q>0);
  const total = lines.reduce((s,[id,q])=>s+item(id).p*q,0);
  let box;
  if(draft.stage==="menu"){
    box = `<div class="order stack" id="orderBox">
      <h3>Nueva comanda · ${esc(draft.mesa)}</h3>
      ${lines.length? lines.map(([id,q])=>{const it=item(id); return `<div class="order-line"><div class="qty"><button type="button" data-qty="${id}" data-d="-1" aria-label="Quitar uno">−</button><b>${q}</b><button type="button" data-qty="${id}" data-d="1" aria-label="Añadir uno">+</button></div><div>${esc(it.n)} <span class="muted" style="font-size:.8rem">→ ${it.st==="barra"?"Barra":"Cocina"}</span><input type="text" data-nota="${id}" value="${esc(draft.notas[id]||"")}" placeholder="Observación: punto, temperatura…" style="min-height:40px;margin-top:4px;font-size:.9rem;padding:6px 10px"></div><span class="price">${eur(it.p*q)}</span></div>`}).join("") : `<p class="muted">Toca + en la carta para añadir lo que pide el cliente.</p>`}
      <div class="row" style="justify-content:space-between"><b>Total: ${eur(total)}</b><button type="button" class="btn" id="toAllergens" ${lines.length?'':'disabled'}>Confirmar comanda</button></div>
    </div>`;
  } else if(draft.stage==="ask"){
    box = `<div class="order stack" id="orderBox"><h3>Antes de enviar</h3>
      <p class="quote">¿Habéis preguntado si alguien tiene alergias o intolerancias?</p>
      <div class="options">
        <button type="button" class="option" data-ask="no-alergias">Sí, y nadie tiene alergias.</button>
        <button type="button" class="option" data-ask="alergias">Sí, y hay alguna alergia.</button>
        <button type="button" class="option" data-ask="no">No hemos preguntado.</button>
      </div></div>`;
  } else if(draft.stage==="which"){
    box = `<div class="order stack" id="orderBox"><h3>¿Qué alergia tiene el cliente?</h3>
      <div class="chips">${ALERGENOS.map(a=>`<button type="button" class="chip" data-allergy="${a}" aria-pressed="${draft.allergies.includes(a)}">${a}</button>`).join("")}</div>
      <button type="button" class="btn" id="checkAllergy" ${draft.allergies.length?'':'disabled'}>Revisar la comanda</button></div>`;
  } else {
    const risky = lines.map(([id])=>item(id)).filter(it=>it.a.some(a=>draft.allergies.includes(a)));
    let msg;
    if(draft.asked==="no") msg = `<div class="note bad"><b>Preguntad siempre por las alergias antes de enviar la comanda.</b> Volved con el cliente y repetid la comanda en voz alta.</div>`;
    else if(risky.length) msg = `<div class="note bad"><b>¡Cuidado!</b> ${risky.map(r=>esc(r.n)).join(", ")} ${risky.length>1?'llevan':'lleva'} ${draft.allergies.join(", ").toLowerCase()}. Explicádselo al cliente y ofrecedle otra opción.</div>`;
    else if(draft.asked==="alergias") msg = `<div class="note ok"><b>Bien hecho.</b> Nada lleva ${draft.allergies.join(", ").toLowerCase()}. La alergia irá marcada en la nota de pedido de barra y cocina.</div>`;
    else msg = `<div class="note ok"><b>Bien hecho.</b> Repetid la comanda en voz alta y enviadla.</div>`;
    box = `<div class="order stack" id="orderBox"><h3>Comanda de ${esc(draft.mesa)}</h3>${msg}
      <label class="field"><span>Observaciones generales para barra y cocina</span><input type="text" id="obs" value="${esc(draft.obs)}" placeholder="Ej.: servir primero las bebidas"></label>
      <div class="row">${risky.length||draft.asked==="no"?`<button type="button" class="btn ghost" id="backToMenu">Corregir la comanda</button>`:''}<button type="button" class="btn" id="sendOrder">Enviar a barra y cocina</button></div></div>`;
  }
  const menu = Object.entries(CARTA).map(([g,list])=>`<div class="menu-group"><h3>${g}</h3>${list.map(it=>`<div class="item"><div>${esc(it.n)}<div class="tags">${allergenTags(it.a)}</div></div><span class="price">${eur(it.p)}</span><button type="button" class="add" data-add="${it.id}" aria-label="Añadir ${esc(it.n)}" ${draft.stage!=="menu"?'disabled':''}>+</button></div>`).join("")}</div>`).join("");
  const mesaOrders = openOrders(draft.mesa);
  const status = mesaOrders.length ? `<div class="card stack"><h3>Seguimiento de ${esc(draft.mesa)}</h3>${mesaOrders.map(o=>`<div class="stack" style="gap:6px"><div class="row"><b>Comanda nº ${o.n}</b><span class="muted">${hhmm(o.t)}</span></div>
      ${orderStations(o).map(st=>`<div class="row" style="justify-content:space-between"><span>${st==="barra"?"Barra":"Cocina"}: ${o.lines.filter(l=>lineStation(l)===st).map(l=>`${l.q}× ${esc(item(l.pid).n)}`).join(", ")}</span><span class="row"><span class="state ${o.st[st]}">${stateLabel(o.st[st])}</span>${o.st[st]==="listo"?`<button type="button" class="btn small" data-served="${o.id}" data-st="${st}">Recoger y servir</button>`:''}</span></div>`).join("")}</div>`).join("<hr style='border:0;border-top:1px solid var(--line);width:100%'>")}
      <button type="button" class="btn ghost" data-goto="caja">El cliente pide la cuenta</button></div>` : "";
  return `<div><div class="eyebrow">Fase B · Sala</div><h2>Toma de comandas</h2></div>
    <p>Elegid la mesa, tomad la comanda y enviadla. Las bebidas van a barra y las comidas a cocina.</p>
    ${tables}
    <div class="split"><div class="stack">${box}${status}</div><div class="stack" style="gap:12px">${menu}</div></div>`;
}

/* ---------- Barra y cocina (notas de pedido) ---------- */
function vStation(st){
  const list = S.orders.filter(o=>o.st[st] && o.st[st]!=="servido").sort((a,b)=>a.t-b.t);
  const next = {nuevo:["recibido","Marcar recibida"], recibido:["prep","Empezar a preparar"], prep:["listo","Lista para pase"]};
  const done = S.orders.filter(o=>o.st[st]==="servido").length;
  return `<div><div class="eyebrow">Fase B · ${st==="barra"?"Barra":"Cocina / pase"}</div><h2>Notas de pedido de ${st==="barra"?"barra":"cocina"}</h2></div>
    <p>Atended primero las más antiguas. Marcad cada estado según avancéis para que sala sepa cuándo recoger.</p>
    ${list.length?`<div class="queue">${list.map(o=>{ const ls=o.lines.filter(l=>lineStation(l)===st); const s=o.st[st];
      return `<article class="ticket st-${s}"><header><b>${esc(o.mesa)}</b><span class="muted">Nº ${o.n} · ${hhmm(o.t)} · hace ${mins(o.t)} min</span></header>
        <ul>${ls.map(l=>`<li><b>${l.q}×</b> ${esc(item(l.pid).n)}${l.nota?` <i>(${esc(l.nota)})</i>`:''}</li>`).join("")}</ul>
        ${o.allergies&&o.allergies.length?`<div class="obs">Alergia: ${o.allergies.map(esc).join(", ")}</div>`:''}
        ${o.obs?`<div class="muted">Obs.: ${esc(o.obs)}</div>`:''}
        <div class="row" style="justify-content:space-between"><span class="state ${s}">${stateLabel(s)}</span>${next[s]?`<button type="button" class="btn small" data-adv="${o.id}" data-st="${st}" data-to="${next[s][0]}">${next[s][1]}</button>`:'<span class="muted">Esperando a sala</span>'}</div>
      </article>`; }).join("")}</div>`:`<div class="card"><p>No hay notas de pedido pendientes. ${done?`Ya habéis servido ${done}.`:'Cuando sala envíe una comanda aparecerá aquí.'}</p></div>`}`;
}

/* ---------- Caja (facturación y cobro) ---------- */
function startPay(mesa){
  const orders = openOrders(mesa); if(!orders.length) return;
  pay = {mesa, total:mesaTotal(mesa), tipo:"simplificada", cliente:{nombre:"",nif:"",dir:""}, checked:false, pagos:[], method:null, cashGiven:0, cashAmt:"", changeIn:"", changeOk:null, pos:null, partes:1, forceDeny:false};
}
const paid = () => r2(pay.pagos.reduce((s,p)=>s+p.importe,0));
const left = () => r2(pay.total - paid());
function receipt(tk){
  const ivs = ivaSplit(tk.total);
  return `<div class="receipt" aria-label="Tique">
    <div style="text-align:center"><b>${esc(EMPRESA.nombre)}</b><br>NIF ${esc(EMPRESA.nif)}<br>${esc(EMPRESA.dir)}</div><hr>
    <div class="r"><span>${tk.tipo==="completa"?"FACTURA":"FACTURA SIMPLIFICADA"} Nº ${esc(tk.num)}</span></div>
    <div class="r"><span>${fmtDate(tk.fecha)} ${tk.hora}</span><span>${esc(tk.mesa)}</span></div>
    ${tk.tipo==="completa"?`<hr><div>Cliente: ${esc(tk.cliente.nombre)}<br>NIF: ${esc(tk.cliente.nif)}<br>${esc(tk.cliente.dir)}</div>`:''}<hr>
    ${tk.lines.map(l=>`<div class="r"><span>${l.q} ${esc(l.n)}</span><span>${eur(l.imp)}</span></div>`).join("")}<hr>
    <div class="r"><span>Base imponible</span><span>${eur(ivs.base)}</span></div>
    <div class="r"><span>IVA 10 %</span><span>${eur(ivs.iva)}</span></div>
    <div class="r"><b>TOTAL</b><b>${eur(ivs.total)}</b></div>
    ${tk.pagos?`<hr>${tk.pagos.map(p=>`<div class="r"><span>${p.medio==="efectivo"?"Efectivo":"Tarjeta"}</span><span>${eur(p.importe)}</span></div>${p.medio==="efectivo"?`<div class="r"><span>&nbsp;Entregado / Cambio</span><span>${eur(p.entregado)} / ${eur(p.cambio)}</span></div>`:`<div class="r"><span>&nbsp;Tarjeta **** ${p.last4} · Aut. ${p.aut}</span></div>`}`).join("")}`:''}
    <hr><div style="text-align:center">Gracias por su visita</div></div>`;
}
function vCaja(){
  if(pay && !openOrders(pay.mesa).length){ pay=null; setTimeout(()=>toast("Esta cuenta ya se ha cobrado en otro dispositivo. La mesa está libre."),0); }
  if(!pay){
    const busy = MESAS.filter(m=>openOrders(m).length);
    return `<div><div class="eyebrow">Fase C · Caja</div><h2>Facturación y cobro</h2></div>
      ${busy.length?`<p>Elegid la mesa que pide la cuenta.</p><div class="tables">${busy.map(m=>{ const o=openOrders(m); const unserved=o.some(x=>Object.values(x.st).some(v=>v!=="servido"));
        return `<button type="button" class="table-btn busy" data-paymesa="${m}"><b>${m}</b><small>${eur(mesaTotal(m))}${unserved?' · sin servir todo':''}</small></button>`; }).join("")}</div>`
      :`<div class="card"><p>No hay ninguna cuenta abierta.</p></div>`}
      ${S.tickets.length?`<h3>Tiques emitidos</h3><div class="table-wrap"><table><thead><tr><th>Nº</th><th>Hora</th><th>Mesa</th><th>Tipo</th><th>Pago</th><th>Total</th></tr></thead><tbody>${S.tickets.slice().reverse().map(t=>`<tr><td>${esc(t.num)}</td><td>${t.hora}</td><td>${esc(t.mesa)}</td><td>${t.tipo==="completa"?"Completa":"Simplificada"}</td><td>${[...new Set(t.pagos.map(p=>p.medio==="efectivo"?"Efectivo":"Tarjeta"))].join(" + ")}</td><td class="num">${eur(t.total)}</td></tr>`).join("")}</tbody></table></div>`:''}`;
  }
  const preview = {num:"(borrador)", fecha:today(), hora:hhmm(Date.now()), mesa:pay.mesa, tipo:pay.tipo, cliente:pay.cliente, lines:aggLines(openOrders(pay.mesa)), total:pay.total, pagos:pay.pagos.length?pay.pagos:null};
  const unserved = openOrders(pay.mesa).some(x=>Object.values(x.st).some(v=>v!=="servido"));
  let step;
  if(!pay.checked){
    step = `<div class="card stack"><h3>1. Tipo de documento</h3>
      <div class="chips">${[["simplificada","Factura simplificada (tique)"],["completa","Factura completa"]].map(([k,n])=>`<button type="button" class="chip" data-tipo="${k}" aria-pressed="${pay.tipo===k}">${n}</button>`).join("")}</div>
      ${pay.tipo==="completa"?`<p class="muted" style="font-size:.9rem">Usad datos ficticios del cliente, nunca datos reales.</p><div class="grid2"><label class="field"><span>Nombre o razón social</span><input type="text" id="cNombre" value="${esc(pay.cliente.nombre)}"></label><label class="field"><span>NIF</span><input type="text" id="cNif" value="${esc(pay.cliente.nif)}"></label></div><label class="field"><span>Domicilio</span><input type="text" id="cDir" value="${esc(pay.cliente.dir)}"></label>`:''}
      <h3>2. Revisad el tique con lo consumido</h3>
      ${unserved?`<div class="note bad">Ojo: esta mesa tiene productos que aún no constan como servidos.</div>`:''}
      <label class="check"><input type="checkbox" id="chkTicket"><span>He comprobado con el cliente que el tique coincide con lo que ha consumido.</span></label>
      <button type="button" class="btn" id="toPay">Pasar al cobro</button></div>`;
  } else if(left()>0){
    const parts = pay.partes>1 ? r2(pay.total/pay.partes) : null;
    let method = "";
    if(pay.method==="efectivo"){
      const amt = num(pay.cashAmt||left());
      method = `<div class="card stack"><h3>Cobro en efectivo</h3>
        <label class="field"><span>Importe que se cobra en efectivo</span><input type="text" inputmode="decimal" id="cashAmt" value="${esc(pay.cashAmt||String(left()).replace(".",","))}"></label>
        <div class="field"><span>El cliente entrega: <b>${eur(pay.cashGiven)}</b></span>
          <div class="money">${[50,20,10,5].map(v=>`<button type="button" class="bill" data-cash="${v}">${v} €</button>`).join("")}${[2,1,0.5,0.2,0.1,0.05].map(v=>`<button type="button" data-cash="${v}">${eur(v).replace(",00","")}</button>`).join("")}<button type="button" data-cash="0" data-clear="1">Borrar</button></div></div>
        <label class="field"><span>Cambio que vais a devolver (€)</span><input type="text" inputmode="decimal" id="changeIn" value="${esc(pay.changeIn)}" placeholder="Calculadlo vosotros"></label>
        ${pay.changeOk===false?`<div class="note bad">El cambio no es correcto. Restad: entregado ${eur(pay.cashGiven)} − importe ${isNaN(amt)?"?":eur(amt)}. Contadlo en voz alta.</div>`:''}
        <div class="row"><button type="button" class="btn" id="cashOk">Comprobar y cobrar</button><button type="button" class="btn ghost" data-method="">Cambiar medio de pago</button></div></div>`;
    } else if(pay.method==="tarjeta"){
      const amt = num(pay.cardAmt||left());
      const P = pay.pos||{stage:"idle"};
      let screen, keys="", acts="";
      if(P.stage==="idle"){ screen=`<span>IMPORTE</span><b>${eur(amt)}</b><span>Acerque o inserte tarjeta</span>`;
        acts=`<button type="button" data-pos="contactless">Acercar tarjeta (sin contacto)</button><button type="button" data-pos="chip">Insertar tarjeta</button>`; }
      else if(P.stage==="pin"){ screen=`<span>${eur(amt)}</span><b>PIN: ${"•".repeat(P.pin.length)}${"_".repeat(4-P.pin.length)}</b><span>${P.why||"Introduzca su PIN"}</span>`;
        keys=`<div class="keys">${[1,2,3,4,5,6,7,8,9].map(k=>`<button type="button" data-pin="${k}">${k}</button>`).join("")}<button type="button" class="ko" data-pin="C">Borrar</button><button type="button" data-pin="0">0</button><button type="button" class="ok" data-pin="OK">OK</button></div>`; }
      else if(P.stage==="ok"){ screen=`<b>ACEPTADA</b><span>Aut. ${P.aut} · **** ${P.last4}</span><span>Retire la tarjeta</span>`;
        acts=`<button type="button" data-pos="receipt">Entregar comprobante y registrar el pago</button>`; }
      else { screen=`<b>DENEGADA</b><span>Operación no autorizada</span>`;
        acts=`<button type="button" data-pos="retry">Probar con otra tarjeta</button><button type="button" data-method="efectivo">Ofrecer pago en efectivo</button>`; }
      method = `<div class="card stack"><h3>Cobro con tarjeta</h3>
        <label class="field"><span>Importe que se cobra con tarjeta</span><input type="text" inputmode="decimal" id="cardAmt" value="${esc(pay.cardAmt||String(left()).replace(".",","))}" ${P.stage!=="idle"?'disabled':''}></label>
        <div class="pos" role="group" aria-label="Datáfono de prácticas"><div class="screen">${screen}</div>${keys}<div class="actions">${acts}</div></div>
        <label class="check" style="max-width:420px"><input type="checkbox" id="forceDeny" ${pay.forceDeny?'checked':''}><span>Practicar tarjeta denegada: el datáfono rechazará el pago.</span></label>
        <button type="button" class="btn ghost" data-method="">Cambiar medio de pago</button></div>`;
    } else {
      method = `<div class="card stack"><h3>3. Medio de pago</h3>
        <div class="row"><button type="button" class="btn" data-method="efectivo">Efectivo</button><button type="button" class="btn" data-method="tarjeta">Tarjeta</button></div>
        <div class="field"><span>¿Pagan por separado?</span><div class="chips">${[1,2,3,4].map(n=>`<button type="button" class="chip" data-partes="${n}" aria-pressed="${pay.partes===n}">${n===1?"Todo junto":n+" personas"}</button>`).join("")}</div></div>
        ${parts?`<div class="note">Cada persona paga <b>${eur(parts)}</b>${r2(parts*pay.partes)!==pay.total?` (la última, ${eur(r2(pay.total-parts*(pay.partes-1)))}, por el redondeo)`:''}. Cobrad cada parte por separado con su medio de pago.</div>`:''}
        <p class="muted">Para un pago mixto, cobrad primero una parte en efectivo y el resto con tarjeta.</p></div>`;
    }
    step = `<div class="note"><b>Pendiente de cobro: ${eur(left())}</b>${pay.pagos.length?` · ya cobrado ${eur(paid())}`:''}</div>${method}`;
  } else {
    step = `<div class="note ok"><b>Cuenta cobrada.</b> Entregad el tique al cliente.</div><button type="button" class="btn" id="closeTicket">Cerrar la cuenta y emitir el tique</button>`;
  }
  return `<div><div class="eyebrow">Fase C · Caja</div><h2>Cuenta de ${esc(pay.mesa)} · ${eur(pay.total)}</h2></div>
    <div class="split"><div class="stack">${step}<button type="button" class="btn ghost" id="cancelPay" ${pay.pagos.length?'disabled':''}>Volver a la caja</button></div><div>${receipt(preview)}</div></div>`;
}

/* ---------- Cierre y arqueo ---------- */
function cashIn(){ return r2(S.tickets.reduce((s,t)=>s+t.pagos.filter(p=>p.medio==="efectivo").reduce((a,p)=>a+p.importe,0),0)); }
function cardIn(){ return r2(S.tickets.reduce((s,t)=>s+t.pagos.filter(p=>p.medio==="tarjeta").reduce((a,p)=>a+p.importe,0),0)); }
function vCierre(){
  const open = MESAS.filter(m=>openOrders(m).length);
  const esperado = r2(S.caja + cashIn());
  const A = S.arqueo;
  return `<div><div class="eyebrow">Fase D</div><h2>Postservicio, arqueo y cierre</h2></div>
    ${open.length?`<div class="note bad">Quedan cuentas abiertas: ${open.join(", ")}. Cobradlas antes de cerrar la caja.</div>`:''}
    <div class="card stack"><h3>Arqueo de caja</h3>
      <div class="kv"><span>Cambio inicial</span><b>${eur(S.caja)}</b><span>Cobrado en efectivo</span><b>${eur(cashIn())}</b><span>Cobrado con tarjeta (datáfono)</span><b>${eur(cardIn())}</b><span>Tiques emitidos</span><b>${S.tickets.length}</b><span>Total facturado</span><b>${eur(cashIn()+cardIn())}</b></div>
      <label class="field"><span>Efectivo que hay en la caja al contarlo (€)</span><input type="text" inputmode="decimal" id="contado" value="${A?String(A.contado).replace(".",","):""}" placeholder="Contad billetes y monedas"></label>
      <button type="button" class="btn" id="doArqueo">Hacer el arqueo</button>
      ${A?(A.diff===0?`<div class="note ok"><b>La caja cuadra.</b> Hay ${eur(A.contado)}, justo lo esperado (${eur(A.esperado)}).</div>`:`<div class="note bad"><b>Descuadre de ${eur(Math.abs(A.diff))}</b> ${A.diff>0?"de más":"de menos"}. Esperado ${eur(A.esperado)}, contado ${eur(A.contado)}. Revisad los cambios entregados y los tiques.</div>`):''}
    </div>
    <h3>Cierre del puesto</h3>${bar(S.d.length,FASE_D.length)}${checklist(FASE_D,S.d,"d")}
    <div class="next"><span></span><button type="button" class="btn" data-goto="resumen">Ver el resumen y cerrar el servicio</button></div>`;
}

/* ---------- Métricas y resumen ---------- */
function metrics(){
  const by = rot => {
    const os = S.orders.filter(o=>o.rot===rot), ts = S.tickets.filter(t=>t.rot===rot);
    const stTimes = st => { const v=os.filter(o=>o.tm[st]&&o.tm[st].listo).map(o=>(o.tm[st].listo-o.t)/60000); return v.length? Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10 : null; };
    return {com:os.length, ask:os.filter(o=>o.asked!=="no").length, risk:os.filter(o=>o.risky).length,
      nb:os.filter(o=>o.st.barra).length, nc:os.filter(o=>o.st.cocina).length, tb:stTimes("barra"), tc:stTimes("cocina"),
      tk:ts.length, fc:ts.filter(t=>t.tipo==="completa").length, ef:ts.reduce((s,t)=>s+t.pagos.filter(p=>p.medio==="efectivo").length,0), tj:ts.reduce((s,t)=>s+t.pagos.filter(p=>p.medio==="tarjeta").length,0),
      ce:(S.cashErrRot||{})[rot]||0};
  };
  const tA = FASE_A.reduce((n,g)=>n+g.items.length,0);
  return {rots:Array.from({length:S.nRot},(_,i)=>by(i+1)), a:[S.a.length,tA], d:[S.d.length,FASE_D.length], 
    arq: S.arqueo ? S.arqueo.diff : null, open: MESAS.filter(m=>openOrders(m).length).length, den:S.cardDenied};
}
function vResumen(){
  const m = metrics(), x = m.rots[0];
  return `<div><div class="eyebrow">Resumen</div><h2>${S.team?esc(S.team):"Resumen del servicio"}</h2></div>
    <div class="stats">
      <div class="stat"><span class="muted">Fase A · Preparar</span><b>${m.a[0]}/${m.a[1]}</b></div>
      <div class="stat"><span class="muted">Arqueo</span><b>${m.arq==null?"–":m.arq===0?"Cuadra":eur(m.arq)}</b></div>
      <div class="stat"><span class="muted">Fase D · Cierre</span><b>${m.d[0]}/${m.d[1]}</b></div>
    </div>
    <div class="card stack"><h3>Servicio</h3><p class="muted">${whoLine()}</p>
    <div class="kv"><span>Comandas tomadas</span><b>${x.com}</b><span>Preguntaron por alérgenos</span><b>${x.ask}/${x.com}</b><span>Notas de barra · tiempo medio</span><b>${x.nb} · ${x.tb!=null?x.tb+" min":"–"}</b><span>Notas de cocina · tiempo medio</span><b>${x.nc} · ${x.tc!=null?x.tc+" min":"–"}</b><span>Tiques emitidos (facturas completas)</span><b>${x.tk} (${x.fc})</b><span>Cobros en efectivo / tarjeta</span><b>${x.ef} / ${x.tj}</b><span>Errores al calcular el cambio</span><b>${x.ce}</b></div></div>
    <div class="row"><button type="button" class="btn" data-act="panel">Volver al panel docente</button></div>`;
}

/* ---------- Eventos del TPV ---------- */
/* ---------- Eventos del TPV ---------- */
function tpvClick(t){
  if(t.dataset.go!=null){ S.step=+t.dataset.go; render(); window.scrollTo({top:0}); return true; }
  // Cuestionario
  if(t.id==="testAsk"){ Q.confirm=true; render(); return true; }
  if(t.id==="testNo"){ Q.confirm=false; render(); return true; }
  if(t.id==="testSend"){ enviarTest(t); return true; }
  if(t.dataset.goto){ if(t.dataset.goto==="caja" && draft.mesa && openOrders(draft.mesa).length){ startPay(draft.mesa); } go(t.dataset.goto); return true; }
  // Sala
  if(t.dataset.mesa){ draft = blankDraft(t.dataset.mesa); render(); return true; }
  if(t.dataset.add){ draft.lines[t.dataset.add]=(draft.lines[t.dataset.add]||0)+1; render(); toast("Añadido: "+item(t.dataset.add).n); return true; }
  if(t.dataset.qty){ const id=t.dataset.qty; draft.lines[id]=Math.max(0,(draft.lines[id]||0)+ +t.dataset.d); render(); return true; }
  if(t.id==="toAllergens"){ draft.stage="ask"; render(); $("#orderBox").scrollIntoView({block:"nearest"}); return true; }
  if(t.dataset.ask){ draft.asked=t.dataset.ask; draft.allergies=[]; draft.stage = t.dataset.ask==="alergias" ? "which" : "result"; render(); return true; }
  if(t.dataset.allergy){ const a=t.dataset.allergy; draft.allergies = draft.allergies.includes(a)? draft.allergies.filter(x=>x!==a) : draft.allergies.concat(a); render(); return true; }
  if(t.id==="checkAllergy"){ draft.stage="result"; render(); return true; }
  if(t.id==="backToMenu"){ draft.stage="menu"; render(); return true; }
  if(t.id==="sendOrder"){
    const lines = Object.entries(draft.lines).filter(([,q])=>q>0).map(([pid,q])=>({pid,q,nota:(draft.notas[pid]||"").trim()}));
    const risky = lines.some(l=>item(l.pid).a.some(a=>draft.allergies.includes(a)));
    const st = {}, tm = {};
    lines.forEach(l=>{ const s=lineStation(l); st[s]="nuevo"; tm[s]={}; });
    const sent = draft; draft = blankDraft(draft.mesa);
    const btn = t; btn.disabled = true;
    nextCounter("nOrder").then(n=>{
    const id = uid();
    S.orders.push({id, n, mesa:sent.mesa, t:Date.now(), rot:S.rot, lines, obs:sent.obs.trim().slice(0,300), asked:sent.asked, allergies:sent.allergies, risky, st, tm, paid:false, por:yo()});
    share("order", id); const msg = Object.keys(st).map(s=>s==="barra"?"barra":"cocina").join(" y ");
    render(); toast("Comanda nº "+n+" enviada a "+msg);
    }).catch(()=>{ draft = sent; btn.disabled=false; toast("No se ha podido enviar. Revisa la conexión y vuelve a intentarlo."); });
    return true;
  }
  if(t.dataset.served){ const o=S.orders.find(x=>x.id===t.dataset.served); o.st[t.dataset.st]="servido"; o.tm[t.dataset.st].servido=Date.now(); share("order", o.id); render(); toast("Servido en "+o.mesa); return true; }
  // Barra / cocina
  if(t.dataset.adv){ const o=S.orders.find(x=>x.id===t.dataset.adv), st=t.dataset.st; o.st[st]=t.dataset.to; o.tm[st][t.dataset.to]=Date.now(); share("order", o.id); render(); return true; }
  // Caja
  if(t.dataset.paymesa){ startPay(t.dataset.paymesa); render(); return true; }
  if(t.id==="cancelPay"){ pay=null; render(); return true; }
  if(t.dataset.tipo){ pay.tipo=t.dataset.tipo; render(); return true; }
  if(t.id==="toPay"){
    if(!$("#chkTicket").checked){ toast("Comprobad primero el tique con el cliente."); return true; }
    if(pay.tipo==="completa" && (!pay.cliente.nombre.trim()||!pay.cliente.nif.trim()||!pay.cliente.dir.trim())){ toast("La factura completa necesita nombre, NIF y domicilio."); return true; }
    pay.checked=true; render(); return true;
  }
  if(t.dataset.partes){ pay.partes=+t.dataset.partes; render(); return true; }
  if(t.dataset.method!=null){ pay.method=t.dataset.method||null; pay.cashGiven=0; pay.changeIn=""; pay.changeOk=null; pay.cashAmt=""; pay.cardAmt=""; pay.pos=null; render(); return true; }
  if(t.dataset.cash!=null){ pay.cashGiven = t.dataset.clear ? 0 : r2(pay.cashGiven + +t.dataset.cash); pay.changeOk=null; render(); return true; }
  if(t.id==="cashOk"){
    const amt = num(pay.cashAmt||left()), ch = num(pay.changeIn);
    if(isNaN(amt)||amt<=0||amt>left()){ toast("Revisad el importe en efectivo: como mucho "+eur(left())+"."); return true; }
    if(pay.cashGiven<amt){ toast("El cliente aún no ha entregado suficiente."); return true; }
    if(isNaN(ch)){ toast("Escribid el cambio que vais a devolver."); return true; }
    const real = r2(pay.cashGiven-amt);
    if(ch!==real){ const rot=S.rot; bump("cashErr/"+rot, ()=>{ S.cashErrRot=S.cashErrRot||{}; S.cashErrRot[rot]=(S.cashErrRot[rot]||0)+1; }); pay.changeOk=false; render(); return true; }
    pay.pagos.push({medio:"efectivo", importe:amt, entregado:pay.cashGiven, cambio:real});
    pay.method=null; pay.cashGiven=0; pay.changeIn=""; pay.changeOk=null; pay.cashAmt="";
    render(); toast("Cambio correcto: "+eur(real)+". Contadlo en voz alta al entregarlo."); return true;
  }
  if(t.dataset.pos){
    const amt = num(pay.cardAmt||left());
    if(t.dataset.pos==="contactless"||t.dataset.pos==="chip"){
      if(isNaN(amt)||amt<=0||amt>left()){ toast("Revisad el importe con tarjeta: como mucho "+eur(left())+"."); return true; }
      pay.cardAmt = String(amt).replace(".",",");
      const needPin = t.dataset.pos==="chip" || amt>50;
      pay.pos = needPin ? {stage:"pin", pin:"", why: t.dataset.pos==="chip"?"Introduzca su PIN":"Importe superior a 50 €: introduzca su PIN"} : resolveCard();
      render(); return true;
    }
    if(t.dataset.pos==="retry"){ pay.pos={stage:"idle"}; pay.forceDeny=false; render(); return true; }
    if(t.dataset.pos==="receipt"){ pay.pagos.push({medio:"tarjeta", importe:amt, last4:pay.pos.last4, aut:pay.pos.aut}); pay.method=null; pay.pos=null; pay.cardAmt=""; render(); toast("Pago con tarjeta registrado."); return true; }
  }
  if(t.dataset.pin!=null){
    const P = pay.pos;
    if(t.dataset.pin==="C") P.pin="";
    else if(t.dataset.pin==="OK"){ if(P.pin.length<4){ P.why="El PIN tiene 4 cifras"; } else { pay.pos=resolveCard(); } }
    else if(P.pin.length<4) P.pin+=t.dataset.pin;
    render(); return true;
  }
  if(t.id==="closeTicket"){
    const P = pay;
    // Datos frescos: otro dispositivo puede haber cobrado ya esta mesa
    const orders = openOrders(P.mesa);
    if(!orders.length){ pay=null; render(); toast("Esta cuenta ya está cobrada. La mesa está libre."); return true; }
    const ids = orders.map(o=>o.id), lines = aggLines(orders);
    // Primero se marca la mesa como cobrada, para que nadie pueda cobrarla otra vez
    orders.forEach(o=>{ o.paid=true; share("order", o.id); });
    pay=null; t.disabled = true;
    nextCounter("nTicket").then(n=>{
      const tk = {id:uid(), num:`T${String(n).padStart(4,"0")}`, fecha:today(), hora:hhmm(Date.now()), mesa:P.mesa, tipo:P.tipo, cliente:{nombre:String(P.cliente.nombre||"").slice(0,80), nif:String(P.cliente.nif||"").slice(0,20), dir:String(P.cliente.dir||"").slice(0,120)}, lines, total:P.total, pagos:P.pagos, rot:S.rot, por:yo()};
      S.tickets.push(tk); share("ticket", tk.id);
      // Por si la sincronización ha sustituido las comandas mientras tanto
      S.orders.filter(o=>ids.includes(o.id) && !o.paid).forEach(o=>{ o.paid=true; share("order", o.id); });
      render(); toast("Tique "+tk.num+" emitido. Mesa libre.");
    }).catch(()=>{ S.orders.filter(o=>ids.includes(o.id)).forEach(o=>{ o.paid=false; share("order", o.id); }); pay=P; render(); toast("No se ha podido emitir el tique. Revisa la conexión y volved a intentarlo."); });
    render();
    return true;
  }
  // Cierre
  if(t.id==="doArqueo"){ const c=num($("#contado").value); if(isNaN(c)){ toast("Escribid el efectivo contado."); return true; } const e=r2(S.caja+cashIn()); S.arqueo={contado:c, esperado:e, diff:r2(c-e)}; share("arqueo"); render(); return true; }
  return false;
}
function resolveCard(){
  const deny = pay.forceDeny;
  if(deny){ bump("cardDenied", ()=>{ S.cardDenied=(S.cardDenied||0)+1; }); pay.forceDeny=false; return {stage:"ko"}; }
  return {stage:"ok", aut:String(Math.floor(100000+Math.random()*899999)), last4:String(Math.floor(1000+Math.random()*8999))};
}
function tpvChange(t){
  if(t.dataset && t.dataset.resp && !Q.enviado){ Q.resp[t.dataset.resp]=t.value; Q.confirm=false; render(); return true; }
  if(t.dataset && t.dataset.check){ const k=t.dataset.check; S[k] = t.checked ? S[k].concat(t.value) : S[k].filter(x=>x!==t.value); share(k); render(); return true; }
  if(t.id==="forceDeny"){ pay.forceDeny=t.checked; return true; }
  return false;
}
function tpvInput(t){
  if(t.dataset && t.dataset.nota){ draft.notas[t.dataset.nota]=t.value; return true; }
  if(t.id==="obs"){ draft.obs=t.value; return true; }
  if(t.id==="cNombre"){ pay.cliente.nombre=t.value; return true; }
  if(t.id==="cNif"){ pay.cliente.nif=t.value; return true; }
  if(t.id==="cDir"){ pay.cliente.dir=t.value; return true; }
  if(t.id==="cashAmt"){ pay.cashAmt=t.value; return true; }
  if(t.id==="changeIn"){ pay.changeIn=t.value; return true; }
  if(t.id==="cardAmt"){ pay.cardAmt=t.value; return true; }
  return false;
}

/* ---------- Cuestionario (alumno) ---------- */
const Q = {qid:null, doc:null, enviado:null, resp:{}, confirm:false, unsub:null};
function quizVisible(){ return !esDocente() && !!(Q.doc && Q.doc.activo); }
function escucharCuestionarioAlumno(){
  const qid = SV && SV.cuestionario;
  if(qid===Q.qid) return;
  if(Q.unsub){ Q.unsub(); Q.unsub=null; }
  Q.qid = qid; Q.doc = null; Q.enviado = null; Q.resp = {}; Q.confirm=false;
  if(!qid) return;
  db.doc(`respuestas/${qid}_${yo()}`).get().then(d=>{ Q.enviado = d.exists; repaint(); }).catch(()=>{ Q.enviado = false; repaint(); });
  let un = db.doc("cuestionarios/"+qid).onSnapshot(d=>{ Q.doc = d.exists ? d.data() : null; repaint(); }, ()=>{
    // Inactivo: el alumno no puede leerlo. Se vuelve a mirar de vez en cuando por si el docente lo activa.
    Q.doc = null; repaint();
    const t = setTimeout(()=>{ if(Q.qid===qid){ Q.qid=null; escucharCuestionarioAlumno(); } }, 10000);
    Q.unsub = ()=>clearTimeout(t);
  });
  Q.unsub = un; subSv.push(()=>{ if(Q.unsub) Q.unsub(); Q.unsub=null; Q.qid=null; });
}
function opcionesAlumno(p){ return seeded(p.ops, yo()+"|"+p.id); }
function vTest(){
  if(!Q.doc) return `<div class="card"><p>No hay ningún cuestionario activo.</p></div>`;
  if(Q.enviado===null) return `<p class="muted">Cargando…</p>`;
  if(Q.enviado) return `<div><div class="eyebrow">Cuestionario</div><h2>Cuestionario enviado</h2></div><div class="note ok">Ya has enviado tus respuestas. El docente te comunicará la nota en clase.</div>`;
  const ps = Q.doc.preguntas||[], hechas = ps.filter(p=>Q.resp[p.id]!=null).length;
  return `<div><div class="eyebrow">Cuestionario</div><h2>Cuestionario de evaluación</h2></div>
    <p>Responde las ${ps.length} preguntas. Cada una tiene una sola respuesta correcta. Solo puedes enviarlo una vez.</p>${bar(hechas, ps.length)}
    ${ps.map((p,i)=>`<fieldset class="card stack" style="margin:0"><legend class="muted" style="padding:0 6px">Pregunta ${i+1}</legend><p style="margin:0"><b>${esc(p.t)}</b></p>
      <div class="stack" style="gap:6px">${opcionesAlumno(p).map(o=>`<label class="check"><input type="radio" name="q_${esc(p.id)}" data-resp="${esc(p.id)}" value="${esc(o)}" ${Q.resp[p.id]===o?"checked":""}><span>${esc(o)}</span></label>`).join("")}</div></fieldset>`).join("")}
    <div id="testBox" class="confirm-row">${Q.confirm
      ? `<span>${hechas<ps.length?`Te faltan ${ps.length-hechas} preguntas por responder. `:""}¿Envías tus respuestas? Después no se pueden cambiar.</span><button type="button" class="btn" id="testSend">Sí, enviar</button><button type="button" class="btn ghost" id="testNo">No</button>`
      : `<button type="button" class="btn" id="testAsk">Enviar el cuestionario</button>`}</div>`;
}
async function enviarTest(btn){
  btn.disabled = true;
  try{
    await db.doc(`respuestas/${Q.qid}_${yo()}`).set({uid:yo(), qid:Q.qid, servicio:SID, resp:Q.resp, enviadoEn:FV.serverTimestamp()});
    Q.enviado = true; Q.confirm=false; render(); toast("Cuestionario enviado.");
  }catch(e){ btn.disabled=false; toast("No se ha podido enviar. Revisa la conexión y vuelve a intentarlo."); }
}

/* =========================================================
   Panel docente: servicio, cuestionario, evaluación y resultados
   ========================================================= */
const nivel = v => { if(v==null||isNaN(v)) return ""; const n = NIVELES.find(([,a,b])=>v>=a && v<=b+0.0001); return n?n[0]:""; };
const levelClass = v => ({"En proceso":"l1","Adecuado":"l2","Avanzado":"l2","Excelente":"l3"})[nivel(v)]||"";
const T = {tab:"servicio", alumnos:[], preguntas:[], evals:[], servicios:[], sel:[], form:{team:"", caja:"100", asig:{}}, editAsig:null, confirm:null,
  quiz:null, clave:null, resps:[], quizUnsubs:[], evalSid:null, evalData:null, draft:null, filter:""};
function arrancarDocente(){
  subs.push(db.collection("usuarios").where("rol","==","alumno").onSnapshot(s=>{ T.alumnos = s.docs.map(d=>Object.assign({uid:d.id}, d.data())).filter(a=>a.activo).sort((a,b)=>a.nombre.localeCompare(b.nombre)); repaint(); }, e=>console.warn(e)));
  subs.push(db.collection("preguntas").onSnapshot(s=>{ T.preguntas = s.docs.map(d=>Object.assign({id:d.id}, d.data())).sort((a,b)=>a.n-b.n); repaint(); }, e=>console.warn(e)));
  subs.push(db.collection("evaluaciones").onSnapshot(s=>{ T.evals = s.docs.map(d=>Object.assign({id:d.id}, d.data())); repaint(); }, e=>console.warn(e)));
  subs.push(db.collection("servicios").orderBy("creadoEn","desc").limit(60).onSnapshot(s=>{ T.servicios = s.docs.map(d=>Object.assign({id:d.id}, d.data())); repaint(); }, e=>console.warn(e)));
}
const nombreAlumno = a => `${a.nombre}${a.inicial?` ${a.inicial}.`:""}`;
function vDocente(){
  const tabs = [["servicio","Servicio"],["cuestionario","Cuestionario"],["evaluar","Evaluar"],["resultados","Resultados"]];
  const body = {servicio:tServicio, cuestionario:tCuestionario, evaluar:tEvaluar, resultados:tResultados}[T.tab]();
  return `<div class="stack"><div><div class="eyebrow">Panel docente</div><h2>${tabs.find(t=>t[0]===T.tab)[1]}</h2></div>
    <div class="tabs" role="tablist">${tabs.map(([k,n])=>`<button type="button" class="chip" role="tab" data-ttab="${k}" aria-pressed="${T.tab===k}">${n}</button>`).join("")}</div>${body}</div>`;
}

/* --- Servicio --- */
function asigUI(asig){
  if(!T.alumnos.length) return `<div class="note">No hay alumnos activos. El Administrador tiene que crear y activar sus cuentas.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Alumno/a</th><th>Puesto en este servicio</th></tr></thead><tbody>${T.alumnos.map(a=>`<tr><td>${esc(nombreAlumno(a))}</td><td><select data-asig="${esc(a.uid)}"><option value="">No participa</option>${["sala","barra","cocina"].map(k=>`<option value="${k}" ${asig[a.uid]===k?"selected":""}>${ROLES[k]}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`;
}
function puestosDe(asig){
  const puestos = {sala:[], barra:[], cocina:[]}, nombres = {};
  Object.entries(asig).forEach(([uid,k])=>{ if(!puestos[k]) return; const a=T.alumnos.find(x=>x.uid===uid) || {nombre:(SV&&SV.nombres&&SV.nombres[uid])||"?", inicial:""}; puestos[k].push(uid); nombres[uid]=a.uid?nombreAlumno(a):a.nombre; });
  return {puestos, nombres, miembros:[...puestos.sala, ...puestos.barra, ...puestos.cocina]};
}
function tServicio(){
  if(SV && SV.estado==="abierto"){
    const ed = T.editAsig;
    return `<div class="card stack"><div class="row" style="justify-content:space-between"><h3>${esc(SV.team||"Servicio")} · ${fmtDate(SV.fecha)}</h3><span class="pill l3">Abierto</span></div>
      <div class="kv">${["sala","barra","cocina"].map(k=>`<span>${ROLES[k]}</span><b>${((SV.puestos||{})[k]||[]).map(u=>esc(nombreDe(u))).join(", ")||"—"}</b>`).join("")}<span>Cambio inicial en caja</span><b>${eur(SV.caja)}</b><span>Comandas · tiques</span><b>${S.orders.length} · ${S.tickets.length}</b></div>
      <p class="muted">Cada alumno entra con su usuario en su dispositivo y la app le muestra solo las pantallas de su puesto.</p>
      <div class="row"><button type="button" class="btn" data-act="vertpv">Ver el TPV</button><button type="button" class="btn ghost" id="editAsig">${ed?"Cancelar cambios":"Cambiar alumnos de puesto"}</button></div>
      ${ed?`${asigUI(ed)}<div class="row"><button type="button" class="btn" id="saveAsig">Guardar los puestos</button></div>`:""}
    </div>
    <div class="card stack" id="closeBox"><h3>Cerrar el servicio</h3><p class="muted">Al cerrarlo, los alumnos ya no pueden hacer cambios y podrás evaluarlo. El cuestionario sigue disponible si está activo.</p>
      ${T.confirm==="close"?`<div class="confirm-row"><span>¿Cerrar el servicio? No se puede volver a abrir.</span><button type="button" class="btn danger" id="closeYes">Sí, cerrar</button><button type="button" class="btn ghost" id="closeNo">No</button></div>`:`<div class="row"><button type="button" class="btn danger" id="closeAsk">Cerrar el servicio</button></div>`}</div>`;
  }
  const F = T.form;
  const ultimo = SV && SV.estado==="cerrado" ? `<div class="note">Último servicio: <b>${esc(SV.team||"Servicio")} · ${fmtDate(SV.fecha)}</b>, cerrado. Puedes evaluarlo en la pestaña Evaluar.</div>` : "";
  return `${ultimo}<div class="card stack"><div><div class="eyebrow">Antes de empezar</div><h3>Abrir un servicio nuevo</h3></div>
    <p>Indica qué alumno está en sala, barra y cocina en este servicio. Cada servicio puede tener alumnos distintos.</p>
    <label class="field"><span>Nombre del servicio (opcional)</span><input type="text" id="fTeam" maxlength="60" value="${esc(F.team)}" placeholder="Ej.: Servicio 1 · mañana"></label>
    <label class="field"><span>Cambio inicial en caja (€)</span><input type="text" inputmode="decimal" id="fCaja" value="${esc(F.caja)}"></label>
    ${asigUI(F.asig)}
    <div class="row"><button type="button" class="btn" id="openService">Abrir el servicio</button></div></div>`;
}
async function abrirServicio(btn){
  const F = T.form, caja = num(F.caja);
  if(isNaN(caja)||caja<0){ toast("Escribe el cambio inicial en euros, por ejemplo 100."); return; }
  const {puestos, nombres, miembros} = puestosDe(F.asig);
  if(!puestos.sala.length||!puestos.barra.length||!puestos.cocina.length){ toast("Asigna al menos un alumno a sala, otro a barra y otro a cocina."); return; }
  btn.disabled = true;
  try{
    const ref = db.collection("servicios").doc();
    await ref.set({estado:"abierto", team:F.team.trim().slice(0,60), fecha:today(), caja, puestos, miembros, nombres, a:[], d:[], arqueo:null,
      nOrder:0, nTicket:0, cashErr:0, cardDenied:0, cuestionario:null, m:null, creadoEn:FV.serverTimestamp(), cerradoEn:null});
    await db.doc("config/actual").set({servicio:ref.id});
    T.form = {team:"", caja:"100", asig:{}}; S.step=0; toast("Servicio abierto");
  }catch(e){ btn.disabled=false; fallo(e); }
}
async function guardarAsig(){
  const {puestos, nombres, miembros} = puestosDe(T.editAsig);
  if(!puestos.sala.length||!puestos.barra.length||!puestos.cocina.length){ toast("Tiene que haber al menos un alumno en sala, barra y cocina."); return; }
  try{ await db.doc("servicios/"+SID).update({puestos, nombres, miembros}); T.editAsig=null; render(); toast("Puestos guardados"); }catch(e){ fallo(e); }
}
async function cerrarServicio(){
  try{ await db.doc("servicios/"+SID).update({estado:"cerrado", m:clean(metrics()), cerradoEn:FV.serverTimestamp()}); T.confirm=null; toast("Servicio cerrado"); }catch(e){ fallo(e); }
}

/* --- Cuestionario --- */
function escucharQuizDocente(){
  const qid = SV && SV.cuestionario;
  if(T.quizQid===qid) return;
  parar(T.quizUnsubs); T.quizQid=qid; T.quiz=null; T.clave=null; T.resps=[];
  if(!qid) return;
  T.quizUnsubs.push(db.doc("cuestionarios/"+qid).onSnapshot(d=>{ T.quiz = d.exists?Object.assign({id:d.id},d.data()):null; repaint(); }, e=>console.warn(e)));
  T.quizUnsubs.push(db.doc(`cuestionarios/${qid}/privado/clave`).onSnapshot(d=>{ T.clave = d.exists?d.data().ok:null; repaint(); }, e=>console.warn(e)));
  T.quizUnsubs.push(db.collection("respuestas").where("qid","==",qid).onSnapshot(s=>{ T.resps = s.docs.map(d=>d.data()); repaint(); }, e=>console.warn(e)));
}
const aciertos = (r, clave) => !r||!clave ? null : Object.entries(clave).filter(([pid,ok])=>r.resp && r.resp[pid]===ok).length;
function cuentaSel(){ const c={mf:0,f:0,i:0,d:0}; T.sel.forEach(id=>{ const p=T.preguntas.find(x=>x.id===id); if(p) c[p.dif]++; }); return c; }
const repartoOk = () => { const c=cuentaSel(); return Object.keys(REPARTO).every(k=>c[k]===REPARTO[k]); };
function tCuestionario(){
  if(!SV) return `<div class="card"><p>Primero abre un servicio en la pestaña Servicio.</p></div>`;
  escucharQuizDocente();
  const cab = `<p class="muted">Servicio: <b>${esc(SV.team||"Servicio")} · ${fmtDate(SV.fecha)}</b> (${SV.estado==="abierto"?"abierto":"cerrado"}).</p>`;
  if(SV.cuestionario){
    if(!T.quiz) return cab+`<p class="muted">Cargando el cuestionario…</p>`;
    const filas = (SV.miembros||[]).map(uid=>{ const r=T.resps.find(x=>x.uid===uid), a=aciertos(r,T.clave); return `<tr><td>${esc(nombreDe(uid))}</td><td>${r?"Enviado":"Pendiente"}</td><td class="num">${a==null?"—":a+"/10"}</td></tr>`; }).join("");
    return cab+`<div class="card stack"><div class="row" style="justify-content:space-between"><h3>Cuestionario de este servicio</h3><span class="pill ${T.quiz.activo?"l3":"l1"}">${T.quiz.activo?"Activo":"Desactivado"}</span></div>
      <p class="muted">${T.quiz.activo?"El alumnado del servicio ya puede responderlo desde su usuario.":"El alumnado no lo ve. Actívalo cuando quieras que lo respondan."}</p>
      <div class="row"><button type="button" class="btn ${T.quiz.activo?"ghost":""}" id="quizToggle">${T.quiz.activo?"Desactivar":"Activar"}</button><button type="button" class="btn ghost" id="quizPdfBlank">PDF en blanco</button><button type="button" class="btn ghost" id="quizPdfAll" ${T.resps.length?"":"disabled"}>PDF corregido</button></div>
      <div class="table-wrap"><table><thead><tr><th>Alumno/a</th><th>Estado</th><th>Aciertos</th></tr></thead><tbody>${filas}</tbody></table></div>
      <details><summary class="muted">Ver las 10 preguntas</summary><ol>${T.quiz.preguntas.map(p=>`<li><b>${esc(p.t)}</b> <span class="muted">(${DIFICULTADES[p.dif]||""})</span>${T.clave?`<br><span class="muted">Correcta: ${esc(T.clave[p.id]||"")}</span>`:""}</li>`).join("")}</ol></details>
      ${T.resps.length?"":`<div class="row"><button type="button" class="btn ghost" id="quizRedo">Elegir otras preguntas</button></div>`}</div>`;
  }
  if(!T.preguntas.length) return cab+`<div class="note bad">Todavía no hay batería de preguntas. El Administrador tiene que cargarla.</div>`;
  const c = cuentaSel();
  return cab+`<div class="card stack"><h3>Elige 10 preguntas</h3>
    <p>Elige ${REPARTO.mf} muy fáciles, ${REPARTO.f} fáciles, ${REPARTO.i} intermedia y ${REPARTO.d} difícil. Así el test no es siempre el mismo.</p>
    <div class="row"><button type="button" class="btn ghost" id="quizRandom">Elegir al azar</button><button type="button" class="btn ghost" id="quizClear">Quitar todas</button></div>
    ${Object.entries(DIFICULTADES).map(([k,n])=>`<div class="stack" style="gap:6px"><h3>${n} <span class="pill ${c[k]===REPARTO[k]?"l3":"l1"}">${c[k]} de ${REPARTO[k]}</span></h3>
      ${T.preguntas.filter(p=>p.dif===k).map(p=>`<label class="check"><input type="checkbox" data-qsel="${esc(p.id)}" ${T.sel.includes(p.id)?"checked":""}><span>${esc(p.t)} <span class="muted">· ${esc(p.tema)}</span></span></label>`).join("")}</div>`).join("")}
    <div class="row"><button type="button" class="btn" id="quizSave" ${repartoOk()?"":"disabled"}>Guardar y activar el cuestionario</button></div>
    ${repartoOk()?"":`<p class="muted">El botón se activa cuando la selección cumple el reparto 5-3-1-1.</p>`}</div>`;
}
function quizAzar(){ const out=[]; Object.entries(REPARTO).forEach(([k,n])=>out.push(...shuffle(T.preguntas.filter(p=>p.dif===k)).slice(0,n).map(p=>p.id))); T.sel=out; }
async function guardarQuiz(btn){
  if(!repartoOk()) return;
  btn.disabled = true;
  const orden = {mf:0,f:1,i:2,d:3};
  const sel = T.sel.map(id=>T.preguntas.find(p=>p.id===id)).filter(Boolean).sort((a,b)=>orden[a.dif]-orden[b.dif]||a.n-b.n);
  try{
    const q = db.collection("cuestionarios").doc(), b = db.batch();
    b.set(q, {servicio:SID, preguntas:sel.map(p=>({id:p.id, n:p.n, dif:p.dif, tema:p.tema, t:p.t, ops:shuffle([p.ok, ...p.otras])})), activo:true, creadoEn:FV.serverTimestamp()});
    b.set(q.collection("privado").doc("clave"), {ok:Object.fromEntries(sel.map(p=>[p.id, p.ok]))});
    b.update(db.doc("servicios/"+SID), {cuestionario:q.id});
    await b.commit(); T.sel=[]; toast("Cuestionario guardado y activado");
  }catch(e){ btn.disabled=false; fallo(e); }
}

/* --- Evaluar --- */
async function cargarEval(sid){
  T.evalSid = sid; T.evalData = null; T.draft = null; render();
  if(!sid) return;
  try{
    const sv = T.servicios.find(s=>s.id===sid) || (await db.doc("servicios/"+sid).get()).data();
    let clave = null, resps = [];
    if(sv.cuestionario){
      const [k, r] = await Promise.all([db.doc(`cuestionarios/${sv.cuestionario}/privado/clave`).get(), db.collection("respuestas").where("qid","==",sv.cuestionario).get()]);
      clave = k.exists ? k.data().ok : null; resps = r.docs.map(d=>d.data());
    }
    const prev = T.evals.find(e=>e.id===sid);
    const alumnos = (sv.miembros||[]).map(uid=>{
      const old = prev && (prev.alumnos||[]).find(x=>x.uid===uid);
      const r = resps.find(x=>x.uid===uid), a = aciertos(r, clave);
      return {uid, nombre:(sv.nombres||{})[uid]||"?", puesto:puestoDe(uid, sv).map(k=>ROLES[k]).join(", "), notas:old?Object.assign({},old.notas):{}, obs:old?old.obs||"":"", aciertos:a, quiz:a==null?0:a, hecho:!!r};
    });
    if(T.evalSid!==sid) return;
    T.evalData = {sid, sv, hayQuiz:!!sv.cuestionario}; T.draft = {alumnos}; render();
  }catch(e){ fallo(e); }
}
const notaRubrica = A => { const v=CRITERIOS.map(c=>A.notas[c.k]).filter(x=>x!=null&&!isNaN(x)); return v.length===4 ? r1(v.reduce((a,b)=>a+b,0)/4) : null; };
const notaFinal = A => { const r=notaRubrica(A); return r==null ? null : r1(0.6*r + 0.4*(A.quiz||0)); };
function tEvaluar(){
  const opts = T.servicios.map(s=>`<option value="${esc(s.id)}" ${T.evalSid===s.id?"selected":""}>${esc((s.team||"Servicio")+" · "+fmtDate(s.fecha))}${s.estado==="abierto"?" (abierto)":""}${T.evals.some(e=>e.id===s.id)?" · evaluado":""}</option>`).join("");
  const sel = `<label class="field"><span>Servicio que vas a evaluar</span><select id="evalSel"><option value="">Elige un servicio</option>${opts}</select></label>`;
  if(!T.evalSid) return `<div class="card stack">${sel}</div>`;
  if(!T.evalData) return `<div class="card stack">${sel}<p class="muted">Cargando…</p></div>`;
  const D = T.draft, sv = T.evalData.sv, m = sv.m;
  return `<div class="card stack">${sel}
    ${sv.estado==="abierto"?`<div class="note">Este servicio sigue abierto. Puedes evaluarlo, pero conviene cerrarlo antes.</div>`:""}
    ${m?`<p class="muted">Fase A ${m.a[0]}/${m.a[1]} · Arqueo ${m.arq==null?"sin hacer":m.arq===0?"cuadra":eur(m.arq)} · Fase D ${m.d[0]}/${m.d[1]} · ${m.rots[0].com} comandas · ${m.rots[0].tk} tiques</p>`:""}
    <p class="muted">Nota final = 60 % rúbrica + 40 % cuestionario. ${T.evalData.hayQuiz?"La nota del cuestionario se calcula sola.":"Este servicio no tiene cuestionario: cuenta como 0."}</p></div>
    ${D.alumnos.map((A,i)=>{ const rub=notaRubrica(A), fin=notaFinal(A);
      return `<div class="card stack">
        <div class="row" style="justify-content:space-between"><h3>${esc(A.nombre)} <span class="muted" style="font-weight:400;font-size:1rem">· ${esc(A.puesto)}</span></h3>
          <span class="pill ${levelClass(fin)}" data-fin="${i}">${fin!=null?`Final ${coma(fin)} · ${nivel(fin)}`:"Final —"}</span></div>
        <p class="muted" data-rq="${i}">Rúbrica: ${rub!=null?coma(rub):"—"} · Cuestionario: ${A.hecho?`${A.aciertos}/10`:"no realizado (0)"}</p>
        <div class="grid2">${CRITERIOS.map(c=>{ const v=A.notas[c.k];
          return `<label class="field"><span>${c.n}</span><div class="row" style="flex-wrap:nowrap"><input type="text" inputmode="decimal" data-enota="${i}" data-c="${c.k}" value="${v==null?"":coma(v)}" placeholder="1 a 10" style="width:6.5em"><span class="pill ${levelClass(v)}">${nivel(v)||"—"}</span></div></label>`; }).join("")}</div>
        <details><summary class="muted">Ver los descriptores de la rúbrica</summary>${CRITERIOS.map(c=>`<p style="margin-top:8px"><b>${c.n}</b></p><ul style="margin:0;padding-left:1.1em;font-size:.9rem">${c.d.map((d,j)=>`<li><b>${NIVELES[j][0]} (${coma(NIVELES[j][1])}–${coma(NIVELES[j][2])}):</b> ${esc(d)}</li>`).join("")}</ul>`).join("")}</details>
        <label class="field"><span>Observaciones (sin datos personales)</span><textarea data-eobs="${i}" rows="2" style="min-height:0" maxlength="500">${esc(A.obs)}</textarea></label></div>`; }).join("")}
    <div class="row"><button type="button" class="btn" id="saveEval">Guardar la evaluación</button></div>`;
}
async function guardarEval(btn){
  const D = T.draft, sv = T.evalData.sv;
  const bad = D.alumnos.find(A=>CRITERIOS.some(c=>{ const v=A.notas[c.k]; return v==null||isNaN(v)||v<1||v>10; }));
  if(bad){ toast("Falta alguna nota (de 1 a 10) de "+bad.nombre+"."); return; }
  btn.disabled = true;
  try{
    await db.doc("evaluaciones/"+T.evalSid).set({servicio:T.evalSid, team:sv.team||"", fecha:sv.fecha, cuestionario:sv.cuestionario||null, m:sv.m||null, guardadoEn:FV.serverTimestamp(),
      alumnos:D.alumnos.map(A=>({uid:A.uid, nombre:A.nombre, puesto:A.puesto, notas:A.notas, rubrica:notaRubrica(A), quiz:A.quiz, aciertos:A.aciertos, hecho:A.hecho, final:notaFinal(A), obs:A.obs||""}))});
    toast("Evaluación guardada"); T.tab="resultados"; render();
  }catch(e){ btn.disabled=false; fallo(e); }
}

/* --- Resultados y exportación --- */
function flatRows(){
  const out = [];
  T.evals.filter(e=>!T.filter||e.id===T.filter).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).forEach(e=>(e.alumnos||[]).forEach(A=>out.push({sid:e.id, fecha:e.fecha, sesion:e.team||"Servicio", alumno:A.nombre, puestos:A.puesto, notas:A.notas||{}, rubrica:A.rubrica, quiz:A.quiz, aciertos:A.aciertos, hecho:A.hecho, final:A.final, obs:A.obs})));
  return out;
}
function tResultados(){
  const rows = flatRows();
  return `<div class="stack">
    <div class="grid2"><label class="field"><span>Ver resultados de</span><select id="filter"><option value="">Todos los servicios</option>${T.evals.map(e=>`<option value="${esc(e.id)}" ${T.filter===e.id?"selected":""}>${esc((e.team||"Servicio")+" · "+fmtDate(e.fecha))}</option>`).join("")}</select></label></div>
    <div class="row"><button type="button" class="btn" id="expXlsx" ${rows.length?"":"disabled"}>Exportar a Excel</button><button type="button" class="btn ghost" id="expPdf" ${rows.length?"":"disabled"}>Exportar a PDF</button></div>
    ${rows.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Alumno/a</th><th>Puesto</th>${CRITERIOS.map((c,i)=>`<th title="${esc(c.n)}">C${i+1}</th>`).join("")}<th>Rúbrica</th><th>Cuestionario</th><th>Final</th><th>Nivel</th><th>Observaciones</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${fmtDate(r.fecha)}</td><td>${esc(r.alumno)}</td><td>${esc(r.puestos)}</td>${CRITERIOS.map(c=>`<td class="num">${coma(r.notas[c.k])}</td>`).join("")}<td class="num">${coma(r.rubrica)}</td><td class="num">${coma(r.quiz)}</td><td class="num"><b>${coma(r.final)}</b></td><td><span class="pill ${levelClass(r.final)}">${nivel(r.final)}</span></td><td>${esc(r.obs)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="muted" style="font-size:.85rem">${CRITERIOS.map((c,i)=>`C${i+1}: ${c.n}`).join(" · ")} · Nota final = 60 % rúbrica + 40 % cuestionario</p>`
    :`<div class="card"><p>Aún no hay evaluaciones guardadas. Evalúa un servicio en la pestaña <b>Evaluar</b>.</p></div>`}
  </div>`;
}
function exportRows(){
  return flatRows().map(r=>({"Fecha":fmtDate(r.fecha), "Servicio":r.sesion, "Alumno/a":r.alumno, "Puesto":r.puestos,
    ...Object.fromEntries(CRITERIOS.map(c=>[c.n, r.notas[c.k]])), "Nota rúbrica":r.rubrica, "Nota cuestionario":r.quiz, "Aciertos cuestionario":r.hecho?`${r.aciertos}/10`:"No realizado",
    "Nota final":r.final, "Nivel":nivel(r.final), "Observaciones":r.obs||""}));
}
function descargar(filename, blob){ const u=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=u; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u), 4000); }
const fileBase = () => "TPV_BETA_V1_evaluacion_" + today();
function exportXlsx(){
  const ws = XLSX.utils.json_to_sheet(exportRows());
  ws["!cols"] = [{wch:11},{wch:22},{wch:24},{wch:16},{wch:14},{wch:14},{wch:14},{wch:14},{wch:12},{wch:14},{wch:14},{wch:10},{wch:12},{wch:50}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Evaluación");
  const leyenda = XLSX.utils.aoa_to_sheet([["Criterio", ...NIVELES.map(([n,a,b])=>`${n} (${a}-${b})`)], ...CRITERIOS.map(c=>[c.n,...c.d]), [], ["Nota final = 60 % rúbrica + 40 % cuestionario"]]);
  XLSX.utils.book_append_sheet(wb, leyenda, "Rúbrica");
  descargar(fileBase()+".xlsx", new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})]));
}
function pdfNuevo(orient){ return new window.jspdf.jsPDF({orientation:orient, unit:"mm", format:"a4"}); }
function exportPdf(){
  const doc = pdfNuevo("landscape");
  doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.text("TPV BETA V1 · Evaluación de la simulación (HOTR0208)", 14, 15);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text("Las Moreras · Exportado el " + fmtDate(today()) + " · Nota final = 60 % rúbrica + 40 % cuestionario", 14, 21);
  const rows = flatRows();
  doc.autoTable({startY:26, head:[["Fecha","Servicio","Alumno/a","Puesto","C1","C2","C3","C4","Rúbrica","Cuest.","Final","Nivel","Observaciones"]],
    body:rows.map(r=>[fmtDate(r.fecha), r.sesion, r.alumno, r.puestos, ...CRITERIOS.map(c=>coma(r.notas[c.k])), coma(r.rubrica), r.hecho?`${coma(r.quiz)} (${r.aciertos}/10)`:"0 (no hecho)", coma(r.final), nivel(r.final), r.obs||""]),
    styles:{fontSize:8, cellPadding:1.6, valign:"top"}, headStyles:{fillColor:[30,91,74]}, columnStyles:{1:{cellWidth:30}, 12:{cellWidth:50}}});
  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8); CRITERIOS.forEach((c,i)=>{ doc.text(`C${i+1}: ${c.n}`, 14, y); y+=4; });
  doc.text("Niveles: En proceso 1-4,9 · Adecuado 5-6,9 · Avanzado 7-8,9 · Excelente 9-10", 14, y);
  descargar(fileBase()+".pdf", doc.output("blob"));
}
const LETRAS = ["a","b","c","d"];
function pdfCabeceraQuiz(doc, titulo){
  doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.text(titulo, 14, 16);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(`Las Moreras · HOTR0208 · ${SV.team||"Servicio"} · ${fmtDate(SV.fecha)}`, 14, 22);
}
function pdfPreguntas(doc, y, marca){
  T.quiz.preguntas.forEach((p,i)=>{
    const lineas = doc.splitTextToSize(`${i+1}. ${p.t}`, 180);
    if(y + 6 + lineas.length*5 + 22 > 285){ doc.addPage(); y = 16; }
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.text(lineas, 14, y); y += lineas.length*5;
    doc.setFont("helvetica","normal");
    p.ops.forEach((o,j)=>{ const m = marca ? marca(p,o) : "[  ]"; const ls = doc.splitTextToSize(`${m} ${LETRAS[j]}) ${o}`, 172); doc.text(ls, 20, y); y += ls.length*5; });
    y += 3;
  });
  return y;
}
function quizPdfBlank(){
  const doc = pdfNuevo("portrait");
  pdfCabeceraQuiz(doc, "Cuestionario de evaluación");
  doc.setFontSize(10); doc.text("Alumno/a: ______________________________________    Fecha: ____________", 14, 30);
  doc.text("Marca una sola respuesta en cada pregunta. Cada acierto vale 1 punto.", 14, 36);
  pdfPreguntas(doc, 44, null);
  descargar("Cuestionario_en_blanco_"+today()+".pdf", doc.output("blob"));
}
function quizPdfAll(){
  const doc = pdfNuevo("portrait"); let first = true;
  (SV.miembros||[]).forEach(uid=>{
    const r = T.resps.find(x=>x.uid===uid); if(!r) return;
    if(!first) doc.addPage(); first = false;
    const a = aciertos(r, T.clave);
    pdfCabeceraQuiz(doc, "Cuestionario corregido");
    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.text(`Alumno/a: ${nombreDe(uid)}    Aciertos: ${a}/10    Nota: ${coma(a)}`, 14, 30);
    doc.setFont("helvetica","normal"); doc.text("[X] respuesta del alumno · (correcta) respuesta correcta", 14, 36);
    pdfPreguntas(doc, 44, (p,o)=>`${(r.resp||{})[p.id]===o?"[X]":"[  ]"}${T.clave&&T.clave[p.id]===o?" (correcta)":""}`);
  });
  descargar("Cuestionarios_corregidos_"+today()+".pdf", doc.output("blob"));
}

function docenteClick(t){
  if(t.dataset.ttab){ T.tab=t.dataset.ttab; T.confirm=null; if(T.tab==="evaluar" && !T.evalSid && SID) cargarEval(SID); else render(); return; }
  if(t.id==="openService"){ abrirServicio(t); return; }
  if(t.id==="editAsig"){ if(T.editAsig){ T.editAsig=null; } else { T.editAsig={}; ["sala","barra","cocina"].forEach(k=>((SV.puestos||{})[k]||[]).forEach(u=>T.editAsig[u]=k)); } render(); return; }
  if(t.id==="saveAsig"){ guardarAsig(); return; }
  if(t.id==="closeAsk"){ T.confirm="close"; render(); return; }
  if(t.id==="closeNo"){ T.confirm=null; render(); return; }
  if(t.id==="closeYes"){ cerrarServicio(); return; }
  if(t.id==="quizRandom"){ quizAzar(); render(); return; }
  if(t.id==="quizClear"){ T.sel=[]; render(); return; }
  if(t.id==="quizSave"){ guardarQuiz(t); return; }
  if(t.id==="quizToggle"){ db.doc("cuestionarios/"+SV.cuestionario).update({activo:!T.quiz.activo}).catch(fallo); return; }
  if(t.id==="quizRedo"){ db.doc("servicios/"+SID).update({cuestionario:null}).then(()=>{ if(T.quiz && T.quiz.activo) db.doc("cuestionarios/"+T.quiz.id).update({activo:false}).catch(()=>{}); }).catch(fallo); return; }
  if(t.id==="quizPdfBlank"){ quizPdfBlank(); return; }
  if(t.id==="quizPdfAll"){ quizPdfAll(); return; }
  if(t.id==="saveEval"){ guardarEval(t); return; }
  if(t.id==="expXlsx"){ exportXlsx(); return; }
  if(t.id==="expPdf"){ exportPdf(); return; }
}
function docenteChange(t){
  if(t.dataset.asig!=null){ const target = (SV && SV.estado==="abierto" && T.editAsig) ? T.editAsig : T.form.asig; if(t.value) target[t.dataset.asig]=t.value; else delete target[t.dataset.asig]; return; }
  if(t.dataset.qsel!=null){ const id=t.dataset.qsel; T.sel = t.checked ? T.sel.concat(id) : T.sel.filter(x=>x!==id); render(); return; }
  if(t.id==="evalSel"){ cargarEval(t.value); return; }
  if(t.id==="filter"){ T.filter=t.value; render(); return; }
}
function docenteInput(t){
  if(t.id==="fTeam"){ T.form.team=t.value; return; }
  if(t.id==="fCaja"){ T.form.caja=t.value; return; }
  if(t.dataset.enota!=null){ const i=+t.dataset.enota, A=T.draft.alumnos[i], v=num(t.value); A.notas[t.dataset.c] = isNaN(v)?null:Math.min(10,Math.max(0,v));
    const pl=t.nextElementSibling, val=A.notas[t.dataset.c]; pl.className="pill "+levelClass(val); pl.textContent=nivel(val)||"—";
    const fin=notaFinal(A), rub=notaRubrica(A), fp=document.querySelector(`[data-fin="${i}"]`), rq=document.querySelector(`[data-rq="${i}"]`);
    if(fp){ fp.className="pill "+levelClass(fin); fp.textContent = fin!=null?`Final ${coma(fin)} · ${nivel(fin)}`:"Final —"; }
    if(rq) rq.textContent = `Rúbrica: ${rub!=null?coma(rub):"—"} · Cuestionario: ${A.hecho?`${A.aciertos}/10`:"no realizado (0)"}`;
    return; }
  if(t.dataset.eobs!=null){ T.draft.alumnos[+t.dataset.eobs].obs=t.value; return; }
}

/* =========================================================
   Panel del Administrador: cuentas y batería de preguntas
   ========================================================= */
const A = {tab:"usuarios", usuarios:[], preguntas:[], msg:"", editQ:null};
function arrancarAdmin(){
  subs.push(db.collection("usuarios").onSnapshot(s=>{ A.usuarios = s.docs.map(d=>Object.assign({uid:d.id}, d.data())).sort((a,b)=>(a.rol+a.usuario).localeCompare(b.rol+b.usuario)); repaint(); }, e=>console.warn(e)));
  subs.push(db.collection("preguntas").onSnapshot(s=>{ A.preguntas = s.docs.map(d=>Object.assign({id:d.id}, d.data())).sort((a,b)=>a.n-b.n); repaint(); }, e=>console.warn(e)));
}
function vAdmin(){
  const tabs = [["usuarios","Cuentas"],["preguntas","Batería de preguntas"]];
  return `<div class="stack"><div><div class="eyebrow">Administración de la app</div><h2>${tabs.find(t=>t[0]===A.tab)[1]}</h2></div>
    <div class="tabs" role="tablist">${tabs.map(([k,n])=>`<button type="button" class="chip" role="tab" data-atab="${k}" aria-pressed="${A.tab===k}">${n}</button>`).join("")}</div>
    ${A.tab==="usuarios"?aUsuarios():aPreguntas()}</div>`;
}
function aUsuarios(){
  return `<form class="card stack" id="formCrear" autocomplete="off"><h3>Crear una cuenta</h3>
    <p class="muted">Usa usuarios cortos, por ejemplo alumno01 o docente01. Entrega la contraseña inicial en mano y pide que la cambien al entrar.</p>
    ${A.msg}
    <div class="grid2"><label class="field"><span>Usuario</span><input type="text" name="usuario" required maxlength="30" pattern="[a-z0-9._\\-]+" autocapitalize="none" placeholder="alumno01"></label>
    <label class="field"><span>Contraseña inicial (mínimo 8)</span><input type="text" name="clave" required minlength="8" autocomplete="new-password"></label>
    <label class="field"><span>Nombre</span><input type="text" name="nombre" required maxlength="40"></label>
    <label class="field"><span>Inicial del primer apellido</span><input type="text" name="inicial" maxlength="2"></label>
    <label class="field"><span>Rol</span><select name="rol"><option value="alumno">Alumno</option><option value="docente">Docente</option></select></label></div>
    <div class="row"><button class="btn">Crear la cuenta</button></div></form>
    <div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th></tr></thead><tbody>
    ${A.usuarios.map(u=>{ const yoMismo = u.uid===yo();
      return `<tr><td>${esc(u.usuario)}</td><td>${esc(u.nombre)}${u.inicial?` ${esc(u.inicial)}.`:""}</td>
      <td>${yoMismo?ROL_TXT[u.rol]:`<select data-urol="${esc(u.uid)}">${["alumno","docente","admin"].map(r=>`<option value="${r}" ${u.rol===r?"selected":""}>${ROL_TXT[r]}</option>`).join("")}</select>`}</td>
      <td>${yoMismo?"Activa":`<button type="button" class="btn small ${u.activo?"ghost":""}" data-uact="${esc(u.uid)}">${u.activo?"Activa · desactivar":"Pendiente · activar"}</button>`}</td></tr>`; }).join("")}
    </tbody></table></div>
    <p class="muted" style="font-size:.9rem">Una cuenta desactivada no puede ver ni cambiar nada. Para borrar del todo una cuenta, hazlo en la consola de Firebase, en Authentication.</p>`;
}
async function crearCuenta(f){
  const usuario = f.usuario.value.trim().toLowerCase(), clave = f.clave.value, nombre = f.nombre.value.trim().slice(0,40), inicial = f.inicial.value.trim().replace(".","").slice(0,2).toUpperCase(), rol = f.rol.value;
  if(!/^[a-z0-9._-]{2,30}$/.test(usuario)){ A.msg=`<div class="note bad">El usuario solo puede tener letras minúsculas sin tildes, números, punto, guion o guion bajo.</div>`; render(); return; }
  if(clave.length<8){ A.msg=`<div class="note bad">La contraseña inicial debe tener al menos 8 caracteres.</div>`; render(); return; }
  const b = f.querySelector("button"); b.disabled = true;
  // Se usa una segunda conexión para crear la cuenta sin cerrar la sesión del Administrador
  let sec = firebase.apps.find(a=>a.name==="alta");
  if(!sec){ sec = firebase.initializeApp(CFG.firebaseConfig, "alta"); if(EMU) sec.auth().useEmulator("http://localhost:9099"); }
  try{
    await sec.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
    const cred = await sec.auth().createUserWithEmailAndPassword(correo(usuario), clave);
    await db.doc("usuarios/"+cred.user.uid).set({nombre, inicial, usuario, rol, activo:true, creadoEn:FV.serverTimestamp()});
    A.msg = `<div class="note ok">Cuenta <b>${esc(usuario)}</b> creada y activa (${ROL_TXT[rol]}).</div>`;
  }catch(er){ A.msg = `<div class="note bad">${er.code==="auth/email-already-in-use"?"Ese usuario ya existe.":er.code==="auth/weak-password"?"La contraseña es demasiado débil.":"No se ha podido crear: "+esc(er.code||er.message)}</div>`; }
  try{ await sec.auth().signOut(); }catch(e){}
  render();
}
function aPreguntas(){
  if(!A.preguntas.length) return `<div class="card stack"><p>Todavía no hay preguntas en la base de datos. Carga la batería inicial de 20 preguntas (higiene, servicio y uso del TPV). Después podrás cambiar su texto.</p><div class="row"><button type="button" class="btn" id="seedQ">Cargar las 20 preguntas iniciales</button></div></div>`;
  const c = A.preguntas.reduce((m,p)=>(m[p.dif]=(m[p.dif]||0)+1,m),{});
  return `<p class="muted">${Object.entries(DIFICULTADES).map(([k,n])=>`${n}: ${c[k]||0}`).join(" · ")}. El docente elige 10 de estas preguntas para cada cuestionario (5-3-1-1).</p>
    ${A.preguntas.map(p=>A.editQ===p.id?`<div class="card stack" data-qform="${esc(p.id)}"><h3>Pregunta ${p.n}</h3>
      <div class="grid2"><label class="field"><span>Dificultad</span><select name="dif">${Object.entries(DIFICULTADES).map(([k,n])=>`<option value="${k}" ${p.dif===k?"selected":""}>${n}</option>`).join("")}</select></label>
      <label class="field"><span>Tema</span><select name="tema">${TEMAS.map(x=>`<option ${p.tema===x?"selected":""}>${x}</option>`).join("")}</select></label></div>
      <label class="field"><span>Pregunta</span><textarea name="t" rows="2" maxlength="300">${esc(p.t)}</textarea></label>
      <label class="field"><span>Respuesta correcta</span><input type="text" name="ok" maxlength="150" value="${esc(p.ok)}"></label>
      ${p.otras.map((o,i)=>`<label class="field"><span>Respuesta incorrecta ${i+1}</span><input type="text" name="o${i}" maxlength="150" value="${esc(o)}"></label>`).join("")}
      <div class="row"><button type="button" class="btn" data-qsave="${esc(p.id)}">Guardar</button><button type="button" class="btn ghost" data-qcancel>Cancelar</button></div></div>`
    :`<div class="card stack" style="gap:6px"><div class="row" style="justify-content:space-between"><b>${p.n}. ${esc(p.t)}</b><span class="muted">${DIFICULTADES[p.dif]} · ${esc(p.tema)}</span></div>
      <span>Correcta: ${esc(p.ok)}</span><span class="muted">Otras: ${p.otras.map(esc).join(" · ")}</span>
      <div class="row"><button type="button" class="btn small ghost" data-qedit="${esc(p.id)}">Editar</button></div></div>`).join("")}`;
}
async function seedPreguntas(btn){
  btn.disabled = true;
  try{ const b = db.batch(); PREGUNTAS_INICIALES.forEach(p=>b.set(db.doc("preguntas/p"+String(p.n).padStart(2,"0")), {n:p.n, dif:p.dif, tema:p.tema, t:p.t, ok:p.ok, otras:p.otras})); await b.commit(); toast("Batería cargada"); }
  catch(e){ btn.disabled=false; fallo(e); }
}
async function guardarPregunta(id){
  const box = document.querySelector(`[data-qform="${id}"]`), g = n => box.querySelector(`[name="${n}"]`).value.trim();
  const p = A.preguntas.find(x=>x.id===id);
  const d = {n:p.n, dif:g("dif"), tema:g("tema"), t:g("t"), ok:g("ok"), otras:[g("o0"),g("o1"),g("o2")]};
  if(!d.t || !d.ok || d.otras.some(x=>!x)){ toast("Rellena la pregunta y las cuatro respuestas."); return; }
  if(new Set([d.ok, ...d.otras]).size<4){ toast("Las cuatro respuestas tienen que ser distintas."); return; }
  try{ await db.doc("preguntas/"+id).set(d); A.editQ=null; render(); toast("Pregunta guardada"); }catch(e){ fallo(e); }
}
function adminClick(t){
  if(t.dataset.atab){ A.tab=t.dataset.atab; A.msg=""; render(); return; }
  if(t.dataset.uact){ const u=A.usuarios.find(x=>x.uid===t.dataset.uact); db.doc("usuarios/"+u.uid).update({activo:!u.activo}).catch(fallo); return; }
  if(t.id==="seedQ"){ seedPreguntas(t); return; }
  if(t.dataset.qedit){ A.editQ=t.dataset.qedit; render(); return; }
  if(t.hasAttribute("data-qcancel")){ A.editQ=null; render(); return; }
  if(t.dataset.qsave){ guardarPregunta(t.dataset.qsave); return; }
}
function adminChange(t){
  if(t.dataset.urol){ db.doc("usuarios/"+t.dataset.urol).update({rol:t.value}).catch(fallo); return; }
}

/* ---------- Licencia ---------- */
// En la licencia consta el titular con nombre y apellidos para reservarse los derechos de autor.
const TITULAR = "Ángel Manuel Domínguez Lavado";
const CENTRO = "Unidad Municipal de Formación y Desarrollo (UMDF) «Antonio Morales Recio» — Las Moreras, del Ayuntamiento de Monesterio (Badajoz)";
const LICENCIA = [
  ["Titularidad", `El simulador TPV «Las Moreras» (su código, diseño, textos y contenidos) es una obra original de ${TITULAR}, que se reserva todos los derechos de propiedad intelectual sobre ella. La ha desarrollado de forma voluntaria, sin percibir retribución y fuera de las funciones propias de su labor docente. Esta licencia no transmite la propiedad de la aplicación ni ningún derecho de explotación.`],
  ["Licencia de uso", `Se concede a la ${CENTRO} una licencia de uso gratuita, sin ánimo de lucro, intransferible y de uso exclusivo para la formación que imparte el propio centro con su alumnado y profesorado.`],
  ["Uso educativo del código", `Se permite consultar el código y utilizarlo con fines exclusivamente educativos y sin ánimo de lucro, citando siempre la autoría de ${TITULAR}.`],
  ["Prohibiciones", `Queda prohibido: vender, alquilar, sublicenciar o comercializar la aplicación o cualquier parte de ella; distribuirla o cederla a otras administraciones públicas o entidades privadas; usarla con fines lucrativos; atribuirse su autoría o titularidad; y desarrollar nuevas versiones u obras derivadas sin acuerdo previo y por escrito con el titular.`],
  ["Nuevas versiones", `Quien desee desarrollar una nueva versión o una versión profesional debe ponerse en contacto con el titular para llegar a un acuerdo económico.`],
  ["Incumplimiento", `Cualquier distribución o comercialización no autorizada restringe de forma automática la licencia de uso. El titular se reserva el ejercicio de todas las acciones legales oportunas, incluida la reclamación de una indemnización económica por los daños y perjuicios causados, conforme al texto refundido de la Ley de Propiedad Intelectual (Real Decreto Legislativo 1/1996).`],
  ["Versión TPV BETA V1 y seguridad", `La aplicación es una versión de prueba (TPV BETA V1) y se ofrece tal cual. Sustituye a la versión Beta V0 para corregir sus problemas de seguridad: ahora cada persona entra con su usuario y contraseña, y las reglas del servidor deciden qué puede ver y cambiar cada rol (Administrador, Docente y Alumno). Aun así, no ha pasado una auditoría de seguridad externa y puede contener errores. El titular no garantiza su funcionamiento continuo ni su seguridad, y no responde de la pérdida, la alteración o el acceso no autorizado a los datos. Conviene exportar las evaluaciones a Excel o PDF de vez en cuando.`],
  ["Advertencia sobre datos personales y descargo de responsabilidad", `La aplicación no se ha desarrollado con fines de recopilación ni de tratamiento de datos personales o sensibles. El único dato personal que debe introducirse es el nombre y la inicial del primer apellido de cada usuario. No deben introducirse otros datos personales (DNI, teléfono, correo electrónico, domicilio, datos de salud u otros) ni en los nombres, ni en las observaciones de la evaluación, ni en los formularios de la simulación. Los datos de clientes, alergias y facturas de la simulación deben ser ficticios. Los nombres se guardan en la base de datos del proyecto, protegida por usuario y contraseña. Al cerrar la sesión, la app borra sus datos del dispositivo. El centro es responsable del uso que haga de la aplicación y del cumplimiento de la normativa de protección de datos (RGPD y LOPDGDD). El titular declina toda responsabilidad derivada de la introducción de datos distintos de los indicados o de cualquier uso contrario a esta licencia.`]
];
function vLicencia(){
  return `<div class="stack"><div><div class="eyebrow">Licencia de uso</div><h2>TPV BETA V1 · Simulador «Las Moreras»</h2><p class="muted">© 2026 ${esc(TITULAR)}. Todos los derechos reservados.</p></div>
    <div class="card stack">${LICENCIA.map(([h,t],i)=>`<div><h3>${i+1}. ${esc(h)}</h3><p>${esc(t)}</p></div>`).join("")}</div>
    <div class="row"><button type="button" class="btn" data-act="volver">Volver</button></div></div>`;
}

function legal(){
  const f = $("#legal"); if(!f) return;
  f.innerHTML = `<p>TPV BETA V1 (versión de prueba, puede contener errores). © 2026 ${esc(TITULAR)}. Todos los derechos reservados. Licencia de uso gratuita y sin ánimo de lucro, exclusiva para la UMDF «Antonio Morales Recio» — Las Moreras (Monesterio). Prohibida su distribución o comercialización. Introducid solo nombre e inicial del apellido del alumnado; el resto de datos deben ser ficticios.</p>
    <div class="row"><button type="button" class="btn small ghost" data-act="licencia">Ver la licencia</button></div>`;
}

/* ---------- Eventos ---------- */
function comun(t){
  const a = t.dataset.act; if(!a) return false;
  if(a==="salir"){ if(SID && S.abierto && !esDocente() && pay && pay.pagos && pay.pagos.length){ toast("Termina primero el cobro en curso."); return true; } salir(); return true; }
  if(a==="licencia"){ if(mode!=="licencia") prevMode=mode; mode="licencia"; render(); window.scrollTo({top:0}); return true; }
  if(a==="clave"){ if(mode!=="clave") prevMode=mode; claveMsg=""; mode="clave"; render(); return true; }
  if(a==="volver"){ mode = ["licencia","clave"].includes(prevMode) ? "app" : prevMode; render(); window.scrollTo({top:0}); return true; }
  if(a==="vertpv"){ mode="tpv"; render(); window.scrollTo({top:0}); return true; }
  if(a==="panel"){ mode="app"; render(); window.scrollTo({top:0}); return true; }
  return false;
}
const enTPV = () => U.perfil && U.perfil.activo && (U.perfil.rol==="alumno" || (U.perfil.rol==="docente" && mode==="tpv")) && !["licencia","clave"].includes(mode);
const enDocente = () => U.perfil && U.perfil.activo && U.perfil.rol==="docente" && mode==="app";
const enAdmin = () => U.perfil && U.perfil.activo && U.perfil.rol==="admin" && mode==="app";
document.addEventListener("click", ev=>{
  const t = ev.target.closest("button"); if(!t || t.type==="submit") return;
  if(comun(t)) return;
  if(enTPV()) tpvClick(t); else if(enDocente()) docenteClick(t); else if(enAdmin()) adminClick(t);
});
document.addEventListener("change", ev=>{ const t=ev.target; if(enTPV()) tpvChange(t); else if(enDocente()) docenteChange(t); else if(enAdmin()) adminChange(t); });
document.addEventListener("input", ev=>{ const t=ev.target; if(enTPV()) tpvInput(t); else if(enDocente()) docenteInput(t); });
// Refresca los minutos de barra y cocina sin molestar si alguien está escribiendo
setInterval(()=>{ if(enTPV() && SV && ["barra","cocina"].includes(STEPS[S.step][0]) && !document.activeElement.matches("input,textarea,select")) render(); }, 30000);
window.addEventListener("beforeunload", e=>{ if(pay && pay.pagos && pay.pagos.length){ e.preventDefault(); e.returnValue=""; } });

legal();
render();
