# SPEC — Aura Demo (Selector 3D inmobiliario)

## 1. Qué es
Demo comercial de un **selector de unidades 3D interactivo** para desarrolladoras inmobiliarias.
Es la **versión 0 de un motor reutilizable**: cada cliente futuro debe resolverse cambiando
solo archivos de configuración y datos, nunca el código del motor.

Objetivo de negocio: que un director comercial vea la demo en su celular y pida
"quiero ver MI torre así". Después de la demo, debe ser posible montar la torre de un
prospecto en menos de 48 horas cambiando solo `src/config/<cliente>.json` y los datos en Supabase.

## 2. Los tres momentos que la demo DEBE lograr (prioridad absoluta)
1. **"Ábralo en su celular"**: el prospecto escanea un QR y la torre carga en menos de 3 s en 4G,
   con una animación de cámara de entrada, fluida en un Android de gama media.
2. **"Elija un departamento"**: toca un piso, luego una unidad, ve su ficha y presiona "Me interesa".
   Se abre WhatsApp con un mensaje prellenado:
   `Hola, me interesa el departamento 804 (Tipo A, 85 m², $6,450,000) de Torre Aura Del Valle.`
   El lead también se guarda en Supabase.
3. **"Ahora lo vendo"**: desde el panel de administración (en otro dispositivo) se marca la unidad
   como vendida y cambia de color en todas las pantallas abiertas al instante, sin recargar (Supabase Realtime).

Si una funcionalidad no ayuda a estos tres momentos, no es prioridad.

## 3. El desarrollo ficticio: Torre Aura Del Valle
- Ubicación ficticia: colonia Del Valle, CDMX.
- 12 niveles: planta baja (lobby y amenidades, no se vende), pisos 1–11 con 4 unidades (A, B, C, D),
  piso 12 con 2 penthouses (PH1, PH2). Total: 46 unidades.
- Códigos de unidad: `{piso}{nn}` → 101, 102, 103, 104 … 1101 … 1104; penthouses 1201, 1202.

| Tipo | Recámaras | Baños | m²      | Orientación        | Precio base (piso 1) |
|------|-----------|-------|---------|--------------------|----------------------|
| A    | 2         | 2     | 85      | Norponiente        | $5,600,000           |
| B    | 1         | 1     | 62      | Nororiente         | $4,300,000           |
| C    | 3         | 2.5   | 120     | Surponiente        | $7,600,000           |
| D    | 2         | 2     | 92      | Suroriente         | $6,000,000           |
| PH   | 3         | 3.5   | 165–180 | Doble orientación  | $9,400,000–9,800,000 |

- Precio: precio base × (1 + 0.015 × (piso − 1)), redondeado a miles.
- Estados: ~60% `available`, ~25% `sold`, ~15% `reserved`. Distribución realista:
  pisos bajos y altos más vendidos, penthouses uno vendido y uno disponible.
- Marca: nombre "Torre Aura Del Valle", frase "Vivir en la luz de Del Valle", paleta sobria
  (arena, grafito, un acento cálido). Tipografía elegante (serif para títulos, sans para datos).

## 4. Funcionalidades

### 4.1 Obligatorias (v1)
- **Torre 3D procedural** generada desde `config/aura.json` (ver §5): cada unidad es un polígono
  extruido a la altura de piso; losas y núcleo como geometría aparte.
- **Look arquitectónico**: vidrio (`MeshPhysicalMaterial`), bordes (`Edges`), HDRI de ciudad,
  sombras de contacto, edificios vecinos como bloques grises semitransparentes.
- **Animación de entrada**: la cámara llega orbitando a la vista principal.
- **Controles**: órbita con límites (no ir bajo el suelo, zoom acotado). Touch: arrastrar, pellizcar, tocar.
- **Interacción**: hover/tap resalta piso y luego unidad. Colores por estado:
  verde = disponible, ámbar = apartado, gris = vendido.
- **Panel de unidad**: código, tipo, recámaras, baños, m², orientación, piso, precio,
  **plano SVG generado a partir del polígono de la unidad**, botón "Me interesa" (WhatsApp) y formulario
  opcional de nombre y teléfono que guarda el lead.
- **Filtros**: recámaras, rango de precio, "solo disponibles". Las unidades que no coinciden
  se vuelven casi transparentes.
- **Leyenda** de estados y contador ("18 de 46 disponibles").
- **URL por unidad**: `/aura/unidad/804` abre la torre con esa unidad seleccionada.
- **Panel de administración** `/admin`: login con Supabase Auth, tabla de unidades con selector
  de estado y precio editable. Los cambios se reflejan en tiempo real en el selector.
- **Mobile-first**: se diseña primero para celular vertical.

### 4.2 Modo render: la pestaña «Vistas» (antes «Render»)
Navegación por imágenes (renders) con el mismo inventario de Supabase que el selector 3D. Debe
funcionar igual si el cliente solo entrega renders y no hay modelo 3D (en ese caso la pestaña
"Torre 3D" no aparece y `/aura` abre el render).
- **Varias vistas por desarrollo**, definidas en `config.render.views` con su imagen y sus zonas:
  aérea del conjunto, fachada frontal, fachada posterior y planta por nivel (`kind`: `aerial`,
  `facade`, `plan`, `generatedPlan`). Un conmutador de vistas arriba y, en plantas, un selector lateral de piso.
- **Zonas clicables**: polígonos en fracciones 0–1 de la imagen. Cada zona lleva a otra vista (con
  piso opcional) o abre la ficha de la unidad. Resaltan al pasar el cursor y se colorean por
  estado de disponibilidad (unidad: su estado; piso: disponible > apartado > vendido). Cambios
  de estado en Realtime las recolorean sin recargar.
- **Transiciones suaves** (fundido cruzado cuando la nueva imagen ya está descargada y
  decodificada), **precarga** de las imágenes a las que puede llegar el usuario y **versiones
  responsivas** (`srcset` WebP 800/1600/2400 + JPG de respaldo, generadas con
  `scripts/build-render-images.ts`). Imágenes marcadas como "conceptuales ilustrativas".
- **Cambio de modo**: un botón arriba a la derecha ("Ver en 3D" / "Ver vistas") y las pestañas
  "Torre 3D" y "Vistas" conservan la unidad o el piso que el usuario traía. Solo aparecen los
  modos que el desarrollo tiene. URL: `/aura/render/:viewId?piso=<n>&unidad=<código>`.
- Las zonas se dibujan con el editor de `/admin/render` (enlace «Vistas» del panel; sirve para cualquier vista, no solo la fachada)
  y se pegan en `config.render`. La URL sigue siendo `/aura/render/...`: cambia el nombre de la pestaña, no las direcciones.
- **Recorrido de la demo**: la foto aérea (`public/clients/aura/views/aerial.jpg`, 1920 px, < 400 KB) tiene una zona sobre la torre que
  lleva a la fachada frontal; en la fachada cada piso lleva a su planta (la planta generada por el motor). Las demás vistas (fachada
  posterior, plantas de cada edificio) se alcanzan con los ángulos de arriba. Con "Ver disponibilidad" las zonas de piso y de unidad se
  colorean por estado; la zona de la torre en la aérea solo navega (no tiene piso ni unidad).
- **Planta generada por el motor** (`kind: "generatedPlan"`, sin imágenes externas): cámara ortográfica
  cenital sobre el nivel elegido, con losa, muros, ventanas, puertas y mobiliario (los mismos
  símbolos que el plano SVG de la ficha), el código de cada unidad y el color por estado del
  inventario real. Interactiva: pasar el cursor muestra la unidad, tocarla abre su ficha. Sale de
  `geometry` y `floorPlans`, así que siempre coincide con el inventario; por eso solo está
  disponible si el desarrollo tiene modelo 3D.
- **Exportación de la planta** (`/admin/plantas`): descarga como PNG la planta que dibuja el motor
  (por tipo de planta: tipo y penthouse) y arma el JSON de `levels` —imagen y zonas por unidad—
  para usarla como vista de planta con imágenes (`kind: "plan"`).

### 4.3 Si sobra tiempo
- ~~**Asoleamiento**~~ — hecho, ver §4.6.

### 4.4 Fuera de alcance
Configurador de acabados, recorridos interiores, modelos glTF, modo showroom, integración con CRM.

### 4.5 Conjuntos (varios edificios)
El motor maneja un conjunto: la config declara `buildings` (torres, casa club, amenidades), cada uno con su
`position` (centro de su huella en metros), `rotationDeg` (horario visto desde arriba) y su `geometry` propia.
Materiales, carpintería, balcones, entorno, cielo y cámara son compartidos. Sin `buildings`, el desarrollo es de una
sola torre y todo funciona como antes (`geometry` de nivel superior = un edificio implícito).
- **Vista inicial = masterplan** (`/aura`): cámara aérea sobre el conjunto completo, con el volumen simplificado de
  cada edificio (franjas de vidrio y losa por nivel) y un rótulo con su **contador de disponibilidad** ("18 de 46
  disponibles"). "Ver disponibilidad" tiñe cada volumen con el estado que resume al edificio.
- **Entrar a un edificio** (clic en su volumen o rótulo → `/aura/edificio/:id`): la cámara vuela hasta él y se monta su
  selector de siempre (detalle completo, filtros, ficha de unidad en `/aura/edificio/:id/unidad/:code`). Un edificio sin
  unidades (casa club) se encuadra igual y muestra una tarjeta que dice qué es.
- **Volver**: el botón "Masterplan" de las migas de pan (Masterplan › Edificio › Piso · Unidad), que también suben un nivel.
- **Rendimiento**: los volúmenes salen de `InstancedMesh` (los que comparten forma, un solo draw call); el detalle
  (`Tower`) se baja y se monta solo para el edificio activo y se libera al salir (geometrías, materiales, texturas).
- **Identidad de unidad**: dentro de un edificio el código es único, entre edificios puede repetirse (101 en cada torre).
  En la URL y el store una unidad viaja como `edificio:código`; los enlaces viejos `/aura/unidad/:code` redirigen al
  edificio de esa unidad si el código no es ambiguo.
- Los planos de unidad y renders interiores se buscan por `edificio/clave` y, si no hay, por clave (tipo o código).
- Cada vista de planta generada del modo render (`generatedPlan`) lleva el `buildingId` de su torre.

### 4.6 Asoleamiento (`config.solar`)
Botón "Asoleamiento" (esquina superior izquierda). Apagado, la escena conserva su sol fijo de siempre. Encendido:
- **Sol real**: la luz direccional, el cielo, la niebla y el entorno de reflejos siguen la posición solar calculada
  (algoritmo de NOAA, `lib/solar.ts`) para `latitude`/`longitude` del desarrollo, una **fecha** del año (deslizador
  y atajos: solsticios y equinoccio) y una **hora** local (deslizador de `hourRange`). La luz es más dorada y suave con
  el sol bajo y se apaga de noche. Se ve cómo cambia la luz y la sombra de cada fachada, y en la vista desde la unidad
  (§4.7) también el exterior.
- **Sol de tarde**: "Resaltar unidades con sol de tarde" tiñe (naranja / gris azulado) cada unidad según si recibe al
  menos `afternoonMinHours` de sol directo desde `afternoonFromHour` en la fecha elegida.
- **Horas de sol directo** en la ficha de unidad: total del día, mañana / tarde, y una franja del día. Es una estimación
  (`lib/sunExposure.ts`): para cada muestra del día (`sampleMinutes`), con el sol sobre `minSunElevationDeg`, se lanza
  un rayo desde puntos de las fachadas exteriores de la unidad y se revisa si lo tapa otro edificio del conjunto, otra
  ala del mismo edificio o un vecino del entorno (el mismo `context.neighborBuildings` que se dibuja). No cuenta
  voladizos de balcón, árboles ni nubosidad, y la ficha lo dice.
- **Norte**: `northAngleDeg` gira el norte respecto de "arriba" en el plano (0 = el muro `z = 0` mira al norte).
- **Rendimiento**: el análisis es puro (sin three.js), se calcula solo cuando hace falta (una ficha abierta o el mapa
  de sol de tarde) y se recuerda por edificio y fecha: mover la hora solo mueve la luz. El entorno de reflejos se
  recaptura únicamente cuando el sol deja de moverse.

### 4.7 Vista desde la unidad (`config.unitView`)
Con una unidad abierta, "Ver desde esta unidad" vuela la cámara (transición suave, `flightSeconds`) al interior de esa
unidad, a `eyeHeight` sobre el piso de su nivel y `wallInset` del vidrio, mirando hacia afuera: se ve qué se alcanza a
ver desde ese piso y esa orientación con el contexto urbano que ya existe. Arrastrar (o las flechas del teclado) gira la
cabeza dentro de `yawLimitDeg` / `pitchUpDeg` / `pitchDownDeg`. La dirección sale de las fachadas exteriores de la
unidad ponderadas por su largo y por cuánta vista abierta tienen (una unidad de esquina mira a la diagonal; un muro pegado
a otro edificio pesa poco). Indicador de piso, unidad y rumbo con una brújula; "Volver a la vista exterior" (o Esc, o
el botón atrás del navegador) regresa. Va en la URL (`?vista=unidad`). El control de asoleamiento sigue disponible adentro.

### 4.8 Comparador, favoritos y cotización en PDF
Todo en el cliente: no hay backend ni cuenta; lo que la persona arma vive en su navegador y los datos de cada unidad
(precio, estado) se leen siempre del inventario en vivo. Disponible en los tres modos (3D, render y proyecto).
- **Botones de la ficha de unidad**: "Guardar" (favorito), "Comparar" y "Cotización". Abajo a la izquierda, junto al
  botón del asesor, un corazón (con su cantidad) abre los favoritos y, si hay unidades marcadas, un botón de comparar.
- **Comparador**: hasta 3 unidades lado a lado — plano, superficie, recámaras, baños, piso, orientación, precio,
  precio por m² y mensualidad estimada (la de obra: `paymentPlan` con el enganche inicial de la config). Resalta el
  mejor valor de cada fila y deja quitar unidades o abrir su ficha. La selección dura lo que la pestaña
  (`sessionStorage`).
- **Favoritos**: se guardan en `localStorage` (por desarrollo, hasta 50) como claves `edificio:código`. El panel lista
  las unidades con su estado actual, permite comparar, quitar y vaciar. **Compartir mi lista** genera
  `<sitio>/aura?favoritos=torre-aura:604,torre-aura:1101` (menú de compartir en celular, copiar el link en
  escritorio). Quien abre ese link ve la lista de la otra persona y puede guardarla en la suya; el parámetro se lee una vez
  y se quita de la URL, y las claves inválidas o que ya no existen en el inventario se ignoran o se marcan.
- **Cotización en PDF** (jsPDF, una página carta, generada en el navegador): marca del desarrollo (logo y paleta del
  config), datos de la unidad, su plano (el mismo que dibuja la ficha), esquema de pagos con el enganche elegido en la ficha,
  datos del asesor y aviso legal. La hoja de cotización arma el PDF al abrirse y ofrece **Descargar** y **Enviar por
  WhatsApp**: en celular usa el menú de compartir del sistema con el PDF adjunto; si el dispositivo no puede compartir
  archivos, descarga el PDF y abre el chat del asesor con el mensaje prellenado para que lo adjunte (un enlace de WhatsApp
  no puede adjuntar archivos). Una unidad vendida no se cotiza.
- **Rendimiento**: las hojas (favoritos, comparador, cotización) se cargan la primera vez que se abren; jsPDF y
  `react-dom/server` (para dibujar el plano en el PDF) solo se bajan al pedir una cotización.

### 4.9 Idiomas (es/en) y moneda (MXN/USD)
Aplica al sitio público (selector 3D, render, proyecto, fichas, comparador, favoritos, cotización PDF, mensajes de
WhatsApp y aviso de privacidad); el `/admin` y el portal comercial son herramientas internas y se quedan en español.
- **Textos de la interfaz**: archivos `src/i18n/locales/es.json` y `en.json` (sin librería: `src/i18n/`, hook `useI18n()`),
  con interpolación (`{code}`) y plurales (`x_one`/`x_other`). Agregar un idioma = su JSON y una entrada en `translate.ts`.
  `scripts/check-i18n.ts` verifica que es/en tengan las mismas claves y marcadores, que toda clave usada exista y que la
  config esté completa en los idiomas que ofrece.
- **Idioma inicial**: el que la persona eligió antes; si no, el primero de los idiomas del navegador que el desarrollo ofrezca;
  si no, `i18n.defaultLanguage`. Se recuerda en `localStorage` y se refleja en `<html lang>`.
- **Textos del cliente**: cualquier texto de la config puede ser una cadena (vale para todos los idiomas) o
  `{ "es": "…", "en": "…" }`: descripción, amenidades, puntos de interés, tagline, rol y horario del asesor, nombres y
  descripciones de edificios, etiquetas y `alt` del render, espacios de los planos, fechas rápidas del asoleamiento y datos
  legales. Si falta la versión del idioma elegido, cae al idioma por omisión. El título y la tarjeta de compartir del
  `index.html` usan el idioma por omisión (los bots no ejecutan JavaScript).
- **Selector visible**: una píldora abajo a la izquierda ("ES · MXN") abre idioma y moneda; solo muestra lo que el
  desarrollo ofrece.
- **Moneda**: el precio oficial es MXN (así vive en Supabase); `config.currency` trae el tipo de cambio (pesos por dólar) y su
  fecha, que el cliente actualiza a mano. Todos los precios (ficha, esquema de pagos, comparador, favoritos, filtros, PDF)
  siguen la moneda elegida; en dólares aparece la nota de que es referencial, y el mensaje de WhatsApp y el PDF incluyen
  también el precio oficial en pesos. Números y fechas usan el formato del idioma (`es-MX` / `en-US`).
- La orientación de una unidad (viene de la base de datos en español) se traduce con una tabla de equivalencias.

### 4.10 Modo presentación y modo showroom (`config.presentation`)
- **Presentación**: el botón "Presentación" (abajo a la izquierda, junto al selector de idioma) inicia un recorrido automático
  cinematográfico de ~45 s (`tourSeconds`): órbita general del conjunto → acercamiento a la fachada del edificio → entrada a una
  unidad → vista desde la ventana (la cabeza gira a los lados) → barrido de asoleamiento (el sol cruza el día, `sunSweepHours`) →
  vuelta al conjunto. La interfaz se esconde; aparecen rótulos que se funden (nombre y frase, edificio con su disponibilidad, la
  unidad con su ficha corta y precio en la moneda elegida, el rumbo de la vista, las horas de sol directo) y una barra fina de
  avance. **Cualquier interacción** (toque, clic, tecla, rueda) lo detiene y la cámara regresa suave a donde estaba; sin
  interacción vuelve a empezar (la pantalla puede quedar corriendo sola). La unidad es `featuredUnit` o, si no hay, la
  disponible de piso más alto con vista. Restaura el sol y los paneles como estaban.
- **Cómo está hecho**: `lib/tour.ts` arma la pista (cuadros clave con posición, punto de mira, campo de visión y plano cercano,
  más rótulos y barrido de sol) con funciones puras; `engine/TourDirector` mueve la cámara por la pista sin crear objetos por
  cuadro; `lib/tourRunner.ts` lleva el tiempo a la interfaz (rótulo, sol, "dentro de la unidad"). Los rótulos y la nota salen
  de los textos de la interfaz, así que el recorrido sale en el idioma y la moneda elegidos.
- **Showroom** (pantalla de kiosco de una sala de ventas): "Modo showroom (pantalla completa)" en el cuadro de idioma y moneda, o la
  dirección `?modo=showroom` (se recuerda en la pestaña). Toda la interfaz crece (125%) para dedos, sin selección de texto ni
  gestos de navegador; pide pantalla completa (solo el navegador la concede tras un toque, por eso en el arranque por dirección
  hay un botón "Toca para entrar en pantalla completa"). **Reposo**: tras `idleSeconds` (120) sin uso deja la pantalla como la
  encuentra el siguiente visitante —sin unidad abierta, filtros, sol, comparación ni favoritos de la persona anterior— y arranca la
  presentación; un toque la detiene y el reposo vuelve a contar. **Salir** (personal de la sala): mantener presionado el logotipo
  2 s, o Esc / salir de pantalla completa; el botón de entrada no se muestra dentro del showroom.

### 4.11 App instalable y sin conexión (PWA, `config.pwa`)
Pensado para presentar en salas de venta con mal wifi: la app se instala en el celular, la tableta o la pantalla del showroom y
**abre y funciona sin internet**.
- **Instalable**: `manifest.webmanifest` se genera en el build con el nombre, los colores y los íconos del cliente (`pwa.shortName`
  ≤ 12 caracteres y `pwa.display`: `standalone`, o `fullscreen` para un kiosco). Cuando el navegador ofrece instalar, aparece
  "Instalar app" en el cuadro de idioma y moneda. Los íconos salen de `public/clients/<cliente>/pwa/` (los genera
  `scripts/build-pwa-icons.ts` a partir del logotipo).
- **Service worker** (`src/pwa/sw.template.js` → `dist/sw.js`, solo en producción): al instalarse guarda la app (HTML, JS y CSS) y,
  en segundo plano y con avance, **todas las imágenes y archivos del cliente** (`/clients/**`, ~4 MB), solo lo que cambió. Después
  todo se sirve de caché primero; las rutas de la SPA abren con el HTML guardado. Las fuentes de Google se guardan al usarse. No
  toca Supabase ni los mapas.
- **Último inventario conocido**: el inventario se guarda en el dispositivo (`localStorage`, `inventory:<slug>`) cada vez que llega
  de la red. Si la red falla o tarda más de 2.5 s se muestra el guardado y se reintenta cada 30 s y al volver la conexión; si llega
  lo nuevo, lo reemplaza sin recargar.
- **Aviso discreto**: bajo el contador de unidades (y en la leyenda del modo render) sale "Sin conexión · datos de hace 3 h" o, con
  red pero aún con datos guardados, "Datos de hace 3 h · reconectando…". Con datos frescos y red no se ve nada. Sin inventario
  guardado y sin red se muestra el error con "Reintentar", como antes.
- **Actualizaciones**: una versión nueva se instala en segundo plano y **espera a que la persona acepte** ("Hay una versión nueva ·
  Actualizar"), para no cambiar archivos bajo una presentación en curso. Se busca cada 15 min con la página abierta.
- **Pantalla de carga con la marca**: desde el primer instante (antes de que baje el JavaScript) se ve el logotipo, el nombre y la
  frase del desarrollo con una barra de avance; al montar la interfaz, la pantalla de carga del selector continúa sin salto. La barra
  es **real**: pesa el arranque (10 %), el inventario (25 %), el código del edificio (20 %), la escena 3D (10 %) y la animación de
  entrada (35 %), y dice qué falta ("Cargando el inventario…", "Preparando el edificio…"). La animación de entrada espera a que haya
  datos (máximo 8 s) para que no se vea la torre vacía.
- Todo es genérico: el motor no sabe nada de la PWA; nombre, colores, logotipo y textos salen de la config.

## 5. Configuración por cliente (`src/config/aura.json`)
Todo lo específico del cliente vive aquí. Esquema de referencia:

```json
{
  "slug": "aura",
  "name": "Torre Aura Del Valle",
  "tagline": "Vivir en la luz de Del Valle",
  "whatsapp": "5215500000000",
  "brand": { "primary": "#2B2B2B", "accent": "#C8A27A", "background": "#F4EFE8" },
  "geometry": {
    "floorHeight": 3.2,
    "slabThickness": 0.3,
    "groundFloorHeight": 4.5,
    "levels": 12,
    "plate": [
      { "type": "A", "polygon": [[0,0],[11,0],[11,8],[0,8]] },
      { "type": "B", "polygon": [[13,0],[24,0],[24,8],[13,8]] },
      { "type": "C", "polygon": [[0,10],[11,10],[11,18],[0,18]] },
      { "type": "D", "polygon": [[13,10],[24,10],[24,18],[13,18]] }
    ],
    "penthousePlate": [
      { "type": "PH", "code": "1201", "polygon": [[0,0],[11,0],[11,18],[0,18]] },
      { "type": "PH", "code": "1202", "polygon": [[13,0],[24,0],[24,18],[13,18]] }
    ],
    "core": [[11,6],[13,6],[13,12],[11,12]]
  },
  "camera": { "intro": [60, 45, 60], "target": [12, 20, 9] },
  "render": {
    "defaultViewId": "fachada-frontal",
    "views": [
      {
        "id": "fachada-frontal", "kind": "facade", "label": "Frontal",
        "image": { "base": "/clients/aura/render/fachada-frontal", "widths": [800, 1600], "width": 1600, "height": 2142, "alt": "…" },
        "hotspots": [
          { "id": "piso-8", "label": "Piso 8", "polygon": [[0.186, 0.374], [0.818, 0.374], [0.818, 0.438], [0.186, 0.438]],
            "target": { "type": "view", "viewId": "plantas", "floor": 8 } }
        ]
      }
    ]
  }
}
```
Un cliente solo con renders omite las secciones 3D (`materials`, `carpentry`, `balcony`, `lobby`,
`roof`, `context`, `geometry`/`buildings`, `camera`, `sky`) y define únicamente `render`.

Asoleamiento y vista desde la unidad (opcionales; sin ellos no aparece el control, el indicador ni el botón):
```json
"solar": {
  "latitude": 19.43, "longitude": -99.13, "utcOffsetHours": -6, "northAngleDeg": 0,
  "defaultDate": "03-20", "defaultHour": 16.5, "hourRange": [6, 19],
  "minSunElevationDeg": 5, "sampleMinutes": 15, "afternoonFromHour": 13, "afternoonMinHours": 2,
  "presets": [{ "label": "Solsticio de verano", "date": "06-21" }, { "label": "Equinoccio", "date": "03-20" }]
},
"unitView": { "eyeHeight": 1.6, "wallInset": 1.2, "fov": 72, "yawLimitDeg": 80, "pitchUpDeg": 30, "pitchDownDeg": 35, "flightSeconds": 1.8 }
```
`utcOffsetHours` es el de la hora local que muestra el control (CDMX: −6, sin horario de verano desde 2022).

Presentación y showroom (todo opcional; sin esto se usan estos valores):
```json
"presentation": { "tourSeconds": 45, "idleSeconds": 120, "sunSweepHours": [7, 18], "featuredUnit": "torre-aura:1103" }
```

App instalable (opcional; sin esto el nombre corto son las primeras palabras del nombre y abre en `standalone`):
```json
"pwa": { "shortName": "Torre Aura", "display": "standalone" }
```

Idiomas, moneda y textos por idioma (opcionales; sin `i18n` solo hay español y sin `currency` solo pesos):
```json
"i18n": { "languages": ["es", "en"], "defaultLanguage": "es" },
"currency": { "usdRate": 18, "asOf": "2026-10-01" },
"tagline": { "es": "Vivir en la luz de Del Valle", "en": "Living in the light of Del Valle" }
```
`usdRate` son pesos por dólar (el de la demo es un ejemplo: actualízalo).

Un **conjunto** reemplaza la `geometry` de nivel superior por `buildings` (ver §4.5); cada edificio lleva la misma
`geometry` de arriba, puesta en el conjunto:
```json
"buildings": [
  { "id": "torre-aura", "name": "Torre Aura", "kind": "tower", "position": [0, 0], "rotationDeg": 0,
    "geometry": { "floorHeight": 3.2, "levels": 12, "plate": [], "penthousePlate": [], "core": [] } },
  { "id": "casa-club", "name": "Casa Club", "kind": "clubhouse", "position": [14, 28], "rotationDeg": 0,
    "description": "Alberca, gimnasio y terraza.", "geometry": { "...": "..." } }
]
```
`position` es el centro de la huella del edificio en el conjunto; `rotationDeg`, el giro de esa huella (horario visto desde
arriba). Solo las torres (`kind: "tower"`) llevan unidades, salvo que se indique `sellable`.
Las coordenadas están en metros. Los polígonos pueden ser irregulares (no solo rectángulos):
el motor debe soportar cualquier polígono simple. Para la demo, usar al menos una unidad
con forma irregular (en L o con esquina recortada) para demostrarlo.

## 6. Datos (Supabase)
> Conjuntos: `units.building_id` (ver `supabase/migrations/20261005120000_add_units_building.sql`) dice a qué edificio pertenece cada unidad; el `unique` es `(development_id, building_id, code)`. El resto del esquema de abajo no cambia.

```sql
create table developments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  published boolean default false,
  created_at timestamptz default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  code text not null,
  floor int not null,
  type text not null,
  bedrooms int not null,
  bathrooms numeric not null,
  m2 numeric not null,
  price numeric not null,
  orientation text,
  status text not null check (status in ('available','reserved','sold')),
  updated_at timestamptz default now(),
  unique (development_id, code)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  development_id uuid references developments(id) on delete cascade,
  unit_id uuid references units(id),
  name text,
  phone text,
  created_at timestamptz default now()
);
```
- **RLS**: lectura pública de `developments` y `units` cuando `published = true`;
  `update` de `units` solo para usuarios autenticados (para la demo basta con autenticado);
  `insert` público en `leads`; lectura de `leads` solo autenticados.
- **Realtime** activado en `units`.
- Migraciones en `supabase/migrations/`. Script de seed que genera las 46 unidades con la
  lógica de precios y estados de §3.

## 7. Estructura del repo
```
src/
  engine/     Tower, Floor, Unit, Core, Context, CameraRig, CameraFocus, LookAround, Massing, BuildingPlacement,
              ContactShadow, FloorPlan, PlanCapture                 ← genérico, sin nada del cliente
  views/      Selector3D, UnitPanel, Filters, Legend, SunLighting, SunControl, UnitViewHud,
              render/ (RenderView, RenderStage, GeneratedPlanStage…)
  admin/      Login, UnitsTable, RenderEditor, PlanExporter
  i18n/       translate.ts, localized.ts, useI18n.ts, locales/{es,en}.json
  engine/     …también TourDirector, CameraProbe (recorrido de presentación)
  lib/        supabase.ts, pricing.ts, currency.ts, whatsapp.ts, geometry.ts, buildings.ts, solar.ts, sunExposure.ts, unitView.ts,
              collections.ts, unitDetails.ts, quotePdf.ts, shareQuote.ts, tour.ts, tourRunner.ts, presentation.ts, fullscreen.ts
  store/      Zustand (selección, filtros, sol, favoritos, comparador)
  config/     aura.json, active.ts (config activa + edificios)     ← todo lo del cliente
public/clients/aura/   logo.svg, render/ (variantes generadas)
render-src/aura/       originales de los renders (los reemplaza el cliente)
supabase/migrations/   SQL
scripts/               seed.ts
```

## 8. Criterios de terminado
- Carga inicial < 3 s en 4G simulado; bundle inicial lo más ligero posible.
- ≥ 50 fps en un Android de gama media; funciona en Safari de iPhone.
- `frameloop="demand"` o equivalente: no renderizar cuando nada cambia.
- Los tres momentos de §2 funcionan diez veces seguidas sin fallar.
- Cambiar a otro cliente = nuevo JSON + nuevos datos, sin tocar `engine/`.

### 8.1 Auditoría final de rendimiento y accesibilidad (12 oct 2026)
Medido con `scripts/perf-server.cjs` (red 4G simulada y compartida, brotli, sin caché; incluye las fuentes de Google y el inventario de
Supabase), en un viewport de celular de 375×812, carga en frío, mediana de 3 corridas. Antes = estado previo a esta auditoría.

| Métrica | Antes | Después |
|---|---|---|
| **Torre visible**, 4G (9 Mbps · 170 ms) — masterplan / edificio | 4.1 s / 4.4 s | **2.1 s / 2.2 s** |
| Torre visible, 4G lento (1.6 Mbps · 150 ms) — masterplan / edificio | 5.9 s / 6.1 s | 4.1 s / 3.9 s |
| Primer pintado (pantalla de marca) | 0.92 s | 0.92 s |
| Descarga inicial (JS 410 KB + fuentes 85 KB + CSS) | 536 KB · 27 peticiones | 531 KB · 26 peticiones |
| Imágenes en `dist/clients/` | 3,979 KB | 2,797 KB (−30 %) |
| Imágenes guardadas para uso sin conexión | 3,979 KB | 2,171 KB (−45 %) |
| Llamadas de dibujo por cuadro, edificio / masterplan | 469 / 57 | **174 / 32** |
| Triángulos por cuadro, edificio | 268,194 | 75,420 (−72 %) |
| Pasadas de render por cuadro | 6 | 1 |
| CPU por cuadro, edificio (equipo de escritorio) | 4.0 ms | 2.3 ms |

**Qué se cambió y por qué**
- La pantalla de carga tapaba la animación de entrada de cámara (~2.4 s): ahora se retira en cuanto se dibuja el primer cuadro, así que la torre
  aparece cuando hay datos y la animación se ve (antes eran ~2 s de espera escondida). La barra sigue siendo real: arranque, inventario, código
  del edificio, escena y shaders compilados (`PrecompileScene`, en paralelo, antes del primer cuadro).
- Sombras: el mapa de sombras del sol se recalculaba en cada cuadro (dos veces: en el render principal y dentro de la sombra de contacto) y la
  sombra de contacto repetía la escena completa más cuatro pasadas de desenfoque. Ahora `StaticShadows` y `ContactShadow` se recalculan solo al
  cambiar el sol, el edificio activo, su detalle o si se está dentro de una unidad. Girar la cámara ya no las toca.
- Camino crítico: `preconnect` a Supabase y `modulepreload` del código del edificio (plugin `clientPreloadPlugin`); las fuentes del portal ya no
  se piden en el sitio público (eran 2 hojas de estilos que detenían el primer pintado) y la tipografía principal no bloquea el pintado; el
  inventario deja de hacer una consulta fallida en cada carga cuando la base aún no tiene `building_id` (se recuerda 30 min).
- Imágenes: interiores y amenidades pasan a WebP (≈ la mitad), la portada se recomprime y los JPG de respaldo del modo render ya no se guardan
  para uso sin conexión (`scripts/optimize-gallery-images.ts`).
- Errores y pantallas en blanco: ruta 404 (antes una dirección inválida no pintaba nada); indicador de carga en lugar de `null` mientras baja una
  pantalla, o mientras se revisa la sesión del admin y del portal; aviso con salida a los renders si el navegador no tiene WebGL (antes, el error
  genérico); recarga única si tras una publicación nueva falla un archivo con huella viejo. Ya existían: error del inventario con "Reintentar",
  `ErrorBoundary` global y recuperación de contexto WebGL.
- Accesibilidad: `<main>`, `<h1>` y descripción del lienzo 3D para lectores de pantalla; navegación con `aria-label` y `aria-current`; hojas modales
  con foco atrapado, Esc y regreso del foco; anillo de foco visible global; campos con nombre accesible; contraste del botón de WhatsApp de 1.98:1
  a 7.5:1; objetivos táctiles de al menos 24 px; `prefers-reduced-motion` también en la animación de entrada.

**Lo que NO se pudo medir aquí y queda por verificar:** los fps en un Android de gama media real (esta medición es de un equipo de escritorio:
las llamadas de dibujo, los triángulos y las pasadas son las cifras que viajan a un celular; lo medido aquí es ~1.7× menos CPU por cuadro (4.0 → 2.3 ms)).
Con 4G lento (1.6 Mbps, equivalente a 3G) la torre se ve a ~4 s y no a < 3 s: el piso son los 410 KB de JavaScript. Siguientes pasos si se necesita:
generar el mapa de reflejos sin `<Environment>` de drei (≈ −45 KB), cargar bajo demanda paneles y controles, y alojar las fuentes en el propio sitio.
El lienzo 3D no se opera con teclado (la selección de pisos y unidades es táctil/ratón): una lista de unidades sería la alternativa accesible.

## 9. Plan por días
| Día | Entregable |
|-----|------------|
| 1  | Proyecto base; torre extruida desde el JSON, con órbita |
| 2  | Materiales, HDRI, contexto urbano, animación de entrada |
| 3  | Raycasting: resaltar piso y unidad; colores por estado (datos mock) |
| 4  | Supabase: migraciones, RLS, seed de 46 unidades; conectar datos reales |
| 5  | Panel de unidad, plano SVG, WhatsApp, leads, URL por unidad |
| 6  | Filtros, transparencias, leyenda, contador |
| 7  | Admin con login + Realtime (momento 3) |
| 8  | Vista de fachada con polígonos SVG |
| 9  | Rendimiento y pruebas en dispositivos reales; deploy en Vercel |
| 10 | Pulido, QR, ensayo; asoleamiento si sobra tiempo |
