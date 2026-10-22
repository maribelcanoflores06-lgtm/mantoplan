# ⚙️ MantoPlan — Gestión de mantenimiento para planta textil

Web para gestionar máquinas, componentes, subcomponentes, repuestos, stock y el historial de cambios. Proyecto final del curso de Vibe Coding.

> Los datos incluidos son **de ejemplo** (hiladoras, cardas, telares, manuares).

## Funcionalidades
- Dashboard con KPIs (máquinas, stock bajo, cambios del mes)
- Árbol Máquina → Componente → Subcomponente → Repuestos
- Repuestos con alertas de stock mínimo
- Registro de cambio de repuesto con validaciones (descuenta stock + historial)
- Historial con filtros (máquina, fechas, texto)

## Ejecutar en local
No requiere instalación. Opción simple: abre `index.html` en el navegador.
Recomendado (servidor local):
```bash
npx serve .        # o: python3 -m http.server 8000
```
Abre http://localhost:3000 (o :8000). Los datos se guardan en `localStorage`; usa "Restaurar datos demo" para reiniciarlos.

## Conectar Supabase (opcional)
1. Crea un proyecto en https://supabase.com
2. En **SQL Editor** ejecuta `supabase/schema.sql` (tablas, relaciones, función `registrar_cambio` y datos de ejemplo).
3. En **Project Settings → API** copia la URL y la *anon key* y pégalas en `config.js`.
4. Recarga: en la barra lateral verás "Modo de datos: Supabase".

## Subir a GitHub
```bash
git init
git add .
git commit -m "MantoPlan: proyecto final"
git branch -M main
git remote add origin https://github.com/maribelcanoflores06-lgtm/mantoplan.git
git push -u origin main
```

## Desplegar
**Vercel:** vercel.com → Add New Project → importa el repo → Framework: *Other* → Deploy (sin build).
**GitHub Pages:** repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save. URL: `https://maribelcanoflores06-lgtm.github.io/mantoplan/`.

## Estructura
```
index.html  config.js  css/styles.css  js/data.js  js/app.js
supabase/schema.sql  .agents/rules/fullstack-engineer.md  product-brief.pdf
```
