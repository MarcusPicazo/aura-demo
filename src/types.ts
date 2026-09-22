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
