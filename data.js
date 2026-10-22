// MantoPlan · Capa de datos: localStorage (DEMO) o Supabase según config.js
const hoyISO = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

const DEMO = () => ({
  maquinas: [
    {id:1,codigo:"HIL-01",nombre:"Hiladora de anillos 01",area:"Hilandería"},
    {id:2,codigo:"CAR-01",nombre:"Carda C-60 01",area:"Preparación"},
    {id:3,codigo:"TEL-01",nombre:"Telar de pinzas 01",area:"Tejeduría"},
    {id:4,codigo:"MAN-01",nombre:"Manuar de estiraje 01",area:"Preparación"}],
  componentes: [
    {id:1,maquina_id:1,nombre:"Tren de estiraje"},{id:2,maquina_id:1,nombre:"Sistema de husos"},
    {id:3,maquina_id:2,nombre:"Cilindro principal"},{id:4,maquina_id:2,nombre:"Sistema de chapones"},
    {id:5,maquina_id:3,nombre:"Mecanismo de inserción"},{id:6,maquina_id:3,nombre:"Lizos y marcos"},
    {id:7,maquina_id:4,nombre:"Cabezal de estiraje"}],
  subcomponentes: [
    {id:1,componente_id:1,nombre:"Cilindros superiores"},{id:2,componente_id:1,nombre:"Manguitos (cots)"},
    {id:3,componente_id:2,nombre:"Husos"},{id:4,componente_id:2,nombre:"Correa tangencial"},
    {id:5,componente_id:3,nombre:"Guarnición metálica"},{id:6,componente_id:4,nombre:"Chapones"},
    {id:7,componente_id:5,nombre:"Pinzas"},{id:8,componente_id:6,nombre:"Mallas de lizo"},
    {id:9,componente_id:7,nombre:"Rodillos de presión"}],
  repuestos: [
    {id:1,codigo:"R-1001",nombre:"Cilindro superior 28mm",subcomponente_id:1,stock:12,stock_minimo:6,precio_unitario:185},
    {id:2,codigo:"R-1002",nombre:"Manguito cot 32mm",subcomponente_id:2,stock:40,stock_minimo:50,precio_unitario:12.5},
    {id:3,codigo:"R-1003",nombre:"Huso completo",subcomponente_id:3,stock:8,stock_minimo:10,precio_unitario:320},
    {id:4,codigo:"R-1004",nombre:"Correa tangencial 40mm",subcomponente_id:4,stock:3,stock_minimo:2,precio_unitario:450},
    {id:5,codigo:"R-2001",nombre:"Guarnición cilindro (rollo)",subcomponente_id:5,stock:1,stock_minimo:2,precio_unitario:2800},
    {id:6,codigo:"R-2002",nombre:"Chapón con guarnición",subcomponente_id:6,stock:30,stock_minimo:20,precio_unitario:95},
    {id:7,codigo:"R-3001",nombre:"Pinza portadora",subcomponente_id:7,stock:6,stock_minimo:4,precio_unitario:260},
    {id:8,codigo:"R-3002",nombre:"Malla de lizo acero",subcomponente_id:8,stock:500,stock_minimo:300,precio_unitario:1.8},
    {id:9,codigo:"R-4001",nombre:"Rodillo de presión",subcomponente_id:9,stock:4,stock_minimo:4,precio_unitario:210}],
  cambios: [
    {id:1,fecha:hoyISO(-1),repuesto_id:2,cantidad:10,tecnico:"Luis Quispe",observacion:"Desgaste por uso"},
    {id:2,fecha:hoyISO(-4),repuesto_id:7,cantidad:2,tecnico:"Ana Huamán",observacion:"Pinza rota"},
    {id:3,fecha:hoyISO(-8),repuesto_id:3,cantidad:2,tecnico:"Luis Quispe",observacion:""},
    {id:4,fecha:hoyISO(-39),repuesto_id:5,cantidad:1,tecnico:"Carlos Mamani",observacion:"Cambio preventivo"},
    {id:5,fecha:hoyISO(-70),repuesto_id:1,cantidad:4,tecnico:"Ana Huamán",observacion:"Preventivo trimestral"},
    {id:6,fecha:hoyISO(-100),repuesto_id:8,cantidad:60,tecnico:"Carlos Mamani",observacion:"Cambio de mallas"}],
  ordenes: [
    {id:1,maquina_id:2,tipo:"preventivo",prioridad:"alta",descripcion:"Cambio de guarnición del cilindro principal",fecha_programada:hoyISO(3),estado:"pendiente"},
    {id:2,maquina_id:1,tipo:"correctivo",prioridad:"media",descripcion:"Ruido en tren de estiraje, revisar manguitos",fecha_programada:hoyISO(0),estado:"en_proceso"},
    {id:3,maquina_id:3,tipo:"preventivo",prioridad:"baja",descripcion:"Revisión de pinzas y mallas de lizo",fecha_programada:hoyISO(-6),estado:"cerrada"}],
  ot_repuestos: [{id:1,ot_id:1,repuesto_id:5,cantidad:1},{id:2,ot_id:2,repuesto_id:2,cantidad:8},{id:3,ot_id:2,repuesto_id:1,cantidad:2},{id:4,ot_id:3,repuesto_id:7,cantidad:2}]
});

const cfg = window.MANTOPLAN_CONFIG || {};
const sb = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const KEY = "mantoplan_demo_v2";
const load = () => { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); const c = DEMO(); localStorage.setItem(KEY, JSON.stringify(c)); return c; };
const save = db => localStorage.setItem(KEY, JSON.stringify(db));
const nextId = arr => Math.max(0, ...arr.map(x => x.id)) + 1;
const err = e => { throw new Error(traducir(e.message || "Error inesperado")); };
function traducir(m){
  const t = {"Invalid login credentials":"Correo o contraseña incorrectos","Email not confirmed":"Aún no confirmas tu correo. Revisa tu bandeja de entrada","User already registered":"Ese correo ya tiene una cuenta"};
  if (/permission denied/i.test(m)) return "No tienes permiso. Inicia sesión nuevamente.";
  return t[m] || (/Password should be/i.test(m) ? "La contraseña debe tener al menos 6 caracteres" : m);
}

window.DB = {
  modo: sb ? "Supabase" : "Demo local",
  usaAuth: !!sb,
  async todo(){
    if (!sb) return load();
    const map = {maquinas:"maquinas",componentes:"componentes",subcomponentes:"subcomponentes",repuestos:"repuestos",cambios:"cambios",ordenes:"ordenes_trabajo",ot_repuestos:"ot_repuestos"};
    const res = await Promise.all(Object.values(map).map(t => sb.from(t).select("*").order("id")));
    const out = {}; Object.keys(map).forEach((k, i) => { if (res[i].error) err(res[i].error); out[k] = res[i].data; });
    out.repuestos.forEach(r => r.precio_unitario = Number(r.precio_unitario));
    return out;
  },
  async registrarCambio(c){
    if (!sb){
      const db = load(), r = db.repuestos.find(x => x.id === c.repuesto_id);
      if (!r) throw new Error("Repuesto no encontrado");
      if (c.cantidad > r.stock) throw new Error(`Stock insuficiente: solo hay ${r.stock}`);
      r.stock -= c.cantidad; db.cambios.push({...c, id: nextId(db.cambios)}); save(db); return;
    }
    const {error} = await sb.rpc("registrar_cambio", {p_repuesto_id:c.repuesto_id, p_cantidad:c.cantidad, p_fecha:c.fecha, p_tecnico:c.tecnico, p_observacion:c.observacion});
    if (error) err(error);
  },
  async crearOT(o){
    if (!sb){
      const db = load(), id = nextId(db.ordenes);
      db.ordenes.push({id, maquina_id:o.maquina_id, tipo:o.tipo, prioridad:o.prioridad, descripcion:o.descripcion, fecha_programada:o.fecha_programada, estado:"pendiente"});
      o.items.forEach(i => db.ot_repuestos.push({id: nextId(db.ot_repuestos), ot_id:id, repuesto_id:i.repuesto_id, cantidad:i.cantidad}));
      save(db); return id;
    }
    const {data, error} = await sb.rpc("crear_ot", {p_maquina_id:o.maquina_id, p_tipo:o.tipo, p_prioridad:o.prioridad, p_descripcion:o.descripcion, p_fecha:o.fecha_programada, p_items:o.items});
    if (error) err(error); return data;
  },
  async iniciarOT(id){
    if (!sb){ const db = load(); db.ordenes.find(x => x.id === id).estado = "en_proceso"; save(db); return; }
    const {error} = await sb.from("ordenes_trabajo").update({estado:"en_proceso"}).eq("id", id);
    if (error) err(error);
  },
  async cerrarOT(id, tecnico, registrar){
    if (!sb){
      const db = load(), ot = db.ordenes.find(x => x.id === id), items = db.ot_repuestos.filter(x => x.ot_id === id);
      if (registrar) for (const it of items){ const r = db.repuestos.find(x => x.id === it.repuesto_id); if (r.stock < it.cantidad) throw new Error(`Stock insuficiente de ${r.nombre}`); }
      if (registrar) items.forEach(it => { db.repuestos.find(x => x.id === it.repuesto_id).stock -= it.cantidad;
        db.cambios.push({id: nextId(db.cambios), fecha: hoyISO(), repuesto_id: it.repuesto_id, cantidad: it.cantidad, tecnico, observacion: "Cierre de OT-" + String(id).padStart(4,"0"), ot_id: id}); });
      ot.estado = "cerrada"; save(db); return;
    }
    const {error} = await sb.rpc("cerrar_ot", {p_ot_id:id, p_tecnico:tecnico, p_registrar:registrar});
    if (error) err(error);
  },
  // ---- Autenticación (solo modo Supabase) ----
  async perfil(){
    if (!sb) return {email:"demo@mantoplan.local", nombre:"Usuario Demo", rol:"planner"};
    const {data:{session}} = await sb.auth.getSession(); if (!session) return null;
    const {data} = await sb.from("perfiles").select("nombre,rol").eq("id", session.user.id).maybeSingle();
    return {email: session.user.email, nombre: data?.nombre || session.user.user_metadata?.nombre || session.user.email, rol: data?.rol || "tecnico"};
  },
  async crearCuenta(nombre, email, password){
    const {data, error} = await sb.auth.signUp({email, password, options:{data:{nombre}, emailRedirectTo: location.origin + location.pathname}});
    if (error) err(error); return {requiereConfirmacion: !data.session};
  },
  async iniciarSesion(email, password){ const {error} = await sb.auth.signInWithPassword({email, password}); if (error) err(error); },
  async cerrarSesion(){ if (sb) await sb.auth.signOut(); },
  reset(){ localStorage.removeItem(KEY); }
};
