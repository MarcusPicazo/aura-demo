import type { LocalizedText } from './i18n/localized';
import type { Language } from './i18n/translate';
/** Punto 2D en metros, sobre el plano de planta: [x, z]. */
export type Point = [number, number];

/** Polígono simple (cerrado implícitamente) de una unidad tipo en la planta. */
export interface PlateUnit {
  type: string;
  polygon: Point[];
}

/** Unidad de penthouse: mismo polígono que PlateUnit, más su código de unidad. */
export interface PenthousePlateUnit extends PlateUnit {
  code: string;
}

export interface TowerGeometryConfig {
  floorHeight: number;
  slabThickness: number;
  groundFloorHeight: number;
  levels: number;
  plate: PlateUnit[];
  penthousePlate: PenthousePlateUnit[];
  core: Point[];
}

export interface BrandConfig {
  primary: string;
  accent: string;
  background: string;
  /** Ruta del logo del desarrollo, en `public/clients/<slug>/`. */
  logo: string;
}

/** Tinte sutil por estado, solo visible en modo "ver disponibilidad" — no el color saturado de la leyenda. */
export interface StatusTintConfig {
  available: string;
  reserved: string;
  sold: string;
}

/**
 * Materiales de la torre: nada de esto puede ser una constante dentro de `engine/` — el
 * motor recibe estos colores por config para poder mostrar un edificio con la fachada real
 * del cliente por default, y solo tintar por estado cuando se activa "ver disponibilidad".
 */
export interface MaterialsConfig {
  /** Concreto de losas, muros y núcleo. */
  concrete: string;
  /** Vidrio neutro por default (fuera del modo disponibilidad). */
  glass: string;
  /** Intensidad del reflejo del vidrio (envMapIntensity aproximado). */
  glassReflectivity: number;
  /** Perfiles/marcos (Edges) de losas, núcleo y unidades. */
  profile: string;
  /** Forro interior detrás del vidrio (oscuro, opaco): evita que la torre se vea hueca
   *  al dejar ver de lado a lado a través de dos caras de vidrio. */
  interior: string;
  /** Cuánto se encoge el forro interior respecto a la línea de vidrio, en metros. */
  interiorInset: number;
  statusTint: StatusTintConfig;
  /** Opacidad del vidrio en reposo cuando lleva tinte de estado (disponible/apartado) —
   *  más alta que `glass` neutro a propósito, para que el tinte se lea sin depender de
   *  que el reflejo del entorno coopere. */
  statusOpacity: number;
  /** Emisivo del tinte de estado en reposo: sin esto en 0 (como el vidrio neutro), el
   *  color de disponibilidad se perdía contra el reflejo del cielo. */
  statusEmissiveIntensity: number;
  /** Opacidad reducida específica de las unidades vendidas — se ven claramente apagadas
   *  frente a disponible/apartado, no solo con otro color. */
  soldOpacity: number;
  /** Emisivo casi nulo para vendidas: sin brillo, a propósito. */
  soldEmissiveIntensity: number;
}

/**
 * Carpintería de fachada (canceles): perfiles verticales a lo largo del perímetro de
 * vidrio de cada unidad, más un perfil horizontal arriba y abajo de cada nivel. Genérico
 * (no hay medidas ni colores de cliente dentro de `engine/`): todo esto es config.
 */
export interface CarpentryConfig {
  /** Separación objetivo entre perfiles verticales, en metros (p. ej. 1.35 → entre 1.2 y 1.5). */
  spacing: number;
  /** Ancho de la sección del perfil a lo largo de la fachada, en metros. */
  thickness: number;
  /** Cuánto sobresale el perfil más allá de la línea de vidrio, en metros — la profundidad
   *  real que hace que proyecte sombra dura hacia el vidrio (no una tira plana al ras). */
  depth: number;
  color: string;
}

/**
 * Balcones: se aplican en el perímetro de vidrio de cada unidad, en cada nivel (excepto
 * planta baja, que no tiene unidades). Canto de losa + barandal de vidrio + pasamanos
 * arriba, plafón de madera colgando abajo — todo proyectado `depth` metros más allá de la
 * línea de vidrio.
 */
export interface BalconyConfig {
  /** Cuánto proyecta el balcón más allá de la línea de vidrio, en metros. */
  depth: number;
  slabEdgeHeight: number;
  slabEdgeColor: string;
  railingHeight: number;
  railingColor: string;
  railingThickness: number;
  handrailColor: string;
  handrailHeight: number;
  soffitColor: string;
  soffitThickness: number;
  /** Maceta en algunos balcones, no todos: 1 de cada N en el orden en que se recorren
   *  (determinista, no al azar) — para que se vea habitado sin empalagar. */
  vegetationEveryNth: number;
  vegetationPotColor: string;
  vegetationPotHeight: number;
  vegetationPotRadius: number;
  vegetationFoliageColor: string;
  vegetationFoliageRadius: number;
}

/**
 * Planta baja: lobby de doble altura con vidrio, columnas delgadas alrededor de la huella,
 * y una marquesina en voladizo sobre la entrada (en el lado `marqueeSide` de la huella).
 */
export interface LobbyConfig {
  glassColor: string;
  glassReflectivity: number;
  columnSpacing: number;
  columnRadius: number;
  columnColor: string;
  /** Lado de la huella (bounding box) donde va la entrada/marquesina. */
  marqueeSide: 'minX' | 'maxX' | 'minZ' | 'maxZ';
  marqueeDepth: number;
  marqueeThickness: number;
  marqueeColor: string;
  /** A qué altura sobre el piso queda la losa de la marquesina, en metros. */
  marqueeElevation: number;
  /** Separación objetivo entre montantes verticales del vidrio del lobby, en metros —
   *  escala de vitrina/storefront, más abierta que `carpentry.spacing` de los niveles de arriba. */
  mullionSpacing: number;
  mullionThickness: number;
  /** Cuánto sobresale el montante más allá de la línea de vidrio, en metros. */
  mullionDepth: number;
}

/**
 * Límites de órbita de la cámara del selector 3D: qué tanto margen darle a la caja de
 * colisión alrededor de la torre (para no depender de a mano de balcones/remates de azotea
 * de este cliente en particular) y qué tan cenital o rasante puede llegar a verse.
 */
export interface CameraConfig {
  /** Margen horizontal (m) más allá de la huella real — cubre balcones y da colchón. */
  collisionHorizontalMargin: number;
  /** Margen (m) por encima de la altura total — cubre pérgola/equipo de azotea. */
  collisionTopMargin: number;
  /** Ángulo polar mínimo: qué tan cenital (vista de pájaro) se permite llegar a ver. */
  minPolarAngleDeg: number;
  /** Ángulo polar máximo: qué tan rasante (nivel de piso o por debajo) se permite llegar a ver. */
  maxPolarAngleDeg: number;
}

/**
 * Nubes del cielo del selector 3D. `cloudDistanceMargin` es la pieza que de verdad importa:
 * multiplica a `framing.maxDistance` (la distancia máxima a la que `OrbitControls` deja
 * alejar la cámara, calculada de la geometría real de la torre) para plantar las nubes
 * siempre MÁS ALLÁ de cualquier punto que la cámara pueda ocupar — así, sin importar el
 * ángulo o el zoom, nunca quedan entre la cámara y la torre.
 */
export interface SkyConfig {
  cloudCount: number;
  /** Cuántas nubes se muestran en pantallas angostas (móvil) — menos costo de relleno. */
  cloudCountMobile: number;
  cloudDistanceMargin: number;
  /** Múltiplo de la altura total de la torre. */
  cloudHeightFactor: number;
  cloudOpacity: number;
  cloudScale: number;
}

/**
 * Azotea: pretil perimetral (para que no se vea "cortada"), pérgola de madera sobre parte
 * de la losa de azotea, y un volumen pequeño de instalaciones.
 */
export interface RoofConfig {
  parapetHeight: number;
  parapetThickness: number;
  parapetColor: string;
  pergolaColor: string;
  pergolaHeight: number;
  pergolaBeamSpacing: number;
  pergolaBeamThickness: number;
  /** Fracción (0–1) de cada dimensión de la huella que cubre la pérgola, centrada. */
  pergolaCoverage: number;
  equipmentColor: string;
  /** Ancho, alto y profundo del volumen de instalaciones, en metros. */
  equipmentSize: [number, number, number];
  /** Jardineras a lo largo del pretil, separadas como máximo estos metros. */
  vegetationSpacing: number;
  /** Qué tanto hacia adentro del pretil quedan las jardineras, en metros. */
  vegetationSetback: number;
  vegetationPotColor: string;
  vegetationPotHeight: number;
  vegetationPotRadius: number;
  vegetationFoliageColor: string;
  vegetationFoliageRadius: number;
  /** Remate del núcleo: un volumen macizo sobre la huella del núcleo, más alto que el
   *  pretil — corona el eje de circulaciones para que se lea como parte de un solo
   *  volumen, no como un corte entre dos torres. */
  coreCapHeight: number;
}

/**
 * Esquema de pagos: enganche (ajustable con un control) + saldo contra entrega (fijo,
 * normalmente crédito/hipoteca) + mensualidades durante la obra, que cubren lo que sobra
 * del precio después de esos dos. Por eso mover el enganche cambia las mensualidades,
 * nunca el saldo contra entrega.
 */
export interface PaymentPlanConfig {
  /** Valor inicial del control de enganche, 0–100. */
  downPaymentPercent: number;
  minDownPaymentPercent: number;
  maxDownPaymentPercent: number;
  /** Porcentaje del precio que se liquida contra entrega — fijo, no lo mueve el control. */
  balanceAtDeliveryPercent: number;
  constructionMonths: number;
  /** Fecha estimada de entrega, ISO (`YYYY-MM-DD`) — se muestra por mes/año. */
  deliveryDate: string;
}

/** Una amenidad del desarrollo: `icon` es una clave de `AMENITY_ICONS` (views/AmenityIcons.tsx),
 *  no una URL ni un componente — así la config sigue siendo JSON plano. */
export interface AmenityConfig {
  icon: string;
  label: LocalizedText;
  /** Ruta en `public/clients/<slug>/amenities/`. Opcional: si falta, la tarjeta se queda
   *  solo con ícono y no abre la vista en grande. */
  image?: string;
  /** Texto para la vista en grande; sin esto solo se muestra el nombre. */
  description?: LocalizedText;
}

/** Punto de interés cercano al desarrollo (sin coordenadas propias: solo se lista, no se
 *  marca en el mapa individualmente). */
export interface PointOfInterestConfig {
  name: LocalizedText;
  /** Minutos aproximados a pie; si no se da, se omite el badge de distancia. */
  distanceMinutes?: number;
}

export interface ProjectLocationConfig {
  lat: number;
  lng: number;
  address: LocalizedText;
}

/** Sección de proyecto: descripción corta, amenidades, ubicación y puntos de interés —
 *  todo dato de negocio del cliente, nada de esto vive en `engine/`. */
export interface ProjectInfoConfig {
  description: LocalizedText;
  amenities: AmenityConfig[];
  location: ProjectLocationConfig;
  pointsOfInterest: PointOfInterestConfig[];
}

/** Ficha comercial del asesor de ventas: accesible desde la interfaz principal y desde la
 *  ficha de unidad. Cada desarrolladora tiene su propio equipo — nada de esto puede vivir
 *  fijo en el código, todo sale de la config del cliente. */
export interface AdvisorConfig {
  name: string;
  role: LocalizedText;
  /** Ruta en `public/clients/<slug>/`. Opcional: sin ella, la ficha muestra un avatar con
   *  las iniciales del nombre en vez de romperse (mismo patrón que `AmenityConfig.image`). */
  photo?: string;
  /** E.164 sin "+" (ej. 5215500000000) — se usa para el enlace `tel:` y como número de
   *  WhatsApp del asesor. */
  phone: string;
  email: string;
  hours: LocalizedText;
  salesOffice: ProjectLocationConfig;
  /** Ruta del PDF del brochure en `public/clients/<slug>/`. */
  brochureUrl: string;
}

/** Lado de la huella (bounding box) de la torre: hacia dónde da la calle o la marquesina. */
export type FootprintSide = 'minX' | 'maxX' | 'minZ' | 'maxZ';

/** Piso: asfalto con línea central, banquetas con guarnición, coches estacionados. */
export interface StreetConfig {
  side: FootprintSide;
  /** Separación entre el pie de la torre y el arroyo, en metros. */
  distanceFromTower: number;
  width: number;
  sidewalkWidth: number;
  curbHeight: number;
  asphaltColor: string;
  lineColor: string;
  sidewalkColor: string;
  curbColor: string;
  carSpacing: number;
  /** Paleta discreta de colores de coche; se reparte determinísticamente por posición. */
  carColors: string[];
  carWidth: number;
  carLength: number;
  carHeight: number;
}

/** Árboles instanciados (tronco + copa) a lo largo de la banqueta. */
export interface TreeConfig {
  spacing: number;
  /** Qué tan lejos del borde exterior de la banqueta, en metros. */
  setback: number;
  trunkColor: string;
  trunkRadius: number;
  trunkHeight: number;
  canopyColor: string;
  canopyRadius: number;
}

/**
 * Edificios vecinos: antes eran cajas grises semitransparentes flotando. Ahora son masas
 * opacas de 3-8 niveles con tono variado y una cuadrícula de ventanas por textura,
 * repartidas de forma determinista (no aleatoria) en un anillo alrededor de la torre que
 * evita el lado de la calle, a una distancia mínima garantizada.
 */
export interface NeighborBuildingsConfig {
  count: number;
  minLevels: number;
  maxLevels: number;
  levelHeight: number;
  minWidth: number;
  maxWidth: number;
  /** Separación mínima entre el pie de la torre y la cara más cercana de cualquier vecino. */
  minClearance: number;
  /** Paleta de tonos de fachada; se reparte determinísticamente por índice de edificio. Más
   *  oscura y con algo más de saturación que el cielo/niebla — si quedan casi del mismo
   *  valor tonal, se pierden contra el fondo sin importar qué tan bien esté calculada la
   *  niebla. */
  tones: string[];
  windowColor: string;
  /** Opacidad de la mancha oscura (oclusión ambiental falsa) en la base de cada vecino —
   *  0 la desactiva. */
  baseOcclusionOpacity: number;
  /** Cuánto más ancha que la huella del edificio es esa mancha, como fracción extra (0.2 =
   *  20% más ancha por lado). */
  baseOcclusionMargin: number;
}

export interface GroundConfig {
  color: string;
  noiseColor: string;
  /** Múltiplo del span de la huella de la torre para el tamaño del plano de piso. */
  sizeFactor: number;
}

/** Entorno urbano: todo procedural, todo parametrizado — nada de esto vive en `engine/`. */
export interface ContextConfig {
  ground: GroundConfig;
  street: StreetConfig;
  trees: TreeConfig;
  neighborBuildings: NeighborBuildingsConfig;
}

/**
 * Imagen del modo render. Los archivos los genera `scripts/build-render-images.ts` a partir
 * del original del cliente: `<base>-<ancho>.webp` por cada ancho de `widths` (para `srcset`)
 * y `<base>.jpg` como respaldo. Mientras `width`/`height` coincidan con el original, la capa
 * de zonas clicables queda alineada con la imagen sin importar qué variante descargue el
 * navegador.
 */
export interface RenderImage {
  /** Ruta bajo `public/`, sin ancho ni extensión (p. ej. `/clients/<slug>/render/frente`). */
  base: string;
  /** Anchos (px) generados, de menor a mayor. */
  widths: number[];
  /** Tamaño en px de la imagen original: fija la proporción y el viewBox de las zonas. */
  width: number;
  height: number;
  alt: LocalizedText;
}

/** A dónde lleva una zona: a otra vista (opcionalmente a un nivel de planta) o a la ficha de una unidad. */
export type RenderHotspotTarget =
  | { type: 'view'; viewId: string; floor?: number }
  /** `buildingId` solo hace falta en un conjunto cuyos edificios repiten códigos (101 en cada torre). */
  | { type: 'unit'; code: string; buildingId?: string };

/** Zona clicable sobre una imagen. `polygon` va en fracciones 0–1 de la imagen (x a la derecha, y hacia abajo). */
export interface RenderHotspot {
  id: string;
  label: LocalizedText;
  polygon: Point[];
  target: RenderHotspotTarget;
}

/** Un nivel de una vista de planta: su imagen y las zonas (normalmente una por unidad). */
export interface RenderLevelConfig {
  floor: number;
  label: LocalizedText;
  image: RenderImage;
  hotspots: RenderHotspot[];
}

export interface RenderImageViewConfig {
  id: string;
  label: LocalizedText;
  /** `aerial` = vista del conjunto; `facade` = alzado de una fachada. Solo cambia el rótulo; se comportan igual. */
  kind: 'aerial' | 'facade';
  image: RenderImage;
  hotspots: RenderHotspot[];
}

/** Planta por nivel: el selector lateral de piso recorre `levels`. */
export interface RenderPlanViewConfig {
  id: string;
  label: LocalizedText;
  kind: 'plan';
  levels: RenderLevelConfig[];
}

/**
 * Planta por nivel dibujada por el motor (cámara ortográfica cenital sobre el nivel), sin
 * imágenes externas: sale de `geometry` y `floorPlans`, así que siempre coincide con el
 * inventario. Solo está disponible si el desarrollo tiene modelo 3D (necesita `geometry`).
 */
export interface RenderGeneratedPlanViewConfig {
  id: string;
  label: LocalizedText;
  kind: 'generatedPlan';
  /** Edificio cuyas plantas dibuja. Por omisión, el primero con unidades a la venta. */
  buildingId?: string;
}

/** Vistas que se muestran con una imagen (y sus zonas); la planta generada no tiene imagen. */
export type RenderImageBackedViewConfig = RenderImageViewConfig | RenderPlanViewConfig;

export type RenderViewConfig = RenderImageBackedViewConfig | RenderGeneratedPlanViewConfig;

/** Modo render (imágenes con zonas clicables): alternativa o complemento del selector 3D. */
export interface RenderConfig {
  defaultViewId: string;
  views: RenderViewConfig[];
}

/** Ficha de negocio de un tipo de unidad (recámaras, m², precio base, orientación). */
export interface UnitTypeSpec {
  bedrooms: number;
  bathrooms: number;
  m2: number;
  priceBase: number;
  orientation: string;
}

/** Segmento de muro (con grosor) o de ventana, en metros, coordenadas locales del plano de la unidad. */
export interface WallSegment {
  from: Point;
  to: Point;
}

/**
 * Puerta como símbolo arquitectónico: hoja + arco de abatimiento de un cuarto de círculo.
 * `hinge` es el punto donde pivota (extremo del vano sobre el muro), `angle` (grados) es la
 * dirección del muro en ese punto (hacia dónde corre el vano cerrado), `swing` decide hacia qué
 * lado gira la hoja (1 = sentido horario, -1 = antihorario) y `width` es el ancho del vano.
 */
export interface DoorSymbol {
  hinge: Point;
  angle: number;
  width: number;
  swing: 1 | -1;
}

/** Espacio con nombre: el m² se calcula del polígono (shoelace), no se captura a mano. */
export interface RoomLabel {
  label: LocalizedText;
  polygon: Point[];
}

export type FurnitureType =
  | 'bed_double'
  | 'bed_single'
  | 'sofa'
  | 'dining_table'
  | 'kitchen'
  | 'toilet'
  | 'sink'
  | 'shower';

/** Pieza de mobiliario: símbolo 2D genérico ubicado y rotado en el plano de la unidad. */
export interface FurniturePiece {
  type: FurnitureType;
  position: Point;
  /** Grados, sentido horario. 0 = orientación por defecto del símbolo. */
  rotation?: number;
}

/**
 * Plano de una unidad tipo: `drawn` lo genera el motor a partir de datos (muros, puertas,
 * ventanas, espacios, mobiliario); `image` es la alternativa para clientes reales que ya
 * tienen un plano exportado (PNG o SVG) y no quieren describirlo como datos.
 */
export type FloorPlanConfig =
  | { kind: 'image'; src: string }
  | {
      kind: 'drawn';
      wallThickness: number;
      walls: WallSegment[];
      doors: DoorSymbol[];
      windows: WallSegment[];
      rooms: RoomLabel[];
      furniture: FurniturePiece[];
    };

/**
 * Todo lo que solo existe para dibujar el modelo 3D. Un cliente que entrega únicamente
 * renders no tiene nada de esto, por eso `DevelopmentConfig` lo declara opcional (ver
 * `lib/modes.ts`); el selector 3D y el motor trabajan con `TowerDevelopmentConfig`.
 */
export interface Tower3DConfig {
  materials: MaterialsConfig;
  carpentry: CarpentryConfig;
  balcony: BalconyConfig;
  lobby: LobbyConfig;
  roof: RoofConfig;
  context: ContextConfig;
  camera: CameraConfig;
  sky: SkyConfig;
}

/** Qué es un edificio del conjunto; solo cambia cómo se rotula y si lleva unidades a la venta. */
export type BuildingKind = 'tower' | 'clubhouse' | 'amenity';

/**
 * Un edificio de un conjunto: su propia geometría (niveles, plantas, núcleo) puesta en el
 * conjunto con una posición y un giro. Materiales, carpintería, balcones, entorno y cámara
 * son compartidos por todo el conjunto (`Tower3DConfig`).
 */
export interface BuildingConfig {
  /** Identificador estable: va en la URL (`/aura/edificio/<id>`) y en `units.building_id`. */
  id: string;
  name: LocalizedText;
  kind: BuildingKind;
  /** Dónde queda el centro de su huella en el conjunto: [x, z] en metros. */
  position: Point;
  /** Giro de su huella, en grados, sentido horario visto desde arriba. */
  rotationDeg: number;
  geometry: TowerGeometryConfig;
  /** Tiene unidades en el inventario. Por omisión solo las torres (`kind: "tower"`) las tienen. */
  sellable?: boolean;
  /** Texto breve del panel de un edificio sin unidades (casa club, amenidades). */
  description?: LocalizedText;
}

/**
 * Asoleamiento: dónde está el desarrollo y cómo se analiza el sol. Con esto el sol de la escena sigue la
 * posición solar real (hora del día y fecha del año) y cada unidad sabe cuántas horas de sol directo recibe.
 * Sin esta sección el selector conserva su sol fijo y no ofrece el control ni el indicador.
 */
export interface SolarConfig {
  latitude: number;
  /** Longitud en grados; negativa al oeste de Greenwich (CDMX: -99.13). */
  longitude: number;
  /** Diferencia con UTC en horas, la de la hora local que muestra el control (CDMX: -6, sin horario de verano desde 2022). */
  utcOffsetHours: number;
  /** Hacia dónde queda el norte en el plano de planta: grados en sentido horario desde "arriba" (el eje -z). 0 = el norte está arriba. */
  northAngleDeg: number;
  /** Fecha inicial del control (MM-DD) y hora local inicial (decimal: 16.5 = 4:30 pm). */
  defaultDate: string;
  defaultHour: number;
  /** Rango de horas locales del control de hora. */
  hourRange: [number, number];
  /** Elevación mínima del sol (grados) para contarlo como sol directo; bajo ese ángulo casi no calienta ni ilumina. */
  minSunElevationDeg: number;
  /** Cada cuántos minutos se muestrea el día al estimar las horas de sol de una unidad. */
  sampleMinutes: number;
  /** "Sol de tarde": desde qué hora local cuenta como tarde y cuántas horas mínimas hacen falta. */
  afternoonFromHour: number;
  afternoonMinHours: number;
  /** Fechas rápidas del control (MM-DD). */
  presets: { label: LocalizedText; date: string }[];
}

/** Vista desde la unidad: la cámara dentro del departamento, mirando hacia afuera. */
export interface UnitViewConfig {
  /** Altura de los ojos sobre el piso del nivel, en metros. */
  eyeHeight: number;
  /** Cuánto se separa la cámara del vidrio, hacia adentro, en metros. */
  wallInset: number;
  /** Campo de visión vertical dentro de la unidad (más abierto que el de la vista exterior). */
  fov: number;
  /** Cuánto se puede girar la cabeza a cada lado, hacia arriba y hacia abajo, en grados. */
  yawLimitDeg: number;
  pitchUpDeg: number;
  pitchDownDeg: number;
  /** Duración del vuelo de entrada y de regreso, en segundos. */
  flightSeconds: number;
}

/**
 * Idiomas de la interfaz que ofrece el desarrollo. La interfaz abre en el idioma del navegador si está entre estos; si
 * no, en `defaultLanguage`. Con un solo idioma no aparece el selector. Los textos de la config (`LocalizedText`) sin
 * versión en el idioma elegido caen al `defaultLanguage`.
 */
export interface I18nConfig {
  languages: Language[];
  defaultLanguage: Language;
}

/**
 * Cambio de moneda MXN/USD. El precio oficial es en pesos; el dólar es una conversión referencial con este tipo de
 * cambio, que el cliente actualiza a mano aquí (no se consulta ningún servicio). Sin esta sección solo hay pesos.
 */
export interface CurrencyConfig {
  /** Pesos por un dólar (por ejemplo 18.5). */
  usdRate: number;
  /** Fecha del tipo de cambio (ISO `YYYY-MM-DD`): se muestra en la nota "referencial". */
  asOf: string;
}

/**
 * Modo presentación (recorrido automático) y modo showroom (pantalla de kiosco). Sin esta sección el desarrollo usa los
 * valores por omisión de abajo.
 */
export interface PresentationConfig {
  /** Duración del recorrido, en segundos (por omisión 45). */
  tourSeconds?: number;
  /** Unidad que visita el recorrido: `edificio:código` (o el código en una torre). Sin ella, la disponible más alta con vista. */
  featuredUnit?: string;
  /** Segundos sin uso para que el showroom arranque el recorrido solo (por omisión 120). */
  idleSeconds?: number;
  /** Horas locales entre las que el recorrido barre el asoleamiento (por omisión 7 → 18); requiere `solar`. */
  sunSweepHours?: [number, number];
}

/** App instalable (PWA). Todo opcional: el manifiesto toma el resto de la marca del desarrollo. */
export interface PwaConfig {
  /** Nombre bajo el ícono de la pantalla de inicio (≤ 12 caracteres); por omisión, las primeras palabras del nombre. */
  shortName?: string;
  /** Cómo abre la app instalada; `fullscreen` para una pantalla de showroom. */
  display?: 'standalone' | 'fullscreen' | 'minimal-ui';
}

export interface DevelopmentConfig extends Partial<Tower3DConfig> {
  /** App instalable y sin conexión. */
  pwa?: PwaConfig;
  /** Recorrido automático y showroom. */
  presentation?: PresentationConfig;
  /** Idiomas de la interfaz. Sin esto solo hay español. */
  i18n?: I18nConfig;
  /** Moneda: tipo de cambio para ver los precios en dólares. Sin esto solo hay pesos. */
  currency?: CurrencyConfig;
  /** Geometría de un desarrollo de una sola torre. Un conjunto la omite y declara `buildings`. */
  geometry?: TowerGeometryConfig;
  /** Varios edificios (torres, casa club, amenidades), cada uno con su posición, giro y geometría. */
  buildings?: BuildingConfig[];
  /** Asoleamiento (control de hora y fecha, horas de sol por unidad). Sin esto no hay. */
  solar?: SolarConfig;
  /** Vista desde la unidad. Sin esto no hay botón. */
  unitView?: UnitViewConfig;
  slug: string;
  name: string;
  tagline: LocalizedText;
  whatsapp: string;
  brand: BrandConfig;
  paymentPlan: PaymentPlanConfig;
  /** Ficha de negocio por tipo (A, B, C, D...), aplica a las unidades de `geometry.plate`. */
  unitTypes: Record<string, UnitTypeSpec>;
  /** Ficha de negocio por código, para los penthouses únicos de `geometry.penthousePlate`. */
  penthouseUnitTypes: Record<string, UnitTypeSpec>;
  /** Plano por tipo (o por código en penthouses) — misma clave que usa `findUnitPolygon`. */
  floorPlans: Record<string, FloorPlanConfig>;
  /** Rutas de renders interiores por tipo/código, en `public/clients/<slug>/interiors/<clave>/`. */
  interiors: Record<string, string[]>;
  /** Modo render. Sin esto el cliente no tiene pestaña de render. */
  render?: RenderConfig;
  project: ProjectInfoConfig;
  legal: LegalConfig;
  advisor: AdvisorConfig;
  seo: SeoConfig;
}

/** Cliente con modelo 3D: `DevelopmentConfig` con todas las secciones de `Tower3DConfig` presentes. */
export type TowerDevelopmentConfig = DevelopmentConfig & Tower3DConfig;

/** Metadatos para compartir el sitio: favicon, y las etiquetas Open Graph/Twitter Card que
 *  arman la tarjeta de vista previa al pegar el link (WhatsApp, Facebook, Twitter/X...).
 *  Se generan en el HTML servido, no con JS del lado del cliente — esos bots no ejecutan
 *  JavaScript, arman la tarjeta solo con lo que ya viene en el HTML (ver vite.config.ts). */
export interface SeoConfig {
  /** URL pública del sitio ya publicado, sin slash final (ej. https://mi-torre.vercel.app)
   *  — hace falta para que `og:image`/`og:url` sean absolutas; WhatsApp y Facebook no
   *  resuelven imágenes con ruta relativa. */
  siteUrl: string;
  /** Ruta en `public/clients/<slug>/` del ícono cuadrado para favicon (SVG). Distinto del
   *  logo completo (`brand.logo`, un lockup horizontal con texto) — un favicon necesita
   *  una marca cuadrada y legible en miniatura. */
  icon: string;
  /** Ruta en `public/clients/<slug>/` de la imagen para la tarjeta de vista previa
   *  (og:image / twitter:image). */
  ogImage: string;
}

/** Datos del responsable para el aviso de privacidad (LFPDPPP) — de la config del
 *  cliente, nunca fijos en el texto de la página. */
export interface LegalConfig {
  privacyResponsibleParty: LocalizedText;
  privacyAddress: LocalizedText;
  privacyContactEmail: string;
}

export type UnitStatus = 'available' | 'reserved' | 'sold';

/** Colores de la planta. Llegan por props: el motor no trae ninguna paleta de un cliente. */
export interface FloorPlanStyle {
  paper: string;
  /** Losa del nivel (se ve en los vestíbulos entre unidades). */
  slab: string;
  /** Piso de una unidad cuando no se pinta por estado. */
  unitFill: string;
  /** Piso de una unidad por estado de disponibilidad (se mezcla con `unitFill`). */
  statusFill: Record<UnitStatus, string>;
  core: string;
  outline: string;
  wall: string;
  window: string;
  door: string;
  furniture: string;
  codeText: string;
  codeHalo: string;
  /** Contorno de la unidad seleccionada. */
  selected: string;
}

/** Unidad de negocio, tal como vive en la tabla `units` de Supabase. */
export interface Unit {
  id: string;
  /** A qué edificio del conjunto pertenece (`BuildingConfig.id`); en un desarrollo de una torre, `principal`. */
  buildingId: string;
  code: string;
  floor: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  m2: number;
  price: number;
  orientation: string;
  status: UnitStatus;
}

/** De dónde vino el lead: clic directo en "Me interesa" (WhatsApp) o el formulario
 *  opcional de nombre/teléfono, que exige la casilla de consentimiento. */
export type LeadOrigin = 'whatsapp' | 'form';

/** Lead tal como lo lee el admin, con el código de unidad ya resuelto (join a `units`). */
export interface Lead {
  id: string;
  createdAt: string;
  unitCode: string | null;
  name: string | null;
  phone: string | null;
  origin: LeadOrigin;
  consentAt: string | null;
}

/** Analítica ligera (tabla `events`, se vende como reporte mensual): un valor por cada
 *  momento que vale la pena contar, ver `lib/analytics.ts`. */
export type AnalyticsEventType =
  | 'selector_view'
  | 'unit_view'
  | 'filter_used'
  | 'interest_click'
  | 'lead_submitted'
  | 'project_view';

/** Evento tal como lo lee el admin, con el código de unidad ya resuelto (join a `units`). */
export interface AnalyticsEvent {
  id: string;
  createdAt: string;
  type: AnalyticsEventType;
  unitCode: string | null;
}
