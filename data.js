// Capa de datos: localStorage (demo) o Supabase según config.js
const DEMO = (() => {
  const hoy = new Date(); const d = n => { const x = new Date(hoy); x.setDate(x.getDate() - n); return x.toISOString().slice(0,10); };
  return {
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
      {id:1,codigo:"R-1001",nombre:"Cilindro superior 28mm",subcomponente_id:1,stock:12,stock_minimo:6},
      {id:2,codigo:"R-1002",nombre:"Manguito cot 32mm",subcomponente_id:2,stock:40,stock_minimo:50},
      {id:3,codigo:"R-1003",nombre:"Huso completo",subcomponente_id:3,stock:8,stock_minimo:10},
      {id:4,codigo:"R-1004",nombre:"Correa tangencial 40mm",subcomponente_id:4,stock:3,stock_minimo:2},
      {id:5,codigo:"R-2001",nombre:"Guarnición cilindro (rollo)",subcomponente_id:5,stock:1,stock_minimo:2},
      {id:6,codigo:"R-2002",nombre:"Chapón con guarnición",subcomponente_id:6,stock:30,stock_minimo:20},
      {id:7,codigo:"R-3001",nombre:"Pinza portadora",subcomponente_id:7,stock:6,stock_minimo:4},
      {id:8,codigo:"R-3002",nombre:"Malla de lizo acero",subcomponente_id:8,stock:500,stock_minimo:300},
      {id:9,codigo:"R-4001",nombre:"Rodillo de presión",subcomponente_id:9,stock:4,stock_minimo:4}],
    cambios: [
      {id:1,fecha:d(2),repuesto_id:2,cantidad:10,tecnico:"Luis Quispe",observacion:"Desgaste por uso"},
      {id:2,fecha:d(5),repuesto_id:7,cantidad:2,tecnico:"Ana Huamán",observacion:"Pinza rota"},
      {id:3,fecha:d(9),repuesto_id:3,cantidad:2,tecnico:"Luis Quispe",observacion:""},
      {id:4,fecha:d(40),repuesto_id:5,cantidad:1,tecnico:"Carlos Mamani",observacion:"Cambio preventivo"}]
  };
})();

const cfg = window.MANTOPLAN_CONFIG || {};
const usarSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
const KEY = "mantoplan_demo_v1";
const sb = usarSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

function traducir(m){
  const t = {"Invalid login credentials":"Correo o contraseña incorrectos","Email not confirmed":"Aún no confirmas tu correo. Revisa tu bandeja de entrada","User already registered":"Ese correo ya tiene una cuenta"};
  return t[m] || (/Password should be/i.test(m) ? "La contraseña debe tener al menos 6 caracteres" : m);
}
function load(){ const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); const c = structuredClone(DEMO); localStorage.setItem(KEY, JSON.stringify(c)); return c; }
function save(db){ localStorage.setItem(KEY, JSON.stringify(db)); }

window.DB = {
  modo: usarSupabase ? "Supabase" : "Demo (localStorage)",
  async todo(){
    if (!sb) return load();
    const t = ["maquinas","componentes","subcomponentes","repuestos","cambios"]; const out = {};
    for (const n of t){ const {data,error} = await sb.from(n).select("*").order("id"); if (error) throw error; out[n]=data; }
    return out;
  },
  async registrarCambio(c){
    if (!sb){
      const db = load(); const r = db.repuestos.find(x=>x.id===c.repuesto_id);
      if (!r) throw new Error("Repuesto no encontrado");
      if (c.cantidad > r.stock) throw new Error(`Stock insuficiente: hay ${r.stock}`);
      r.stock -= c.cantidad; c.id = Math.max(0,...db.cambios.map(x=>x.id))+1; db.cambios.push(c); save(db); return c;
    }
    const {error} = await sb.rpc("registrar_cambio",{p_repuesto_id:c.repuesto_id,p_cantidad:c.cantidad,p_fecha:c.fecha,p_tecnico:c.tecnico,p_observacion:c.observacion});
    if (error) throw new Error(error.message || "No se pudo registrar el cambio"); return c;
  },
  // ---- Autenticación (solo modo Supabase) ----
  async sesion(){ if (!sb) return null; const {data} = await sb.auth.getSession(); return data.session; },
  async perfil(){
    if (!sb) return null; const s = await this.sesion(); if (!s) return null;
    const {data} = await sb.from("perfiles").select("nombre,rol").eq("id", s.user.id).maybeSingle();
    return {email: s.user.email, nombre: data?.nombre || s.user.user_metadata?.nombre || s.user.email, rol: data?.rol || "tecnico"};
  },
  async crearCuenta(nombre, email, password){
    const {data, error} = await sb.auth.signUp({email, password, options:{data:{nombre}, emailRedirectTo: location.origin + location.pathname}});
    if (error) throw new Error(traducir(error.message));
    return {requiereConfirmacion: !data.session};
  },
  async iniciarSesion(email, password){
    const {error} = await sb.auth.signInWithPassword({email, password});
    if (error) throw new Error(traducir(error.message));
  },
  async cerrarSesion(){ if (sb) await sb.auth.signOut(); },
  usaAuth: !!sb,
  reset(){ localStorage.removeItem(KEY); }
};
