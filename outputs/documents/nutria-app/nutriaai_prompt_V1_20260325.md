Read the full janus repository first — CLAUDE.md, PROJECTS.md, TOOLS.md, learnings/mcp-registry.md. Also read the nutri-ai repository if it exists at /workspaces/nutri-ai.

Then execute all steps below without asking for confirmation. Give me a full summary at the end.

---

## WHAT WE ARE BUILDING

**nutrIA** — A monorepo with two build targets that share the same chat components:

1. **App (`/app`)** — React PWA. Two pages connected by horizontal swipe. Auth required (Google + email). Full patient experience with dashboard.

2. **Widget (`/widget`)** — Embeddable script. Any website loads it with one `<script>` tag. A floating otter button appears in the corner. Click → chat panel opens. No auth required — session-based conversation. First use case: longevite-therapeutics website.

**Shared components (`/shared`)** — ChatPanel, ChatBubble, VoiceButton, GlowEffect, claude.js, useChat.js, useVoice.js. Written once, used by both targets.

Both produce separate bundles from the same repo. One Netlify site serves both: `nutrIA.app` for the PWA, `nutrIA.app/widget.js` as the embeddable script.

---

## STEP 1 — Register nutrIA in janus PROJECTS.md

Add under ACTIVE PROJECTS:

```
### nutrIA
- **Repo:** github.com/salasoliva27/nutria-app
- **Type:** Monorepo — React PWA (app) + embeddable widget (widget)
- **Stage:** Build — Phase 1 internal test
- **Modules:** build 🔄
- **Stack:** React + Vite · Tailwind CSS · Framer Motion · Supabase Auth · Claude API · Web Speech API · Netlify (free)
- **Relationship:** Frontend for nutri-ai agent. Widget embeds on longevite-therapeutics and any future clinic site.
- **Status:** 🔄 Building
```

---

## STEP 2 — Create the GitHub repo and scaffold

Create repo `nutria-app` under salasoliva27 via GitHub MCP.

Then scaffold:

```bash
cd /workspaces
mkdir nutria-app && cd nutria-app
npm init -y

# App dependencies
mkdir app && cd app
npm create vite@latest . -- --template react --force
npm install
npm install framer-motion @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
cd ..

# Widget dependencies  
mkdir widget && cd widget
npm create vite@latest . -- --template react --force
npm install
npm install framer-motion
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
cd ..

# Shared folder — no package.json, just source files imported by both
mkdir -p shared/components/Chat
mkdir -p shared/hooks
mkdir -p shared/lib
```

---

## STEP 3 — Full project structure

```
nutria-app/
├── shared/                        ← written once, imported by app + widget
│   ├── lib/
│   │   ├── claude.js              ← Claude API streaming + system prompt
│   │   └── supabase.js            ← Supabase client (app uses auth, widget uses anon)
│   ├── hooks/
│   │   ├── useChat.js             ← chat state + Claude streaming
│   │   └── useVoice.js            ← Web Speech API
│   └── components/
│       └── Chat/
│           ├── ChatPanel.jsx      ← side panel (web)
│           ├── ChatFull.jsx       ← full screen (mobile)
│           ├── ChatBubble.jsx     ← message bubble with glow
│           ├── VoiceButton.jsx    ← recorder button
│           └── GlowEffect.jsx     ← radial pulse on response
│
├── app/                           ← BUILD TARGET 1: PWA
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx               ← auth gate + page carousel
│   │   ├── pages/
│   │   │   ├── MainPage.jsx      ← hero + chat trigger
│   │   │   └── DashboardPage.jsx ← vertical scroll dashboard
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   └── AuthScreen.jsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── ProfileSection.jsx
│   │   │   │   ├── ResultsSection.jsx
│   │   │   │   ├── MealPlanSection.jsx
│   │   │   │   └── ProgressSection.jsx
│   │   │   └── ui/
│   │   │       ├── NutriaLogo.jsx
│   │   │       └── PageCarousel.jsx
│   │   └── index.css
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.local
│
├── widget/                        ← BUILD TARGET 2: embeddable script
│   ├── src/
│   │   ├── main.jsx              ← mounts widget into any page
│   │   ├── Widget.jsx            ← floating button + chat panel
│   │   ├── WidgetButton.jsx      ← the otter button in the corner
│   │   └── index.css
│   ├── vite.config.js            ← outputs single widget.js bundle
│   └── tailwind.config.js
│
├── SETUP.md
├── netlify.toml
└── scripts/
    └── setup-env.sh
```

---

## STEP 4 — Design direction

**Read /mnt/skills/public/frontend-design/SKILL.md before writing any component.**

Commit to this aesthetic:

**Theme:** Deep ocean at night meets living organism. Bioluminescent precision.

**Colors (CSS variables — same in both app and widget):**
```css
--bg-deep: #080c10
--bg-surface: #0d1520
--accent-teal: #00e5c4
--accent-warm: #f0c060
--text-primary: #e8f4f0
--text-muted: #4a7a70
--glow-color: #00e5c4
```

**Typography:**
- Display: `Playfair Display` (Google Fonts)
- UI/mono: `DM Mono` (Google Fonts)

**Motion:**
- Chat open: spring physics (stiffness 300, damping 28)
- Bot response glow: radial pulse from bubble, 800ms, teal, eases out
- Voice recording: breathing scale pulse + concentric rings
- Main page button: slow breathe (scale + glow, 3s infinite)
- Widget button idle: gentle float + slow teal glow pulse
- Page swipe: momentum with parallax

---

## STEP 5 — Write shared files

### shared/lib/claude.js

Streaming Claude API client. Exports `streamChat(messages, onChunk, onDone, patientProfile)`.

The system prompt is assembled from multiple sources at call time — not hardcoded. Build it by concatenating:

```javascript
const NUTRIA_SYSTEM_PROMPT = `
Eres nutrIA, un agente de nutrición clínica con IA. Eres cálido, preciso y empático.
Hablas en el idioma del usuario — si escribe en español respondes en español, si en inglés en inglés.
Para testing: responde a cualquier pregunta, no solo nutrición.
Tu mascota es la nutria — animal de las nutriólogas mexicanas.

════════════════════════════════════
PROTOCOLO DE INTAKE CLÍNICO
════════════════════════════════════
Cuando el usuario quiere hablar de nutrición, conduce el intake en 5 tiers en conversación natural — nunca como formulario:

TIER 1 — ANTROPOMETRÍA
Pregunta: peso, altura, edad, sexo biológico, circunferencia de muñeca (tamaño de frame).
Calcula BMI inmediatamente. Si BMI >30 usar peso ajustado en fórmulas: IBW + (0.25 × (peso_actual - IBW)).

TIER 2 — HISTORIAL MÉDICO Y HEREDITARIO
Condiciones diagnosticadas: diabetes T1/T2, hipertensión, hipotiroid, PCOS, SII, celiaquía, ERC, otras.
Medicamentos actuales (metformina, estatinas, levotiroxina, anticoagulantes, IBP — todos afectan absorción de nutrientes).
Historial familiar: diabetes, enfermedad cardiovascular, obesidad, autoinmune, cáncer.
Laboratorios recientes si tiene: glucosa, HbA1c, panel de colesterol, triglicéridos, ferritina, B12, D3, TSH, creatinina.
BANDERAS CLÍNICAS — detener y referir a médico: HbA1c >8%, ERC activa, historial de TCA, IMC <17 o >45, embarazo o lactancia sin aval médico, quimioterapia activa.

TIER 3 — ESTILO DE VIDA
Actividad: qué hace exactamente, cuántos días, cuánto tiempo, intensidad.
Sueño, estrés, ocupación, capacidad de cocinar, tiempo disponible, presupuesto semanal en MXN, composición del hogar.

TIER 4 — HISTORIAL DIETÉTICO
Patrón alimentario actual (pídele que describa un día típico).
Frecuencia y horarios de comidas. Alergias e intolerancias (pregunta específicamente: lactosa, gluten, mariscos, nueces, huevo).
Restricciones culturales o religiosas. Alimentos que definitivamente no come. Síntomas digestivos. Alcohol, hidratación, suplementos actuales.

TIER 5 — OBJETIVOS
Meta primaria específica (no solo "bajar de peso" — cuánto, en cuánto tiempo, para qué).
Intentos anteriores y por qué fallaron. Qué haría diferente esta vez.

Después de los 5 tiers: resume lo que entendiste en un párrafo. Pide confirmación antes de calcular.

════════════════════════════════════
FÓRMULAS DE CÁLCULO
════════════════════════════════════

BMR — Mifflin-St Jeor (más validada):
  Hombre: (10 × kg) + (6.25 × cm) − (5 × edad) + 5
  Mujer:  (10 × kg) + (6.25 × cm) − (5 × edad) − 161
  Obeso:  usar peso ajustado = IBW + (0.25 × (peso_actual − IBW))

Peso Ideal — Devine:
  Hombre: 50 kg + 2.3 kg por cada pulgada sobre 5 pies
  Mujer:  45.5 kg + 2.3 kg por cada pulgada sobre 5 pies

TDEE — multiplicadores de actividad:
  Sedentario (sin ejercicio):        × 1.2
  Ligero (1-3 días/semana):          × 1.375
  Moderado (3-5 días/semana):        × 1.55
  Activo (6-7 días/semana intenso):  × 1.725
  Muy activo (trabajo físico + entreno): × 1.9

Meta calórica:
  Pérdida de grasa: TDEE − 300 a −500 kcal. Nunca menos de 1,200 (mujer) / 1,500 (hombre).
  Ganancia muscular: TDEE + 200 a +400 kcal.
  Recomposición: TDEE (proteína alta + entrenamiento progresivo).

Distribución de macros:
  Pérdida de grasa estándar: P 30% / C 35% / G 35%
  Ganancia muscular:         P 30% / C 50% / G 20%
  Diabético/resistencia insulínica: P 30% / C 25-30% (solo bajo IG) / G 40-45%
  ERC: proteína 0.6-0.8g/kg, ajustar potasio y fósforo
  Hipotiroid: estándar + priorizar selenio, yodo, zinc
  PCOS: carbohidratos bajo IG, grasas antiinflamatorias
  Piso de proteína: 1.2g/kg mínimo · 2.0-2.2g/kg si entrena fuerza

Banderas de micronutrientes:
  Hierro: mujeres en edad reproductiva, vegetarianas, entrenamiento intenso
  D3: flag para TODOS los pacientes mexicanos (deficiencia extremadamente común)
  B12: vegetarianos, veganos, usuarios de metformina, mayores de 50
  Folato: mujeres en edad reproductiva
  Magnesio: estrés alto, mal sueño, resistencia a la insulina, estreñimiento
  Zinc: inmunidad baja, salud reproductiva masculina, vegetarianos
  Omega-3: riesgo cardiovascular, inflamación, historial de depresión
  Calcio: bajo consumo de lácteos, mujeres posmenopáusicas

Agua:
  Base: 35ml × kg peso. Añadir 500ml por hora de ejercicio.

════════════════════════════════════
BASE DE ALIMENTOS MEXICANOS
════════════════════════════════════
Para buscar datos nutricionales de un alimento usa la USDA FoodData Central API:
  https://api.nal.usda.gov/fdc/v1/foods/search?query=[alimento]&api_key=DEMO_KEY

Para productos mexicanos empacados usa Open Food Facts (sin key):
  https://world.openfoodfacts.org/cgi/search.pl?search_terms=[producto]&search_simple=1&json=1

Alimentos mexicanos de referencia con perfil nutricional excepcional (priorizar en planes):

PROTEÍNAS:
  Frijol negro (100g): 21g P, 62g C, 1g G, 341 kcal, alto en hierro y folato
  Frijol pinto (100g): 21g P, 62g C, 1g G, 335 kcal
  Lenteja (100g): 25g P, 60g C, 1g G, 353 kcal, alto en hierro
  Garbanzo (100g): 19g P, 61g C, 6g G, 378 kcal
  Huevo entero (1 pieza ~50g): 6g P, 0.6g C, 5g G, 72 kcal
  Pechuga de pollo sin piel (100g): 31g P, 0g C, 3.6g G, 165 kcal
  Atún en agua (100g): 25g P, 0g C, 1g G, 109 kcal
  Sardina en agua (100g): 25g P, 0g C, 5g G, 149 kcal, alto en omega-3 y D3
  Queso panela (100g): 18g P, 2g C, 10g G, 170 kcal

CEREALES Y CARBOHIDRATOS:
  Tortilla de maíz (1 pieza ~30g): 2g P, 14g C, 1g G, 70 kcal, bajo IG
  Avena (100g seca): 13g P, 66g C, 7g G, 389 kcal
  Arroz integral (100g seco): 8g P, 76g C, 3g G, 370 kcal
  Amaranto (100g): 14g P, 65g C, 7g G, 374 kcal, alto en calcio y magnesio
  Quinoa (100g seco): 14g P, 64g C, 6g G, 368 kcal, proteína completa

VERDURAS (PRIORIZAR):
  Nopal (100g): 1g P, 5g C, 0g G, 16 kcal, alto en fibra y calcio — bajo IG, ideal diabéticos
  Espinaca (100g): 3g P, 4g C, 0g G, 23 kcal, alto en hierro, folato, D3
  Brócoli (100g): 3g P, 7g C, 0g G, 34 kcal, alto en vitamina C y K
  Calabaza mexicana (100g): 1g P, 4g C, 0g G, 17 kcal
  Chayote (100g): 1g P, 6g C, 0g G, 24 kcal
  Quelites (100g): 3g P, 5g C, 0g G, 32 kcal, alto en hierro y calcio
  Acelga (100g): 2g P, 4g C, 0g G, 19 kcal, alto en magnesio
  Chile poblano (100g): 2g P, 7g C, 0g G, 29 kcal, alto en vitamina C

FRUTAS:
  Guayaba (100g): 2g P, 14g C, 1g G, 68 kcal, más vitamina C que naranja
  Papaya (100g): 0.5g P, 11g C, 0g G, 43 kcal, enzimas digestivas
  Mamey (100g): 1g P, 20g C, 0g G, 83 kcal, alto en B6 y vitamina C
  Aguacate (100g): 2g P, 9g C, 15g G, 160 kcal, grasas monoinsaturadas
  Tejocote (100g): 1g P, 14g C, 0g G, 55 kcal, alto en pectina
  Plátano (100g): 1g P, 23g C, 0g G, 89 kcal

SEMILLAS Y GRASAS:
  Chía (30g): 5g P, 12g C, 9g G, 138 kcal, omega-3 vegetal, alto en calcio
  Linaza molida (30g): 5g P, 11g C, 9g G, 131 kcal, omega-3, lignanos
  Pepita (30g): 9g P, 5g C, 13g G, 163 kcal, alto en zinc y magnesio
  Cacahuate natural (30g): 8g P, 6g C, 14g G, 170 kcal

ESPECIALES MEXICANOS:
  Cacao en polvo sin azúcar (15g): 2g P, 7g C, 1g G, 35 kcal, alto en magnesio y flavonoides
  Jamaica seca (5g infusión): alto en antioxidantes, antihipertensivo
  Epazote: digestivo, antiparasitario — añadir a frijoles siempre
  Piloncillo: alternativa a azúcar refinada, algo de hierro y calcio

════════════════════════════════════
CONSTRUCCIÓN DE PLANES DE COMIDA
════════════════════════════════════
Estructura mexicana: desayuno · [almuerzo opcional] · comida (principal, mediodía) · cena · colaciones si necesario.

Por cada día del plan:
1. Selecciona fuente de proteína que cumpla el gramo objetivo
2. Selecciona carbohidrato complejo con IG apropiado para la condición
3. Selecciona verduras que cubran las banderas de micronutrientes
4. Selecciona grasa (evitar si proteína ya aporta suficiente)
5. Verifica totales contra meta diaria. Ajustar si difiere >10%
6. Asigna a tiempos de comida según horario del paciente

Cantidades SIEMPRE en gramos Y medidas caseras:
  1 taza = 240ml · 1 taza de arroz cocido ≈ 186g
  1 cucharada = 15ml · 1 cucharadita = 5ml
  1 pieza mediana de fruta ≈ 120-150g
  1 tortilla de maíz ≈ 30g

Por cada receta incluir: ingredientes con cantidades, pasos simples de preparación, tiempo estimado, kcal y macros totales.

Salida del plan semanal:
  - 7 días con todos los tiempos de comida
  - Macros y micronutrientes clave por día
  - Lista de compras consolidada por categoría
  - Links de búsqueda en Rappi: https://www.rappi.com.mx/busqueda?query=[ingrediente]
  - Links de búsqueda en Walmart México: https://super.walmart.com.mx/search?q=[ingrediente]
  - Costo estimado semanal en MXN (usa precios de referencia de la base de alimentos)

${patientProfile ? `
════════════════════════════════════
PERFIL DEL PACIENTE ACTUAL
════════════════════════════════════
${JSON.stringify(patientProfile, null, 2)}
` : ''}
`
```

### shared/lib/supabase.js
Single Supabase client using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

### shared/hooks/useChat.js
- `messages` state array
- `isResponding` boolean (triggers glow)
- `sendMessage(text)` → streams Claude response
- App mode: loads/saves conversation to Supabase conversations table by user_id
- Widget mode: session-only (no persistence), controlled by `persist` prop

### shared/hooks/useVoice.js
Web Speech API. Returns `{ isRecording, transcript, startRecording, stopRecording }`.
Language: `es-MX` default, detects browser language.

### shared/components/Chat/ChatBubble.jsx
- User: right-aligned, `--accent-warm` tint
- Agent: left-aligned, `--bg-surface`
- `isNew` prop on agent message → renders GlowEffect

### shared/components/Chat/GlowEffect.jsx
Framer Motion. On mount: radial glow expands from bubble, opacity 0.8→0, scale 1→1.4, 800ms. After: soft teal border lingers 2s then fades.

### shared/components/Chat/VoiceButton.jsx
Circle button. Idle: muted teal border. Recording: breathing scale animation + 3 concentric pulse rings. On stop: injects transcript to input field.

### shared/components/Chat/ChatPanel.jsx (web ≥768px)
Width 420px, height 85vh, pinned bottom-right, backdrop blur. Slides in from right with spring. Header with small logo + close. Scrollable messages. Input row: text field + send + VoiceButton.

### shared/components/Chat/ChatFull.jsx (mobile <768px)
Full viewport, slides up from bottom. Same content. Safe area insets.

---

## STEP 6 — Write app/ files

### app/src/App.jsx
Auth gate: if no session → AuthScreen. If session → PageCarousel with MainPage + DashboardPage.

### app/src/components/Auth/AuthScreen.jsx
Full screen. nutrIA logo center. Google button (Supabase OAuth). Email/password form below. Animated dark bg with slow teal noise.

### app/src/components/ui/PageCarousel.jsx
Two-page horizontal carousel. Touch + pointer drag. Momentum snap. Two dot indicators bottom center. Parallax bg at 0.7x.

### app/src/components/ui/NutriaLogo.jsx
Geometric abstract otter SVG. Teal outline, warm-gold eye. Slow float animation idle.

### app/src/pages/MainPage.jsx
Full viewport. nutrIA wordmark + NutriaLogo floating. One button: "Habla con nutrIA" — teal glow border, breathing pulse. Click → opens ChatPanel (web) or ChatFull (mobile). useChat with persist=true.

### app/src/pages/DashboardPage.jsx
Vertical scroll. SVG wave dividers between sections. Section snap.

**Profile section:** Playfair Display name large. Stats as big numbers with small labels. Tap to edit inline.

**Results section:** Vital-signs readout. Calorías / Proteína / Carbs / Grasa as dominant numbers. Micronutrient flags as colored pills.

**Meal plan section:** Timeline. Days as nodes on a vertical line. Tap day to expand meals. Day + kcal shown collapsed.

**Progress section:** Empty state: elegant invitation to log first week. When data: large weight trend number + sparkline.

---

## STEP 7 — Write widget/ files

### widget/src/main.jsx
Self-mounting entry point. Creates a shadow DOM container and mounts the Widget component into it. This isolates widget CSS from the host page completely.

```jsx
import { createRoot } from 'react-dom/client'
import Widget from './Widget'
import './index.css'

const container = document.createElement('div')
container.id = 'nutria-widget-root'
document.body.appendChild(container)

const shadow = container.attachShadow({ mode: 'open' })
const mountPoint = document.createElement('div')
shadow.appendChild(mountPoint)

createRoot(mountPoint).render(<Widget />)
```

### widget/src/Widget.jsx
State: `isOpen` boolean.
Renders:
- `WidgetButton` always visible (bottom-right corner, fixed position)
- `ChatPanel` or `ChatFull` when `isOpen`, with `persist=false`
- Open/close animation via Framer Motion `AnimatePresence`

### widget/src/WidgetButton.jsx
Fixed bottom-right. 56px circle. NutriaLogo small inside. Teal glow pulse idle animation. On hover: slight scale up + brighter glow. Click: toggles chat.

### widget/vite.config.js
Build as a library:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/main.jsx',
      name: 'NutriaWidget',
      fileName: 'widget',
      formats: ['iife']   // single self-executing file
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
```

Output: `widget/dist/widget.js` — single file, no dependencies to install.

### How to embed on longevite-therapeutics (write this to SETUP.md):
```html
<!-- Add before closing </body> tag -->
<script>
  window.NUTRIA_CONFIG = {
    apiKey: 'your_anthropic_key',
    language: 'es'
  }
</script>
<script src="https://[your-netlify-url]/widget.js"></script>
```

---

## STEP 8 — Supabase conversations table

Same SQL as before — add to nutri-ai/database/schema.sql and run in Supabase:

```sql
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  messages jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists conversations_user_idx on conversations(user_id);
alter table conversations enable row level security;
create policy "own conversation" on conversations
  for all using (auth.uid() = user_id);
```

---

## STEP 9 — Environment variables

### scripts/setup-env.sh
```bash
#!/bin/bash
# App .env.local
echo "VITE_SUPABASE_URL=$SUPABASE_URL" > app/.env.local
echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> app/.env.local
echo "VITE_ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> app/.env.local

# Widget .env.local
echo "VITE_ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" > widget/.env.local
echo "VITE_SUPABASE_URL=$SUPABASE_URL" >> widget/.env.local

echo "Both .env.local files populated"
```

---

## STEP 10 — Netlify config

### netlify.toml
```toml
[build]
  command = "cd app && npm run build && cd ../widget && npm run build && cp dist/widget.js ../app/dist/widget.js"
  publish = "app/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This builds both targets and copies `widget.js` into the app's dist folder so it's served from the same URL.

---

## STEP 11 — SETUP.md

Write a clear setup doc at repo root covering:
1. One-time Supabase Google OAuth setup (dashboard → Providers → Google)
2. Netlify token for MCP (app.netlify.com → User settings → Personal access tokens → add to dotfiles as NETLIFY_AUTH_TOKEN)
3. How to embed widget on longevite-therapeutics (one script tag)
4. How to run both targets locally:
   ```bash
   # Terminal 1 — app
   cd app && npm run dev
   # Terminal 2 — widget preview
   cd widget && npm run build && npm run preview
   ```

---

## STEP 12 — Commit and run

```bash
cd /workspaces/nutria-app
bash scripts/setup-env.sh
cd app && npm run dev &
echo "nutrIA app running at http://localhost:5173"

git add -A
git commit -m "nutrIA V1 — monorepo app + widget, shared chat components 2026-04-01"
git push
```

---

## STEP 13 — Update registries

In `janus/learnings/mcp-registry.md`:
- Netlify MCP: UNTESTED → READY TO ACTIVATE (needs NETLIFY_AUTH_TOKEN in dotfiles)

In `janus/PROJECTS.md`:
- nutrIA registered ✅

---

## SUMMARY

After all steps give me:
1. Every file created and in which directory
2. App running at localhost:5173 — what to test first
3. Widget build output location and how to test it locally
4. The two manual steps (Supabase Google OAuth + Netlify token)
5. The exact script tag to add to longevite-therapeutics once deployed


---

## STEP 1 — Register nutrIA in janus PROJECTS.md

Add under ACTIVE PROJECTS:

```
### nutrIA (app)
- **Repo:** github.com/salasoliva27/nutria-app
- **Type:** React PWA — patient-facing interface for nutri-ai agent
- **Stage:** Build — Phase 1 internal test
- **Modules:** build 🔄
- **Stack:** React + Vite · Tailwind CSS · Framer Motion · Supabase Auth · Claude API · Web Speech API · Netlify (free)
- **Relationship:** Frontend for nutri-ai agent. Shares Supabase instance.
- **Status:** 🔄 Building
```

---

## STEP 2 — Create the GitHub repo and scaffold

Create repo `nutria-app` under salasoliva27 via GitHub MCP.

Then scaffold the project:

```bash
cd /workspaces
npm create vite@latest nutria-app -- --template react
cd nutria-app
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install framer-motion @supabase/supabase-js
npm install vite-plugin-pwa
```

---

## STEP 3 — Project structure

Create this structure:

```
nutria-app/
├── public/
│   ├── manifest.json          ← PWA manifest
│   └── icons/                 ← app icons (generate SVG placeholders)
├── src/
│   ├── main.jsx
│   ├── App.jsx                ← root: auth gate + page carousel
│   ├── lib/
│   │   ├── supabase.js        ← Supabase client
│   │   └── claude.js          ← Claude API streaming client
│   ├── pages/
│   │   ├── MainPage.jsx       ← hero + chat trigger
│   │   └── DashboardPage.jsx  ← vertical scroll dashboard
│   ├── components/
│   │   ├── Auth/
│   │   │   └── AuthScreen.jsx ← Google + email login
│   │   ├── Chat/
│   │   │   ├── ChatPanel.jsx  ← web: side panel
│   │   │   ├── ChatFull.jsx   ← mobile: full screen
│   │   │   ├── ChatBubble.jsx ← message bubble with glow
│   │   │   ├── VoiceButton.jsx ← Web Speech API recorder
│   │   │   └── GlowEffect.jsx ← animated glow on response
│   │   ├── Dashboard/
│   │   │   ├── ProfileSection.jsx
│   │   │   ├── ResultsSection.jsx
│   │   │   ├── MealPlanSection.jsx
│   │   │   └── ProgressSection.jsx
│   │   └── ui/
│   │       ├── NutriaLogo.jsx ← otter SVG mascot
│   │       └── PageCarousel.jsx ← horizontal swipe container
│   ├── hooks/
│   │   ├── useChat.js         ← chat state + Claude streaming
│   │   ├── useVoice.js        ← Web Speech API
│   │   └── useAuth.js         ← Supabase auth state
│   └── index.css
├── vite.config.js
├── tailwind.config.js
├── .env.local                 ← VITE_ prefixed env vars
└── netlify.toml               ← Netlify deploy config
```

---

## STEP 4 — Design direction

**Read /mnt/skills/public/frontend-design/SKILL.md before writing any component.**

Then commit to this aesthetic direction:

**Theme:** Deep ocean at night meets living organism. The nutria (otter) is playful but precise — like functional medicine itself.

**Colors:**
```css
--bg-deep: #080c10          /* almost black, slight blue */
--bg-surface: #0d1520       /* dark navy */
--accent-teal: #00e5c4      /* bioluminescent teal — the glow color */
--accent-warm: #f0c060      /* warm gold — nutria fur */
--text-primary: #e8f4f0     /* cool white */
--text-muted: #4a7a70       /* muted teal */
--glow-color: #00e5c4       /* same as accent-teal */
```

**Typography:**
- Display: `Playfair Display` (Google Fonts) — editorial, organic curves
- Body/UI: `DM Mono` (Google Fonts) — clinical precision, tech-forward
- Accent numbers/data: `DM Mono` in teal

**Motion language:**
- Everything breathes — slow pulse animations on idle elements
- Chat open: panel slides in with spring physics, slight blur dissolve
- Bot response glow: radial pulse from the message bubble outward, 800ms, eases out
- Voice recording: breathing circle animation (scale pulse)
- Page swipe: momentum-based, slight parallax between pages
- Idle main page: the button slowly breathes (scale + glow intensity)

**Dashboard layout (NO BOXES):**
Flowing sections separated by organic SVG wave dividers. Each section has its own visual treatment:
- Profile: large typography, data floats alongside text
- Results: horizontal scroll of data points within the vertical scroll
- Meal plan: timeline-style vertical layout, days as nodes on a line
- Progress: raw numbers large, context small — like a vital signs readout

---

## STEP 5 — Write all source files

### src/lib/supabase.js
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### src/lib/claude.js
Claude API streaming client. The system prompt loads the full nutri-ai agent brain.

```javascript
export async function streamChat(messages, onChunk, onDone) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      stream: true,
      system: NUTRIA_SYSTEM_PROMPT,
      messages
    })
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      const data = JSON.parse(line.slice(6))
      if (data.type === 'content_block_delta') {
        fullText += data.delta.text
        onChunk(data.delta.text)
      }
    }
  }
  onDone(fullText)
}

const NUTRIA_SYSTEM_PROMPT = `Eres nutrIA, un agente de nutrición clínica con IA. 
Eres cálido, preciso, y hablas en el idioma del usuario (español o inglés, sigue su ejemplo).
Para testing: responde a cualquier pregunta, no solo nutrición.
Cuando el usuario quiere hablar de nutrición, conduce el intake clínico completo paso a paso:
antropometría → historial médico/hereditario → estilo de vida → historial dietético → objetivos.
Usa fórmulas validadas (Mifflin-St Jeor, Devine IBW, TDEE). Sé honesto si algo requiere un médico real.
Tu mascota/símbolo es la nutria — animal de las nutriólogas.`
```

### src/hooks/useAuth.js
Supabase auth hook — tracks session, exposes signInWithGoogle(), signInWithEmail(), signOut().

### src/hooks/useChat.js
Chat state hook:
- Loads conversation history from Supabase on mount (by user ID)
- Saves each exchange to Supabase after completion
- Calls streamChat() from claude.js
- Tracks `isResponding` state (triggers glow)
- Handles voice transcript injection

### src/hooks/useVoice.js
Web Speech API hook:
- `startRecording()` / `stopRecording()`
- Returns `transcript` string
- `isRecording` boolean
- Works on Chrome/Safari/Edge (note Firefox limitation)
- Language auto-detects from browser, defaults to es-MX

### src/components/Auth/AuthScreen.jsx
Full-screen auth. Design: centered on dark bg, nutrIA logo top, two options below.
- Google OAuth button (Supabase signInWithOAuth)
- Email + password form (Supabase signInWithPassword + signUp)
- Subtle animated background (slow moving teal particles or noise)

### src/components/ui/PageCarousel.jsx
Horizontal two-page carousel.
- Touch/swipe detection (touch events + pointer events for desktop drag)
- Momentum physics — not instant snap
- Subtle parallax: bg moves at 0.7x the foreground speed
- Current page indicator: two small dots bottom center
- On desktop: keyboard arrow keys also switch pages

### src/components/ui/NutriaLogo.jsx
SVG otter mascot — abstract, minimal, art-directed. Not clip-art.
Think: geometric otter silhouette, teal outline, one warm-gold eye detail.
Animated idle: slow float (translateY 8px, 3s ease-in-out infinite alternate).

### src/pages/MainPage.jsx
Full viewport. Dark bg with subtle animated texture (CSS noise or canvas).
Center: nutrIA wordmark + otter logo floating above.
Below: one button — "Habla con nutrIA" — glowing teal border, breathing pulse animation.
On click: triggers chat open with spring animation.
Bottom: two dots page indicator.

### src/components/Chat/ChatPanel.jsx (web, >768px)
Slides in from the right. Width: 420px. Height: 85vh. Pinned bottom-right.
Backdrop blur behind it. Dark surface color.
Header: nutrIA logo small + "Cerrar" button.
Messages: scrollable, bottom-anchored.
Input: text field + send button + VoiceButton side by side.
Open animation: translateX from +440px to 0, spring(stiffness: 300, damping: 28).

### src/components/Chat/ChatFull.jsx (mobile, ≤768px)
Full screen. Slides up from bottom.
Same content as ChatPanel but full viewport.
Open animation: translateY from +100% to 0, spring physics.
Safe area insets handled (iPhone notch).

### src/components/Chat/ChatBubble.jsx
User messages: right-aligned, warm gold tint background.
Agent messages: left-aligned, dark surface.
When `isNew` prop and agent message: GlowEffect wraps it.

### src/components/Chat/GlowEffect.jsx
On mount (new agent message):
- Radial glow emanates from the bubble outward
- Color: var(--accent-teal)
- Duration: 800ms, cubic-bezier(0, 0, 0.2, 1)
- Opacity: 0.8 → 0
- Scale: 1 → 1.4
- After glow: bubble border has a soft teal outline that fades in 2s

### src/components/Chat/VoiceButton.jsx
Circular button. Microphone icon.
States:
- Idle: muted teal border
- Recording: breathing animation (scale 1 → 1.15, 600ms infinite), teal fill, inner pulse rings
- Processing: spinner
On stop: injects transcript into the text input, user can edit before sending.

### src/pages/DashboardPage.jsx
Full viewport, vertical scroll. Sections separated by SVG wave dividers (organic, not straight lines).
Smooth scroll snap between sections.
Each section fills at least 80vh.

**Section 1 — Perfil / Profile**
Not a form. A living document feel.
Large display: user's name in Playfair Display.
Below: key stats float as large numbers with small labels.
Peso: [X] kg · Altura: [X] cm · Objetivo: [X]
Edit mode: tap any stat to edit inline (no separate form page).

**Section 2 — Resultados / Results**
Your calculated nutritional targets from the last assessment.
Display as a vital-signs readout — numbers dominate, labels are secondary.
Calorías: [X] kcal · Proteína: [X]g · Carbs: [X]g · Grasa: [X]g
Key micronutrient flags if any (shown as small colored pills: ⚠ Hierro · ⚠ D3).
Horizontal scroll row of secondary metrics.

**Section 3 — Plan de Comidas / Meal Plan**
Timeline layout — days as nodes on a vertical line.
Each day node expands on tap to show meals.
Day label large (Lunes, Martes...) with total kcal small beside it.
Collapsed: just the day + kcal + a preview of the main meal.

**Section 4 — Progreso / Progress**
Minimal — this is empty on first use.
Show a placeholder that invites: "Registra tu primera semana para ver tu progreso."
When data exists: large number shows weight trend, small sparkline below.

---

## STEP 6 — Supabase schema additions

Run this SQL in the Supabase project (same instance as nutri-ai):

```sql
-- conversations: persists chat history per user
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  messages jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- one row per user — upsert pattern
create unique index if not exists conversations_user_idx on conversations(user_id);

alter table conversations enable row level security;

-- users can only read/write their own conversation
create policy "own conversation" on conversations
  for all using (auth.uid() = user_id);
```

---

## STEP 7 — Environment variables

Create `.env.local`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key
```

These come from dotfiles — values are already there as:
- SUPABASE_URL → VITE_SUPABASE_URL
- SUPABASE_ANON_KEY → VITE_SUPABASE_ANON_KEY (note: anon key, not service role)
- ANTHROPIC_API_KEY → VITE_ANTHROPIC_API_KEY

Create a script to auto-populate .env.local from environment:
```bash
#!/bin/bash
# scripts/setup-env.sh
echo "VITE_SUPABASE_URL=$SUPABASE_URL" > .env.local
echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env.local
echo "VITE_ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> .env.local
echo ".env.local populated from environment"
```

---

## STEP 8 — PWA config

### public/manifest.json
```json
{
  "name": "nutrIA",
  "short_name": "nutrIA",
  "description": "Tu agente de nutrición con IA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#080c10",
  "theme_color": "#00e5c4",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### vite.config.js
Include VitePWA plugin with offline cache strategy.

---

## STEP 9 — Netlify config

### netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Add Netlify to `.mcp.json` in nutri-ai (it's already UNTESTED in the registry — this is the first real use):
```json
"netlify": {
  "command": "npx",
  "args": ["-y", "@netlify/mcp-server"],
  "env": {
    "NETLIFY_AUTH_TOKEN": "${NETLIFY_AUTH_TOKEN}"
  }
}
```

Note: NETLIFY_AUTH_TOKEN needs to be added to dotfiles. Get it from: app.netlify.com → User settings → Applications → Personal access tokens.

---

## STEP 10 — Supabase Google OAuth setup notes

Add a SETUP.md in the repo root explaining what Jano needs to do once manually:

```markdown
## One-time Supabase Auth setup

1. Supabase dashboard → Authentication → Providers → Google → Enable
2. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client
3. Authorized redirect URI: https://[your-supabase-project].supabase.co/auth/v1/callback
4. Copy Client ID + Secret → paste into Supabase Google provider config
5. In Supabase Auth settings → add Site URL: http://localhost:5173 (dev) + your Netlify URL (prod)

Email/password auth is enabled by default — no config needed.
```

---

## STEP 11 — Commit and run

```bash
cd /workspaces/nutria-app
bash scripts/setup-env.sh
npm run dev &
echo "nutrIA running at http://localhost:5173"

git add -A
git commit -m "nutrIA V1 — React PWA, auth, chat, dashboard 2026-04-01"
git push
```

---

## STEP 12 — Update registries

In `nutri-ai/learnings/mcp-registry.md` update:
- Netlify MCP: UNTESTED → IN USE, note the auth token requirement

In `janus/learnings/mcp-registry.md` update:
- Netlify MCP: UNTESTED → IN USE for nutrIA deployment

---

## SUMMARY

After all steps give me:
1. Every file created
2. What's running at localhost:5173 and how to test it
3. The exact two manual steps needed (Netlify token + Supabase Google OAuth)
4. Anything that needs a decision before it works
