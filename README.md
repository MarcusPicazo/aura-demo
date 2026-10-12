# Torre Aura Del Valle — Selector 3D inmobiliario

Demo comercial de un **selector de unidades 3D interactivo** para desarrolladoras
inmobiliarias. Es la versión 0 de un motor reutilizable: un cliente nuevo se resuelve
cambiando solo `src/config/<cliente>.json` y los datos en Supabase, sin tocar
`src/engine/`. El detalle completo del producto está en [SPEC.md](./SPEC.md).

## Stack

- Vite + React + TypeScript (modo estricto)
- React Three Fiber + @react-three/drei + three.js
- Zustand (estado global)
- Tailwind CSS
- Supabase (Postgres, Auth, Realtime)
- React Router
- Deploy en Vercel

## Requisitos

- Node.js 20+
- Un proyecto de Supabase (para datos reales; sin uno, el selector muestra un
  banner de error con botón de reintentar en vez de quedarse cargando para siempre)

## Cómo correrlo localmente

```bash
npm install
cp .env.example .env.local   # llena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Abre `http://localhost:5173/aura`.

## Base de datos

> **Conjuntos (varios edificios):** antes de volver a correr el seed, pega en el SQL Editor la migración
> `supabase/migrations/20261005120000_add_units_building.sql` (agrega `units.building_id`). Mientras no la corras,
> la app sigue funcionando: todas las unidades existentes caen en el primer edificio del conjunto.

El esquema, RLS y activación de Realtime están en `supabase/migrations/`, en orden.
Pégalos en el SQL Editor del dashboard de Supabase (o usa la CLI de Supabase si la
tienes configurada). El script de seed de las 46 unidades está en `scripts/`.

## Estructura del repo

```
src/
  engine/     Motor 3D genérico — nada específico de un cliente
  views/      Selector 3D, modo render (views/render/), proyecto, ficha de unidad...
  admin/      Panel de administración (unidades, editor de render, exportador de plantas, leads)
  lib/        Supabase, precios, WhatsApp, geometría, lógica del modo render
  store/      Zustand
  config/     aura.json — todo lo específico del cliente (active.ts: la config activa y sus edificios)
public/clients/aura/   Imágenes del cliente (render/ se genera, interiores, logo)
render-src/aura/       Originales de los renders del cliente
supabase/migrations/   SQL
scripts/                Seed de datos y generación de imágenes del modo render
```

## Modo render

Imágenes con zonas clicables (aérea, fachadas, plantas por nivel) que usan el mismo inventario
que el 3D. Se define en `render` dentro de `src/config/<cliente>.json`.

1. Deja los originales en `render-src/<cliente>/` (JPG, PNG, WebP o SVG).
2. Genera las versiones responsivas: `npx tsx scripts/build-render-images.ts <cliente>`. Imprime
   el bloque `image` (ruta, anchos, tamaño) de cada imagen para pegar en el config.
3. Dibuja las zonas en `/admin/render` y pega el JSON exportado como `render` en el config.

**Plantas por nivel:** una vista `{ "kind": "generatedPlan" }` las dibuja el motor desde `geometry` y
`floorPlans` (cámara ortográfica cenital, muros, mobiliario, códigos y color por estado), siempre
al día con el inventario, sin imágenes. `/admin/plantas` exporta esa misma planta como PNG y arma el
JSON de `levels` para usarla como vista de planta con imágenes (`"kind": "plan"`).

Para la demo, `npx tsx scripts/render-placeholders.ts aura` dibuja imágenes **provisionales**
(aérea y fachada posterior) a partir de la geometría; se reemplazan por los renders reales.
Un cliente sin modelo 3D omite las secciones 3D del config y solo define vistas con imagen.

## Asoleamiento y vista desde la unidad

Dos funciones opcionales del selector 3D, parametrizadas en `solar` y `unitView` del config (ver SPEC §4.6 y §4.7):

- **Asoleamiento**: el botón de la esquina superior izquierda enciende el sol real (latitud, longitud, fecha y hora
  local del desarrollo). Mueve la hora y la fecha para ver cómo cambia la luz de cada fachada; "Resaltar unidades con
  sol de tarde" tiñe las unidades que lo reciben. La ficha de cada unidad indica sus horas de sol directo estimadas.
- **Ver desde esta unidad**: en la ficha de una unidad, coloca la cámara dentro de ella mirando hacia afuera.
  Arrastra para mirar alrededor; "Volver a la vista exterior" regresa.

## Comparador, favoritos y cotización en PDF

Todo corre en el navegador (sin backend; ver SPEC §4.8):

- **Guardar**: favoritos en `localStorage`. El corazón de abajo a la izquierda abre la lista y la comparte por link
  (`/aura?favoritos=…`).
- **Comparar**: hasta 3 unidades lado a lado (plano, m², recámaras, piso, orientación, precio, precio por m² y mensualidad
  estimada).
- **Cotización**: PDF con la marca del desarrollo, la unidad, su plano, el esquema de pagos y los datos del asesor
  (jsPDF, se carga solo al pedirla). Se descarga o se manda por WhatsApp; el asesor y el aviso salen del config.

## Presentación y showroom

- **Presentación**: el botón "Presentación" (abajo a la izquierda) lanza un recorrido automático de ~45 s con rótulos; cualquier toque lo
  detiene. Se configura en `presentation` del config (duración, unidad destacada, horas del barrido de sol).
- **Showroom**: para una pantalla táctil de sala de ventas, abre `/aura?modo=showroom` (o usa "Modo showroom" en el cuadro de idioma
  y moneda). Interfaz grande, pantalla completa y, tras 2 minutos sin uso, limpia lo que dejó el visitante y arranca la
  presentación. Para salir: mantén presionado el logotipo 2 segundos o presiona Esc.

## App instalable y sin conexión (PWA)

Pensada para salas de venta con mal wifi. En producción la app registra un service worker que guarda la app y todas las imágenes
del cliente (~7 MB en total, la primera vez con un aviso de avance) y deja el último inventario conocido en el dispositivo. Sin red
abre igual y muestra "Sin conexión · datos de hace X"; al volver la conexión se actualiza sola. Las versiones nuevas piden
confirmación ("Actualizar"). Se instala desde el navegador ("Instalar app" en el cuadro de idioma y moneda donde el navegador lo
permita). Nombre corto y modo de pantalla: `pwa` en `src/config/<cliente>.json`.

- **Probarlo**: el service worker **no corre en `npm run dev`**. Usa `npm run build` y `npm run preview`, abre la dirección, espera a
  "Listo para usar sin conexión" y apaga la red (DevTools → Application → Service Workers → Offline). Recarga: debe abrir.
- **Íconos**: `npx tsx scripts/build-pwa-icons.ts` los regenera desde el logotipo (salen en `public/clients/<cliente>/pwa/`).
- Después de cambiar imágenes del cliente basta con volver a hacer el build: cada archivo lleva su revisión y solo se vuelve a
  bajar lo que cambió.

## Rendimiento y accesibilidad

Criterios y última auditoría con cifras antes/después: SPEC §8 y §8.1. Lo que más pesa en un celular, y que ya está resuelto:
las sombras se calculan una vez (no en cada cuadro), los shaders se compilan antes de mostrar la torre y la pantalla de carga se retira en
cuanto la escena está lista. Para volver a medir con 4G simulado:

```bash
VITE_SUPABASE_URL=http://localhost:4180/__supabase/ npx vite build --outDir dist-perf --emptyOutDir
node scripts/perf-server.cjs dist-perf 4180 9000 170    # carpeta, puerto, kbps, ms de latencia (4G lento: 1600 150)
```

Abre `http://localhost:4180/aura` y en la consola del navegador usa `window.__m.report()` (primer pintado, torre visible, peticiones) y
`window.__m.stats(0)` (llamadas de dibujo, triángulos y milisegundos de CPU por cuadro). Los fps reales hay que verlos en un celular: conecta
el teléfono por USB y usa Chrome → `chrome://inspect`. Para imágenes nuevas de un cliente: `npx tsx scripts/optimize-gallery-images.ts <cliente>`
(interiores y amenidades a WebP, portada recomprimida) y `scripts/build-render-images.ts` para el modo render.

## Idiomas y moneda

El sitio público abre en el idioma del navegador (español o inglés) y trae un selector de idioma y moneda abajo a la izquierda.
Los textos de la interfaz están en `src/i18n/locales/`; los del cliente, en `src/config/<cliente>.json` como `{ "es": …, "en": … }`.
El tipo de cambio MXN/USD (referencial) está en `currency` de ese mismo archivo: actualízalo a mano. Revisa que las traducciones
estén completas con `npx tsx scripts/check-i18n.ts`.

## Otros comandos

```bash
npm run build     # build de producción
npm run preview   # sirve el build de producción (útil para medir rendimiento real)
npm run lint       # oxlint
```
