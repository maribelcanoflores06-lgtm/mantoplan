// MantoPlan · Lógica de interfaz
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const soles = n => "S/ " + Number(n || 0).toLocaleString("es-PE", {minimumFractionDigits:2, maximumFractionDigits:2});
const hoyLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtFecha = f => f ? new Date(f + "T12:00:00").toLocaleDateString("es-PE", {day:"2-digit", month:"short", year:"numeric"}) : "";
const otCod = id => "OT-" + String(id).padStart(4, "0");
let D, PERFIL = null, iniciado = false, otItems = [], otFiltro = "";

// ---------- Helpers de dominio ----------
const subDe = id => D.subcomponentes.find(s => s.id === id);
const compDe = id => D.componentes.find(c => c.id === id);
const maqDe = id => D.maquinas.find(m => m.id === id);
const repDe = id => D.repuestos.find(r => r.id === id);
function ubicacion(rep){ const sub = subDe(rep?.subcomponente_id), comp = sub && compDe(sub.componente_id), maq = comp && maqDe(comp.maquina_id); return {sub, comp, maq}; }
const estadoStock = r => r.stock <= Math.floor(r.stock_minimo / 2) ? "crit" : r.stock <= r.stock_minimo ? "bajo" : "ok";
function chipStock(r){
  const e = estadoStock(r);
  return e === "ok" ? `<span class="chip c-ok">En stock (${r.stock} disp.)</span>` : e === "bajo" ? `<span class="chip c-bajo">Stock bajo (${r.stock} disp.)</span>` : `<span class="chip c-crit">Crítico (${r.stock} disp.)</span>`;
}
const chipEstadoOT = e => ({pendiente:'<span class="chip c-gray">Pendiente</span>', en_proceso:'<span class="chip c-info">En proceso</span>', cerrada:'<span class="chip c-ok">Cerrada</span>'}[e]);
const chipPrioridad = p => ({alta:'<span class="chip c-crit nodot">▲ Alta</span>', media:'<span class="chip c-bajo nodot">● Media</span>', baja:'<span class="chip c-info nodot">▼ Baja</span>'}[p]);
const chipTipo = t => t === "preventivo" ? '<span class="chip c-violet nodot">Preventivo</span>' : '<span class="chip c-bajo nodot">Correctivo</span>';
const iniciales = n => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join("");

function toast(msg, tipo = "ok"){ const t = document.createElement("div"); t.className = "toast " + (tipo === "ok" ? "" : tipo); t.textContent = msg; $("#toasts").appendChild(t); setTimeout(() => t.remove(), 4500); }
function requiereSesion(){ if (DB.usaAuth && !PERFIL){ toast("Inicia sesión para realizar esta acción", "err"); return true; } return false; }

// ---------- Navegación ----------
const VISTAS = {
  dashboard:{t:"Dashboard", s:"Resumen de la planta · datos de ejemplo", a:[["🧾 Nueva OT","#ot?nueva","btn"],["🛠️ Registrar cambio","#cambio","btn-sec"]]},
  ot:{t:"Órdenes de trabajo", s:"Programa y da seguimiento a preventivos y correctivos", a:[["+ Nueva OT","#ot?nueva","btn"]]},
  cambio:{t:"Registrar cambio de repuesto", s:"Descuenta stock y agrega al historial", a:[["📜 Ver historial","#historial","btn-sec"]]},
  historial:{t:"Historial de cambios", s:"Trazabilidad de repuestos cambiados", a:[["⬇ Exportar CSV","csv","btn-sec"]]},
  maquinas:{t:"Máquinas", s:"Máquina → Componente → Subcomponente → Repuestos", a:[]},
  repuestos:{t:"Repuestos", s:"Stock, precios y valor de inventario", a:[["🛠️ Registrar cambio","#cambio","btn-sec"]]}
};
function ir(){
  const [v, q] = (location.hash.slice(1) || "dashboard").split("?"), vista = VISTAS[v] ? v : "dashboard";
  $$(".view").forEach(s => s.classList.toggle("hidden", s.id !== "view-" + vista));
  $$("nav a").forEach(a => a.classList.toggle("active", a.dataset.view === vista));
  const cfg = VISTAS[vista]; $("#titulo").textContent = cfg.t; $("#subtitulo").textContent = cfg.s;
  $("#acciones").innerHTML = cfg.a.map(([t, h, c]) => `<button class="${c}" data-go="${h}">${t}</button>`).join("");
  $$("#acciones button").forEach(b => b.onclick = () => b.dataset.go === "csv" ? exportarCSV() : (location.hash = b.dataset.go));
  if (vista === "ot") mostrarFormOT(q === "nueva");
  $("#sidebar").classList.remove("open"); window.scrollTo(0, 0);
}

async function refrescar(){ D = await DB.todo(); renderTodo(); }
function renderTodo(){ dashboard(); ordenes(); arbol(); repuestos(); historial(); resumenCambio(); resumenOT(); badges(); }
function badges(){
  const pend = D.ordenes.filter(o => o.estado !== "cerrada").length, bajos = D.repuestos.filter(r => estadoStock(r) !== "ok").length;
  $("#nav-ot").textContent = pend || ""; $("#nav-rep").textContent = bajos || "";
}

// ---------- Dashboard ----------
function dashboard(){
  const mes = hoyLocal().slice(0, 7), cm = D.cambios.filter(c => c.fecha.startsWith(mes));
  const crit = D.repuestos.filter(r => estadoStock(r) !== "ok").sort((a, b) => a.stock / Math.max(a.stock_minimo, 1) - b.stock / Math.max(b.stock_minimo, 1));
  const abiertas = D.ordenes.filter(o => o.estado !== "cerrada");
  const costoMes = cm.reduce((s, c) => s + c.cantidad * (repDe(c.repuesto_id)?.precio_unitario || 0), 0);
  const inv = D.repuestos.reduce((s, r) => s + r.stock * r.precio_unitario, 0);
  const k = [["🏭", D.maquinas.length, "Máquinas", `${D.componentes.length} componentes`, "t-blue"],
             ["🧾", abiertas.length, "OT abiertas", `${abiertas.filter(o => o.prioridad === "alta").length} de prioridad alta`, "t-violet"],
             ["⚠️", crit.length, "Repuestos en alerta", `${crit.filter(r => estadoStock(r) === "crit").length} críticos`, "t-red"],
             ["🛠️", cm.length, "Cambios del mes", `${soles(costoMes)} · Inventario ${soles(inv)}`, "t-green"]];
  $("#kpis").innerHTML = k.map(([i, v, t, s, c]) => `<div class="kpi ${c}"><div class="ic">${i}</div><div><b>${v}</b><span>${t}</span><small class="muted">${s}</small></div></div>`).join("");
  // Consumo por máquina (S/)
  const porMaq = D.maquinas.map(m => ({m, v: D.cambios.reduce((s, c) => { const r = repDe(c.repuesto_id); return ubicacion(r).maq?.id === m.id ? s + c.cantidad * r.precio_unitario : s; }, 0)})).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...porMaq.map(x => x.v));
  $("#ch-maquina").innerHTML = `<div class="bars-h">${porMaq.map(x => `<div class="row"><span>${esc(x.m.codigo)} <small class="muted">${esc(x.m.area)}</small></span><div class="track"><div class="fill" style="width:${(x.v / max * 100).toFixed(1)}%"></div></div><b class="r">${soles(x.v)}</b></div>`).join("")}</div>`;
  // Stock crítico
  $("#crit-count").textContent = crit.length + " en alerta";
  $("#dash-crit").innerHTML = crit.length ? `<div class="list-crit">${crit.slice(0, 6).map(r => { const pct = Math.min(100, r.stock / Math.max(r.stock_minimo, 1) * 100), col = estadoStock(r) === "crit" ? "var(--crit)" : "var(--warn)";
    return `<div class="it"><div style="flex:1"><b>${esc(r.nombre)}</b><div class="muted mono">${esc(r.codigo)} · mín ${r.stock_minimo}</div><div class="mini-bar"><div style="width:${pct}%;background:${col}"></div></div></div>${chipStock(r)}</div>`; }).join("")}</div>` : '<div class="empty">Todo el stock en orden ✅</div>';
  // Cambios por mes (SVG)
  const meses = []; const d0 = new Date(); for (let i = 5; i >= 0; i--){ const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); meses.push({k: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, l: d.toLocaleDateString("es-PE", {month:"short"})}); }
  meses.forEach(m => { const cs = D.cambios.filter(c => c.fecha.startsWith(m.k)); m.n = cs.length; m.v = cs.reduce((s, c) => s + c.cantidad * (repDe(c.repuesto_id)?.precio_unitario || 0), 0); });
  const W = 600, H = 200, mx = Math.max(1, ...meses.map(m => m.n)), bw = 54, gap = (W - 40 - bw * 6) / 5;
  $("#ch-mes").innerHTML = `<svg viewBox="0 -22 ${W} ${H + 52}" width="100%"><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#3b82f6" stop-opacity=".5"/></linearGradient></defs>
    ${[0, .5, 1].map(f => `<line x1="20" x2="${W - 20}" y1="${10 + H * (1 - f) * .85}" y2="${10 + H * (1 - f) * .85}" stroke="#1f2b45" stroke-dasharray="4"/>`).join("")}
    ${meses.map((m, i) => { const h = m.n / mx * H * .85, x = 20 + i * (bw + gap), y = 10 + H * .85 - h;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="8" fill="url(#g1)"><title>${m.n} cambios · ${soles(m.v)}</title></rect><text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" style="fill:#e6edf7;font-weight:700">${m.n}</text><text x="${x + bw / 2}" y="${H + 12}" text-anchor="middle">${m.l}</text><text x="${x + bw / 2}" y="${H + 26}" text-anchor="middle">${m.v ? soles(m.v).replace("S/ ", "S/") : ""}</text>`; }).join("")}</svg>`;
  // Top repuestos (donut)
  const tot = {}; D.cambios.forEach(c => tot[c.repuesto_id] = (tot[c.repuesto_id] || 0) + c.cantidad);
  const top = Object.entries(tot).map(([id, n]) => ({r: repDe(+id), n})).filter(x => x.r).sort((a, b) => b.n - a.n).slice(0, 5);
  const cols = ["#3b82f6", "#6366f1", "#22c55e", "#f59e0b", "#ef4444"], sum = top.reduce((s, x) => s + x.n, 0) || 1; let acc = 0;
  const arcs = top.map((x, i) => { const a0 = acc / sum * 2 * Math.PI, a1 = (acc += x.n) / sum * 2 * Math.PI, R = 60, cx = 75, cy = 75;
    const p = (a) => `${cx + R * Math.sin(a)},${cy - R * Math.cos(a)}`; return `<path d="M${p(a0)} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1 - 0.0001)}" stroke="${cols[i]}" stroke-width="22" fill="none"><title>${esc(x.r.nombre)}: ${x.n}</title></path>`; }).join("");
  $("#ch-top").innerHTML = top.length ? `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 150 150" width="140">${arcs}<text x="75" y="72" text-anchor="middle" style="fill:#e6edf7;font-size:22px;font-weight:800">${sum}</text><text x="75" y="90" text-anchor="middle">unidades</text></svg>
    <div style="flex:1;min-width:140px">${top.map((x, i) => `<div style="display:flex;justify-content:space-between;gap:8px;margin:6px 0;font-size:12.5px"><span><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${cols[i]};margin-right:6px"></span>${esc(x.r.nombre)}</span><b>${x.n}</b></div>`).join("")}</div></div>` : '<div class="empty">Sin cambios registrados</div>';
}

// ---------- Órdenes de trabajo ----------
function ordenes(){
  const cols = [["pendiente", "Pendiente", "⏳"], ["en_proceso", "En proceso", "⚙️"], ["cerrada", "Cerrada", "✅"]];
  const lista = D.ordenes.filter(o => !otFiltro || o.tipo === otFiltro);
  $("#kanban").innerHTML = cols.map(([e, t, i]) => { const os = lista.filter(o => o.estado === e).sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada));
    return `<div class="col"><div class="col-h"><span>${i} ${t}</span><span class="chip c-gray nodot">${os.length}</span></div>${os.map(cardOT).join("") || '<div class="empty">Sin órdenes</div>'}</div>`; }).join("");
  $$("[data-iniciar]").forEach(b => b.onclick = () => accionOT(b.dataset.iniciar, "iniciar"));
  $$("[data-cerrar]").forEach(b => b.onclick = () => accionOT(b.dataset.cerrar, "cerrar"));
}
function cardOT(o){
  const m = maqDe(o.maquina_id), its = D.ot_repuestos.filter(x => x.ot_id === o.id);
  const costo = its.reduce((s, x) => s + x.cantidad * (repDe(x.repuesto_id)?.precio_unitario || 0), 0);
  const falta = o.estado !== "cerrada" && its.some(x => (repDe(x.repuesto_id)?.stock ?? 0) < x.cantidad);
  const vencida = o.estado !== "cerrada" && o.fecha_programada < hoyLocal();
  return `<div class="ot p-${o.prioridad}"><div class="ot-top"><span class="mono">${otCod(o.id)}</span>${chipPrioridad(o.prioridad)}</div>
    <h4>${esc(o.descripcion)}</h4>
    <div class="ot-meta">${chipTipo(o.tipo)}<span>🏭 ${esc(m?.codigo)}</span><span>📅 ${fmtFecha(o.fecha_programada)}</span>${vencida ? '<span class="chip c-crit nodot">Vencida</span>' : ""}</div>
    <div class="ot-meta">${its.map(x => `<span class="chip c-gray nodot">${esc(repDe(x.repuesto_id)?.codigo)} ×${x.cantidad}</span>`).join("") || "<span>Sin repuestos previstos</span>"}${falta ? '<span class="chip c-crit nodot">Falta stock</span>' : ""}</div>
    <div class="ot-foot"><b>${soles(costo)}</b>${o.estado === "pendiente" ? `<button class="btn-sec btn-sm" data-iniciar="${o.id}">▶ Iniciar</button>` : o.estado === "en_proceso" ? `<button class="btn btn-sm" data-cerrar="${o.id}">✔ Cerrar OT</button>` : chipEstadoOT(o.estado)}</div></div>`;
}
async function accionOT(id, acc){
  if (requiereSesion()) return; id = Number(id);
  try {
    if (acc === "iniciar"){ await DB.iniciarOT(id); toast(`${otCod(id)} en proceso`, "info"); }
    else {
      const its = D.ot_repuestos.filter(x => x.ot_id === id);
      const registrar = its.length ? confirm(`¿Cerrar ${otCod(id)} y registrar ${its.length} cambio(s) de repuesto?\n\nAceptar: registra los cambios y descuenta stock.\nCancelar: no cierra la OT.`) : confirm(`¿Cerrar ${otCod(id)}?`);
      if (!registrar) return;
      await DB.cerrarOT(id, PERFIL?.nombre || "Técnico", its.length > 0);
      toast(`✅ ${otCod(id)} cerrada${its.length ? ` · ${its.length} cambio(s) registrados` : ""}`);
    }
    await refrescar();
  } catch (e){ toast("❌ " + e.message, "err"); }
}
function mostrarFormOT(v){ $("#ot-nueva").classList.toggle("hidden", !v); $("#kanban").classList.toggle("hidden", v); $("#ot-filtro").classList.toggle("hidden", v); if (v) resumenOT(); }
function renderItems(){
  $("#o-items").innerHTML = otItems.map((x, i) => { const r = repDe(x.repuesto_id); return `<div class="item-line"><span><span class="mono">${esc(r.codigo)}</span> ${esc(r.nombre)} × <b>${x.cantidad}</b></span><span style="display:flex;gap:8px;align-items:center">${chipStock(r)}<button type="button" class="x" data-del="${i}">✕</button></span></div>`; }).join("") || '<div class="muted" style="margin-top:8px;font-size:12.5px">Aún no agregas repuestos.</div>';
  $$("[data-del]").forEach(b => b.onclick = () => { otItems.splice(+b.dataset.del, 1); renderItems(); resumenOT(); });
}
function resumenOT(){
  if (!D) return; const m = maqDe(Number($("#o-maquina").value));
  const total = otItems.reduce((s, x) => s + x.cantidad * repDe(x.repuesto_id).precio_unitario, 0);
  $("#ot-resumen").innerHTML = `<h3>Resumen de la OT</h3>
    <div class="res-row"><span class="muted">Máquina</span><b>${m ? esc(m.codigo + " · " + m.nombre) : "—"}</b></div>
    <div class="res-row"><span class="muted">Tipo</span>${chipTipo($("#o-tipo").value)}</div>
    <div class="res-row"><span class="muted">Prioridad</span>${chipPrioridad($("#o-prioridad").value)}</div>
    <div class="res-row"><span class="muted">Programada</span><b>${fmtFecha($("#o-fecha").value) || "—"}</b></div>
    <h3 style="margin-top:16px">Repuestos previstos</h3>
    ${otItems.map(x => { const r = repDe(x.repuesto_id), ok = r.stock >= x.cantidad; return `<div class="res-row"><span>${esc(r.nombre)} ×${x.cantidad}<br><small class="muted">${soles(r.precio_unitario)} c/u</small></span><span style="text-align:right">${ok ? chipStock(r) : `<span class="chip c-crit">Insuficiente (${r.stock} disp.)</span>`}<br><b>${soles(x.cantidad * r.precio_unitario)}</b></span></div>`; }).join("") || '<div class="empty">Agrega repuestos para ver disponibilidad y costo</div>'}
    <div class="res-total"><span>Costo estimado</span><b>${soles(total)}</b></div>`;
}
function initFormOT(){
  $("#o-maquina").innerHTML = opts(D.maquinas, m => `${m.codigo} · ${m.nombre}`, "Selecciona máquina");
  $("#o-fecha").value = hoyLocal();
  const llenarRep = () => { const mid = Number($("#o-maquina").value);
    const reps = D.repuestos.filter(r => !mid || ubicacion(r).maq?.id === mid);
    $("#o-rep").innerHTML = opts(reps, r => `${r.codigo} · ${r.nombre} (${r.stock} disp. · ${soles(r.precio_unitario)})`, reps.length ? "Selecciona repuesto" : "Sin repuestos para esta máquina"); };
  $("#o-maquina").onchange = () => { otItems = []; llenarRep(); renderItems(); resumenOT(); };
  ["#o-tipo", "#o-prioridad", "#o-fecha"].forEach(s => $(s).oninput = resumenOT);
  llenarRep(); renderItems();
  $("#o-add").onclick = () => { const rid = Number($("#o-rep").value), q = Number($("#o-cant").value);
    if (!rid) return toast("Selecciona un repuesto", "err"); if (!Number.isInteger(q) || q <= 0) return toast("La cantidad debe ser un entero mayor a 0", "err");
    const ex = otItems.find(x => x.repuesto_id === rid); ex ? ex.cantidad += q : otItems.push({repuesto_id: rid, cantidad: q}); $("#o-cant").value = 1; renderItems(); resumenOT(); };
  $("#ot-cancelar").onclick = () => location.hash = "ot";
  $("#form-ot").onsubmit = async e => {
    e.preventDefault(); if (requiereSesion()) return;
    const o = {maquina_id: Number($("#o-maquina").value), tipo: $("#o-tipo").value, prioridad: $("#o-prioridad").value, descripcion: $("#o-desc").value.trim(), fecha_programada: $("#o-fecha").value, items: otItems};
    const er = !o.maquina_id ? "Selecciona la máquina." : !o.descripcion ? "Escribe la descripción del trabajo." : !o.fecha_programada ? "Indica la fecha programada." : null;
    if (er) return toast("❌ " + er, "err");
    try { const id = await DB.crearOT(o); toast(`✅ ${otCod(id)} creada correctamente`); otItems = []; $("#o-desc").value = ""; await refrescar(); renderItems(); location.hash = "ot"; }
    catch (x){ toast("❌ " + x.message, "err"); }
  };
  $$("#ot-filtro .pill").forEach(p => p.onclick = () => { otFiltro = p.dataset.f; $$("#ot-filtro .pill").forEach(x => x.classList.toggle("active", x === p)); ordenes(); });
}

// ---------- Máquinas ----------
function arbol(){
  $("#arbol").innerHTML = D.maquinas.map(m => { const comps = D.componentes.filter(c => c.maquina_id === m.id);
    const reps = D.repuestos.filter(r => ubicacion(r).maq?.id === m.id), alerta = reps.filter(r => estadoStock(r) !== "ok").length;
    const abiertas = D.ordenes.filter(o => o.maquina_id === m.id && o.estado !== "cerrada").length;
    return `<div class="card"><div class="maq-h"><div class="maq-ic">🏭</div><div style="flex:1"><b>${esc(m.nombre)}</b><div class="muted"><span class="mono">${esc(m.codigo)}</span> · ${esc(m.area)}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${alerta ? `<span class="chip c-bajo">${alerta} en alerta</span>` : '<span class="chip c-ok">Stock OK</span>'}${abiertas ? `<span class="chip c-info nodot">${abiertas} OT abiertas</span>` : ""}</div></div>
      ${comps.map(c => `<details class="comp" open><summary><span>⚙️ ${esc(c.nombre)}</span><span class="muted">${D.subcomponentes.filter(s => s.componente_id === c.id).length} sub</span></summary>
        ${D.subcomponentes.filter(s => s.componente_id === c.id).map(s => `<div class="sub"><b>🔧 ${esc(s.nombre)}</b><div class="reps">${D.repuestos.filter(r => r.subcomponente_id === s.id).map(r => `<span title="${esc(r.nombre)}">${chipStock(r).replace(/\((\d+) disp\.\)/, `· ${esc(r.codigo)} ($1)`)}</span>`).join("") || '<span class="muted">Sin repuestos</span>'}</div></div>`).join("")}</details>`).join("")}</div>`; }).join("");
}

// ---------- Repuestos ----------
function repuestos(){
  const q = ($("#buscar-rep").value || "").toLowerCase(), est = $("#rep-estado").value;
  const inv = D.repuestos.reduce((s, r) => s + r.stock * r.precio_unitario, 0), alert = D.repuestos.filter(r => estadoStock(r) !== "ok");
  const reponer = alert.reduce((s, r) => s + Math.max(0, r.stock_minimo * 2 - r.stock) * r.precio_unitario, 0);
  $("#rep-kpis").innerHTML = [["💰", soles(inv), "Valor de inventario", "t-green"], ["🔩", D.repuestos.length, "Repuestos registrados", "t-blue"], ["🛒", soles(reponer), `Reposición sugerida (${alert.length} ítems)`, "t-amber"]]
    .map(([i, v, t, c]) => `<div class="kpi ${c}"><div class="ic">${i}</div><div><b>${v}</b><span>${t}</span></div></div>`).join("");
  const filas = D.repuestos.filter(r => (r.nombre + r.codigo).toLowerCase().includes(q) && (!est || estadoStock(r) === est));
  $("#tabla-rep").innerHTML = filas.map(r => { const {sub, maq} = ubicacion(r);
    return `<tr><td class="mono">${esc(r.codigo)}</td><td><b>${esc(r.nombre)}</b></td><td class="muted">${esc(maq?.codigo)} › ${esc(sub?.nombre)}</td><td class="r">${soles(r.precio_unitario)}</td><td class="r"><b>${r.stock}</b></td><td class="r">${r.stock_minimo}</td><td class="r">${soles(r.stock * r.precio_unitario)}</td><td>${chipStock(r)}</td></tr>`; }).join("") || '<tr><td colspan="8" class="empty">Sin resultados</td></tr>';
}

// ---------- Historial ----------
function filasHistorial(){
  const mq = $("#h-maquina").value, de = $("#h-desde").value, ha = $("#h-hasta").value, tx = $("#h-texto").value.toLowerCase();
  return [...D.cambios].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
    .map(cambio => { const r = repDe(cambio.repuesto_id); return {cambio, r, ...ubicacion(r)}; })
    .filter(x => x.r && x.maq && (!mq || x.maq.id == mq) && (!de || x.cambio.fecha >= de) && (!ha || x.cambio.fecha <= ha)
      && (!tx || `${x.cambio.tecnico} ${x.r.nombre} ${x.r.codigo} ${x.cambio.observacion}`.toLowerCase().includes(tx)));
}
function historial(){
  const rows = filasHistorial(), total = rows.reduce((s, x) => s + x.cambio.cantidad * x.r.precio_unitario, 0);
  $("#tabla-hist").innerHTML = rows.map(({cambio, r, maq, comp, sub}) => `<tr><td>${fmtFecha(cambio.fecha)}</td><td class="mono">${esc(maq.codigo)}</td><td>${esc(comp.nombre)} <span class="muted">/ ${esc(sub.nombre)}</span></td><td>${esc(r.nombre)}</td><td class="r"><b>${cambio.cantidad}</b></td><td class="r">${soles(cambio.cantidad * r.precio_unitario)}</td><td><span class="avatar" style="display:inline-grid;width:24px;height:24px;font-size:10px;vertical-align:middle;margin-right:6px">${iniciales(cambio.tecnico)}</span>${esc(cambio.tecnico)}</td><td class="muted">${cambio.ot_id ? `<span class="chip c-violet nodot">${otCod(cambio.ot_id)}</span> ` : ""}${esc(cambio.observacion)}</td></tr>`).join("")
    + (rows.length ? `<tr><td colspan="5"><b>${rows.length} cambios</b></td><td class="r"><b>${soles(total)}</b></td><td colspan="2"></td></tr>` : '<tr><td colspan="8" class="empty">Sin resultados</td></tr>');
}
function exportarCSV(){
  const rows = filasHistorial(), csv = [["fecha","maquina","componente","subcomponente","repuesto","cantidad","costo","tecnico","observacion"], ...rows.map(({cambio, r, maq, comp, sub}) => [cambio.fecha, maq.codigo, comp.nombre, sub.nombre, r.nombre, cambio.cantidad, (cambio.cantidad * r.precio_unitario).toFixed(2), cambio.tecnico, cambio.observacion || ""])]
    .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], {type:"text/csv"})); a.download = `historial-mantoplan-${hoyLocal()}.csv`; a.click();
}

// ---------- Registrar cambio ----------
const opts = (arr, f, ph) => `<option value="">${ph}</option>` + arr.map(x => `<option value="${x.id}">${esc(f(x))}</option>`).join("");
function resumenCambio(){
  if (!D) return; const r = repDe(Number($("#f-repuesto").value)), q = Number($("#f-cantidad").value) || 0, m = maqDe(Number($("#f-maquina").value));
  $("#cambio-resumen").innerHTML = `<h3>Resumen</h3>
    <div class="res-row"><span class="muted">Máquina</span><b>${m ? esc(m.codigo) : "—"}</b></div>
    <div class="res-row"><span class="muted">Repuesto</span><b>${r ? esc(r.nombre) : "—"}</b></div>
    <div class="res-row"><span class="muted">Disponibilidad</span>${r ? chipStock(r) : "—"}</div>
    <div class="res-row"><span class="muted">Stock después del cambio</span><b>${r ? (r.stock - q >= 0 ? `${r.stock - q} ${r.stock - q <= r.stock_minimo ? '<span class="chip c-bajo nodot">bajo mínimo</span>' : ""}` : '<span class="chip c-crit nodot">Insuficiente</span>') : "—"}</b></div>
    <div class="res-row"><span class="muted">Técnico</span><b>${esc($("#f-tecnico").value) || "—"}</b></div>
    <div class="res-total"><span>Costo del cambio</span><b>${soles(r ? r.precio_unitario * q : 0)}</b></div>`;
}
function initFormCambio(){
  $("#f-fecha").value = hoyLocal();
  $("#f-maquina").innerHTML = opts(D.maquinas, m => `${m.codigo} · ${m.nombre}`, "Selecciona máquina");
  $("#h-maquina").innerHTML = opts(D.maquinas, m => `${m.codigo} · ${m.nombre}`, "Todas las máquinas");
  const cas = () => { $("#f-componente").innerHTML = opts(D.componentes.filter(c => c.maquina_id == $("#f-maquina").value), c => c.nombre, "Selecciona componente"); sub(); };
  const sub = () => { $("#f-sub").innerHTML = opts(D.subcomponentes.filter(s => s.componente_id == $("#f-componente").value), s => s.nombre, "Selecciona subcomponente"); rep(); };
  const rep = () => { const v = $("#f-repuesto").value; $("#f-repuesto").innerHTML = opts(D.repuestos.filter(r => r.subcomponente_id == $("#f-sub").value), r => `${r.codigo} · ${r.nombre} (${r.stock} disp.)`, "Selecciona repuesto"); $("#f-repuesto").value = v; resumenCambio(); };
  window.recargarRepuestosCambio = rep;
  $("#f-maquina").onchange = cas; $("#f-componente").onchange = sub; $("#f-sub").onchange = rep;
  ["#f-repuesto", "#f-cantidad", "#f-tecnico"].forEach(s => $(s).oninput = resumenCambio); cas();
  $("#form-cambio").onsubmit = async e => {
    e.preventDefault(); if (requiereSesion()) return;
    const cant = Number($("#f-cantidad").value), rid = Number($("#f-repuesto").value), tec = $("#f-tecnico").value.trim(), fecha = $("#f-fecha").value;
    const r = repDe(rid);
    const er = !rid ? "Selecciona máquina, componente, subcomponente y repuesto." : !Number.isInteger(cant) || cant <= 0 ? "La cantidad debe ser un entero mayor a 0." : cant > r.stock ? `Stock insuficiente: solo hay ${r.stock}.` : !fecha ? "Indica la fecha." : fecha > hoyLocal() ? "La fecha no puede ser futura." : !tec ? "Indica el técnico." : null;
    if (er) return toast("❌ " + er, "err");
    try { await DB.registrarCambio({fecha, repuesto_id: rid, cantidad: cant, tecnico: tec, observacion: $("#f-obs").value.trim()});
      await refrescar(); rep(); $("#f-obs").value = ""; $("#f-cantidad").value = 1; resumenCambio();
      toast(`✅ Cambio registrado: ${r.nombre} ×${cant}. Stock actual: ${repDe(rid).stock}`);
    } catch (x){ toast("❌ " + x.message, "err"); }
  };
}

// ---------- Arranque y autenticación ----------
function pintarUsuario(){
  const p = PERFIL || {nombre:"Invitado", email:"", rol:"visitante"};
  $("#u-ini").textContent = iniciales(p.nombre); $("#u-nombre").textContent = p.nombre; $("#u-email").textContent = p.email; $("#u-rol").textContent = p.rol;
  if (PERFIL) $("#f-tecnico").value = PERFIL.nombre;
}
async function iniciarApp(){
  $("#auth").classList.add("hidden"); pintarUsuario();
  if (iniciado) return; iniciado = true;
  try { D = await DB.todo(); } catch (e){ toast("Error cargando datos: " + e.message, "err"); return; }
  initFormCambio(); initFormOT(); pintarUsuario(); renderTodo();
  window.onhashchange = ir; ir();
  $("#buscar-rep").oninput = repuestos; $("#rep-estado").onchange = repuestos;
  ["#h-maquina", "#h-desde", "#h-hasta", "#h-texto"].forEach(s => $(s).oninput = historial);
}
function pantallaAuth(){
  let modo = "login"; const m = $("#a-msg");
  const set = x => { modo = x; m.className = ""; m.textContent = "";
    $("#tab-login").classList.toggle("active", x === "login"); $("#tab-signup").classList.toggle("active", x === "signup");
    $("#lbl-nombre").classList.toggle("hidden", x === "login"); $("#a-btn").textContent = x === "login" ? "Entrar" : "Crear cuenta";
    $("#a-titulo").textContent = x === "login" ? "Bienvenida de nuevo" : "Crea tu cuenta"; $("#a-sub").textContent = x === "login" ? "Ingresa con tu cuenta de la planta" : "Regístrate para gestionar el mantenimiento"; };
  $("#tab-login").onclick = () => set("login"); $("#tab-signup").onclick = () => set("signup");
  $("#form-auth").onsubmit = async e => {
    e.preventDefault();
    const nombre = $("#a-nombre").value.trim(), email = $("#a-email").value.trim(), pass = $("#a-pass").value;
    const er = modo === "signup" && !nombre ? "Escribe tu nombre." : !/^\S+@\S+\.\S+$/.test(email) ? "Escribe un correo válido." : pass.length < 6 ? "La contraseña debe tener al menos 6 caracteres." : null;
    if (er){ m.className = "msg-err"; m.textContent = "❌ " + er; return; }
    $("#a-btn").disabled = true;
    try {
      if (modo === "signup"){
        const r = await DB.crearCuenta(nombre, email, pass);
        if (r.requiereConfirmacion){ set("login"); m.className = "msg-ok"; m.textContent = "📧 Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión."; return; }
      } else await DB.iniciarSesion(email, pass);
      PERFIL = await DB.perfil(); await iniciarApp(); toast(`👋 Hola, ${PERFIL.nombre}`);
    } catch (x){ m.className = "msg-err"; m.textContent = "❌ " + x.message; }
    finally { $("#a-btn").disabled = false; }
  };
  $("#auth").classList.remove("hidden");
}
document.addEventListener("DOMContentLoaded", async () => {
  $("#modo").textContent = "Datos: " + DB.modo;
  $("#menu").onclick = () => $("#sidebar").classList.toggle("open");
  $("#logout").onclick = async () => { if (DB.usaAuth){ await DB.cerrarSesion(); location.reload(); } else if (confirm("Modo demo: ¿restaurar los datos de ejemplo?")){ DB.reset(); location.reload(); } };
  if (!DB.usaAuth) $("#logout").title = "Restaurar datos demo";
  PERFIL = await DB.perfil();
  if (DB.usaAuth && !PERFIL) return pantallaAuth();
  iniciarApp();
});
