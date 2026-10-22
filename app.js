const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let D;
const bajo = r => r.stock <= r.stock_minimo;
const subDe = id => D.subcomponentes.find(s=>s.id===id);
const compDe = id => D.componentes.find(c=>c.id===id);
const maqDe = id => D.maquinas.find(m=>m.id===id);
function ruta(rep){ const s=subDe(rep?.subcomponente_id), c=s&&compDe(s.componente_id), m=c&&maqDe(c.maquina_id); return {s,c,m}; }
// Fecha local (no UTC) en formato YYYY-MM-DD
const hoyLocal = () => { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };

async function refrescar(){ D = await DB.todo(); dashboard(); arbol(); repuestos(); historial(); }

function dashboard(){
  const mes = hoyLocal().slice(0,7);
  const nb = D.repuestos.filter(bajo), cm = D.cambios.filter(c=>c.fecha.startsWith(mes));
  const k = [["Máquinas",D.maquinas.length,""],["Repuestos",D.repuestos.length,"ok"],["Stock bajo",nb.length,"warn"],["Cambios del mes",cm.length,"or"]];
  $("#kpis").innerHTML = k.map(([t,v,c])=>`<div class="kpi ${c}"><b>${v}</b><span>${t}</span></div>`).join("");
  $("#dash-bajo").innerHTML = nb.length ? `<table>${nb.map(r=>`<tr><td>${esc(r.nombre)}</td><td><span class="badge b-bajo">${r.stock} / mín ${r.stock_minimo}</span></td></tr>`).join("")}</table>` : "<p class='muted'>Todo en orden ✅</p>";
  const u = [...D.cambios].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id).slice(0,5);
  $("#dash-ultimos").innerHTML = `<table>${u.map(c=>{const r=D.repuestos.find(x=>x.id===c.repuesto_id);return `<tr><td>${c.fecha}</td><td>${esc(ruta(r).m.codigo)}</td><td>${esc(r.nombre)} ×${c.cantidad}</td></tr>`}).join("")}</table>`;
}
function arbol(){
  $("#arbol").innerHTML = `<div class="tree"><ul>${D.maquinas.map(m=>`<li><details open><summary>🏭 ${esc(m.codigo)} · ${esc(m.nombre)} <span class="muted">(${esc(m.area)})</span></summary><ul>${
    D.componentes.filter(c=>c.maquina_id===m.id).map(c=>`<li>⚙️ ${esc(c.nombre)}<ul>${
      D.subcomponentes.filter(s=>s.componente_id===c.id).map(s=>{const rs=D.repuestos.filter(r=>r.subcomponente_id===s.id);
        return `<li>🔧 ${esc(s.nombre)} <span class="muted">${rs.map(r=>`${esc(r.codigo)} (${r.stock})`).join(", ")}</span></li>`}).join("")}</ul></li>`).join("")}</ul></details></li>`).join("")}</ul></div>`;
}
function repuestos(){
  const q = ($("#buscar-rep").value||"").toLowerCase();
  $("#tabla-rep").innerHTML = D.repuestos.filter(r=>(r.nombre+r.codigo).toLowerCase().includes(q)).map(r=>{const {s,m}=ruta(r);
    return `<tr><td>${esc(r.codigo)}</td><td>${esc(r.nombre)}</td><td>${esc(m.codigo)} › ${esc(s.nombre)}</td><td>${r.stock}</td><td>${r.stock_minimo}</td><td>${bajo(r)?'<span class="badge b-bajo">Stock bajo</span>':'<span class="badge b-ok">OK</span>'}</td></tr>`}).join("");
}
function historial(){
  const mq=$("#h-maquina").value, de=$("#h-desde").value, ha=$("#h-hasta").value, tx=$("#h-texto").value.toLowerCase();
  // OJO: el cambio va en "cambio" (no "c"), porque ruta() devuelve c = componente
  const rows = [...D.cambios].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id).map(cambio=>{const r=D.repuestos.find(x=>x.id===cambio.repuesto_id);const {s,c,m}=ruta(r);return {cambio,r,s,comp:c,m}})
    .filter(x=>x.r&&x.m&&(!mq||x.m.id==mq)&&(!de||x.cambio.fecha>=de)&&(!ha||x.cambio.fecha<=ha)&&(!tx||(x.cambio.tecnico+x.r.nombre).toLowerCase().includes(tx)));
  $("#tabla-hist").innerHTML = rows.map(({cambio,r,m,s,comp})=>`<tr><td>${esc(cambio.fecha)}</td><td>${esc(m.codigo)}</td><td>${esc(comp.nombre)} / ${esc(s.nombre)}</td><td>${esc(r.nombre)}</td><td>${cambio.cantidad}</td><td>${esc(cambio.tecnico)}</td><td>${esc(cambio.observacion)}</td></tr>`).join("") || "<tr><td colspan=7 class='muted'>Sin resultados</td></tr>";
}
const opts = (arr, f, ph) => `<option value="">${ph}</option>` + arr.map(x=>`<option value="${x.id}">${esc(f(x))}</option>`).join("");
function initForm(){
  $("#f-fecha").value = hoyLocal();
  $("#f-maquina").innerHTML = opts(D.maquinas, m=>`${m.codigo} · ${m.nombre}`, "Selecciona máquina");
  $("#h-maquina").innerHTML = opts(D.maquinas, m=>`${m.codigo} · ${m.nombre}`, "Todas las máquinas");
  const cas = () => { $("#f-componente").innerHTML = opts(D.componentes.filter(c=>c.maquina_id==$("#f-maquina").value), c=>c.nombre, "Selecciona componente"); sub(); };
  const sub = () => { $("#f-sub").innerHTML = opts(D.subcomponentes.filter(s=>s.componente_id==$("#f-componente").value), s=>s.nombre, "Selecciona subcomponente"); rep(); };
  const rep = () => { $("#f-repuesto").innerHTML = opts(D.repuestos.filter(r=>r.subcomponente_id==$("#f-sub").value), r=>`${r.codigo} · ${r.nombre} (stock ${r.stock})`, "Selecciona repuesto"); };
  $("#f-maquina").onchange = cas; $("#f-componente").onchange = sub; $("#f-sub").onchange = rep; cas();
  $("#form-cambio").onsubmit = async e => {
    e.preventDefault(); const msg = $("#msg");
    const cant = Number($("#f-cantidad").value), rid = Number($("#f-repuesto").value), tec = $("#f-tecnico").value.trim(), fecha = $("#f-fecha").value;
    const err = !rid ? "Selecciona máquina, componente, subcomponente y repuesto." : !Number.isInteger(cant)||cant<=0 ? "La cantidad debe ser un entero mayor a 0." : !fecha ? "Indica la fecha." : fecha > hoyLocal() ? "La fecha no puede ser futura." : !tec ? "Indica el técnico." : null;
    if (err) { msg.className="msg-err"; msg.textContent="❌ "+err; return; }
    try { await DB.registrarCambio({fecha, repuesto_id:rid, cantidad:cant, tecnico:tec, observacion:$("#f-obs").value.trim()});
      await refrescar(); rep(); msg.className="msg-ok"; msg.textContent=`✅ Cambio registrado. Stock descontado (${cant}).`; $("#f-obs").value="";
    } catch(x){ msg.className="msg-err"; msg.textContent="❌ "+x.message; }
  };
}
function nav(){
  const go = () => { const v=(location.hash||"#dashboard").slice(1);
    document.querySelectorAll(".view").forEach(s=>s.classList.toggle("hidden", s.id!=="view-"+v));
    document.querySelectorAll("nav a").forEach(a=>a.classList.toggle("active", a.dataset.view===v)); };
  window.onhashchange = go; go();
}
let PERFIL = null, iniciado = false;
async function iniciarApp(){
  $("#auth").classList.add("hidden");
  if (PERFIL){ $("#usuario").classList.remove("hidden"); $("#u-email").textContent = "👤 " + PERFIL.email; $("#f-tecnico").value = PERFIL.nombre; }
  if (iniciado) return; iniciado = true;
  try { D = await DB.todo(); } catch(e){ alert("Error cargando datos: "+e.message); return; }
  initForm(); if (PERFIL) $("#f-tecnico").value = PERFIL.nombre;
  await refrescar(); nav();
  ["#buscar-rep"].forEach(s=>$(s).oninput=repuestos);
  ["#h-maquina","#h-desde","#h-hasta","#h-texto"].forEach(s=>$(s).oninput=historial);
}
function pantallaAuth(){
  let modo = "login"; const m = $("#a-msg");
  const set = x => { modo = x; m.className=""; m.textContent="";
    $("#tab-login").classList.toggle("active", x==="login"); $("#tab-signup").classList.toggle("active", x==="signup");
    $("#lbl-nombre").classList.toggle("hidden", x==="login"); $("#a-btn").textContent = x==="login" ? "Entrar" : "Crear cuenta"; };
  $("#tab-login").onclick = () => set("login"); $("#tab-signup").onclick = () => set("signup");
  $("#form-auth").onsubmit = async e => {
    e.preventDefault();
    const nombre=$("#a-nombre").value.trim(), email=$("#a-email").value.trim(), pass=$("#a-pass").value;
    const err = modo==="signup" && !nombre ? "Escribe tu nombre." : !/^\S+@\S+\.\S+$/.test(email) ? "Escribe un correo válido." : pass.length<6 ? "La contraseña debe tener al menos 6 caracteres." : null;
    if (err){ m.className="msg-err"; m.textContent="❌ "+err; return; }
    $("#a-btn").disabled = true;
    try {
      if (modo==="signup"){
        const r = await DB.crearCuenta(nombre, email, pass);
        if (r.requiereConfirmacion){ m.className="msg-ok"; m.textContent="📧 Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión."; set("login"); m.className="msg-ok"; m.textContent="📧 Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión."; return; }
      } else await DB.iniciarSesion(email, pass);
      PERFIL = await DB.perfil(); await iniciarApp();
    } catch(x){ m.className="msg-err"; m.textContent="❌ "+x.message; }
    finally { $("#a-btn").disabled = false; }
  };
  $("#auth").classList.remove("hidden");
}
document.addEventListener("DOMContentLoaded", async () => {
  $("#modo").textContent = "Modo de datos: " + DB.modo;
  $("#reset").onclick = () => { if (confirm("¿Restaurar los datos de ejemplo?")) { DB.reset(); location.reload(); } };
  if (DB.usaAuth){
    $("#reset").classList.add("hidden");
    $("#logout").onclick = async () => { await DB.cerrarSesion(); location.reload(); };
    PERFIL = await DB.perfil();
    if (!PERFIL) return pantallaAuth();
  }
  iniciarApp();
});
