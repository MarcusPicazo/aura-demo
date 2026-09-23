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

export interface CameraConfig {
  intro: [number, number, number];
  target: [number, number, number];
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
  statusTint: StatusTintConfig;
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
  label: string;
}

/** Punto de interés cercano al desarrollo (sin coordenadas propias: solo se lista, no se
 *  marca en el mapa individualmente). */
export interface PointOfInterestConfig {
  name: string;
  /** Minutos aproximados a pie; si no se da, se omite el badge de distancia. */
  distanceMinutes?: number;
}

export interface ProjectLocationConfig {
  lat: number;
  lng: number;
  address: string;
}

/** Sección de proyecto: descripción corta, amenidades, ubicación y puntos de interés —
 *  todo dato de negocio del cliente, nada de esto vive en `engine/`. */
export interface ProjectInfoConfig {
  description: string;
  amenities: AmenityConfig[];
  location: ProjectLocationConfig;
  pointsOfInterest: PointOfInterestConfig[];
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
  /** Paleta de tonos de fachada; se reparte determinísticamente por índice de edificio. */
  tones: string[];
  windowColor: string;
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

export interface FacadeFloorConfig {
  floor: number;
  polygon: Point[];
}

export interface FacadeConfig {
  image: string;
  floors: FacadeFloorConfig[];
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
  label: string;
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

export interface DevelopmentConfig {
  slug: string;
  name: string;
  tagline: string;
  whatsapp: string;
  brand: BrandConfig;
  materials: MaterialsConfig;
  carpentry: CarpentryConfig;
  balcony: BalconyConfig;
  lobby: LobbyConfig;
  roof: RoofConfig;
  context: ContextConfig;
  paymentPlan: PaymentPlanConfig;
  geometry: TowerGeometryConfig;
  /** Ficha de negocio por tipo (A, B, C, D...), aplica a las unidades de `geometry.plate`. */
  unitTypes: Record<string, UnitTypeSpec>;
  /** Ficha de negocio por código, para los penthouses únicos de `geometry.penthousePlate`. */
  penthouseUnitTypes: Record<string, UnitTypeSpec>;
  /** Plano por tipo (o por código en penthouses) — misma clave que usa `findUnitPolygon`. */
  floorPlans: Record<string, FloorPlanConfig>;
  /** Rutas de renders interiores por tipo/código, en `public/clients/<slug>/interiors/<clave>/`. */
  interiors: Record<string, string[]>;
  camera: CameraConfig;
  facade: FacadeConfig;
  project: ProjectInfoConfig;
  legal: LegalConfig;
}

/** Datos del responsable para el aviso de privacidad (LFPDPPP) — de la config del
 *  cliente, nunca fijos en el texto de la página. */
export interface LegalConfig {
  privacyResponsibleParty: string;
  privacyAddress: string;
  privacyContactEmail: string;
}

export type UnitStatus = 'available' | 'reserved' | 'sold';

/** Unidad de negocio, tal como vive en la tabla `units` de Supabase. */
export interface Unit {
  id: string;
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
