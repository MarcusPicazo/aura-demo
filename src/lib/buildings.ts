import { buildTowerLayout, polygonBounds, type PolygonBounds } from './geometry';
import type { LocalizedText } from '../i18n/localized';
import type { BuildingConfig, BuildingKind, DevelopmentConfig, Point, TowerGeometryConfig, Unit, UnitStatus } from '../types';

/** Id del edificio de un desarrollo de una sola torre, y el valor por omisión de `units.building_id`. */
export const DEFAULT_BUILDING_ID = 'principal';

export const MASTERPLAN_PATH = '/aura';

/** Un edificio ya normalizado: `sellable` resuelto y listo para usar sin mirar el config original. */
export interface ResolvedBuilding {
  id: string;
  name: LocalizedText;
  kind: BuildingKind;
  position: Point;
  rotationDeg: number;
  geometry: TowerGeometryConfig;
  sellable: boolean;
  description?: LocalizedText;
}

export function footprintCenter(geometry: TowerGeometryConfig): Point {
  const { footprint } = buildTowerLayout(geometry);
  return [(footprint.minX + footprint.maxX) / 2, (footprint.minZ + footprint.maxZ) / 2];
}

/**
 * Los edificios del desarrollo: los que declara `buildings`, o —si no declara ninguno— uno
 * implícito con la `geometry` de nivel superior, colocado de modo que su transformación sea
 * la identidad (coordenadas del mundo = coordenadas de su planta, como antes de los conjuntos).
 */
export function resolveBuildings(config: Pick<DevelopmentConfig, 'buildings' | 'geometry' | 'name'>): ResolvedBuilding[] {
  if (config.buildings && config.buildings.length > 0) {
    return config.buildings.map((building: BuildingConfig) => ({
      id: building.id,
      name: building.name,
      kind: building.kind,
      position: building.position,
      rotationDeg: building.rotationDeg,
      geometry: building.geometry,
      sellable: building.sellable ?? building.kind === 'tower',
      description: building.description,
    }));
  }
  if (config.geometry) {
    return [
      {
        id: DEFAULT_BUILDING_ID,
        name: config.name,
        kind: 'tower',
        position: footprintCenter(config.geometry),
        rotationDeg: 0,
        geometry: config.geometry,
        sellable: true,
      },
    ];
  }
  return [];
}

export function buildingHeight(building: Pick<ResolvedBuilding, 'geometry'>): number {
  return buildTowerLayout(building.geometry).totalHeight;
}

// ─── Colocación en el conjunto ───────────────────────────────────────────────────────

export interface BuildingPlacement {
  /** Dónde queda el pivote (centro de la huella) en el mundo: [x, z]. */
  position: Point;
  /** Centro de la huella en las coordenadas locales de la planta: [x, z]. */
  pivot: Point;
  /** Giro alrededor de Y en radianes, en la convención de three.js (positivo = antihorario visto desde arriba). */
  rotationY: number;
}

export function buildingPlacement(building: Pick<ResolvedBuilding, 'position' | 'rotationDeg' | 'geometry'>): BuildingPlacement {
  return {
    position: building.position,
    pivot: footprintCenter(building.geometry),
    // El config gira en sentido horario visto desde arriba; en three.js un giro positivo en Y es antihorario.
    rotationY: (-building.rotationDeg * Math.PI) / 180,
  };
}

/** Un punto de la planta local de un edificio ([x, z] en metros) llevado a coordenadas del mundo. */
export function localToWorld(building: Pick<ResolvedBuilding, 'position' | 'rotationDeg' | 'geometry'>, [x, z]: Point): Point {
  const { position, pivot, rotationY } = buildingPlacement(building);
  const dx = x - pivot[0];
  const dz = z - pivot[1];
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  // Misma matriz de giro en Y que usa three.js: x' = x·cos + z·sin ; z' = −x·sin + z·cos.
  return [position[0] + dx * cos + dz * sin, position[1] - dx * sin + dz * cos];
}

/** Esquinas de la caja de su huella, ya giradas y trasladadas al mundo. */
export function worldFootprint(building: Pick<ResolvedBuilding, 'position' | 'rotationDeg' | 'geometry'>): Point[] {
  const { footprint } = buildTowerLayout(building.geometry);
  const corners: Point[] = [
    [footprint.minX, footprint.minZ],
    [footprint.maxX, footprint.minZ],
    [footprint.maxX, footprint.maxZ],
    [footprint.minX, footprint.maxZ],
  ];
  return corners.map((corner) => localToWorld(building, corner));
}

/** Caja alineada a los ejes que envuelve su huella en el mundo. */
export function worldBounds(building: Pick<ResolvedBuilding, 'position' | 'rotationDeg' | 'geometry'>): PolygonBounds {
  return polygonBounds([worldFootprint(building)]);
}

export function ensembleBounds(buildings: Pick<ResolvedBuilding, 'position' | 'rotationDeg' | 'geometry'>[]): PolygonBounds {
  return polygonBounds(buildings.map((building) => worldFootprint(building)));
}

export function ensembleHeight(buildings: Pick<ResolvedBuilding, 'geometry'>[]): number {
  return Math.max(0, ...buildings.map(buildingHeight));
}

// ─── Identidad de una unidad dentro del conjunto ─────────────────────────────────────

export interface UnitIdentity {
  /** El desarrollo tiene más de un edificio (y por tanto los códigos pueden repetirse). */
  multi: boolean;
  /** Edificio al que se asignan las unidades que no traen uno válido (las sembradas antes de existir `building_id`). */
  defaultBuildingId: string;
  /** Cómo viaja una unidad en la URL y en el store: el código solo (una torre) o `edificio:código` (conjunto). */
  param: (unit: Pick<Unit, 'buildingId' | 'code'>) => string;
  /** Inversa de `param`. Acepta también el enlace viejo de un conjunto (solo el código) si no es ambiguo. */
  find: (units: Unit[], param: string | null | undefined) => Unit | undefined;
  /** Ruta del selector 3D que abre esa unidad. */
  path: (unit: Pick<Unit, 'buildingId' | 'code'>) => string;
  /** Lo mismo, pero desde un `edificio + código` sueltos (aún sin la unidad cargada). */
  pathFor: (buildingId: string, code: string) => string;
}

export function createUnitIdentity(buildings: Pick<ResolvedBuilding, 'id' | 'sellable'>[]): UnitIdentity {
  const multi = buildings.length > 1;
  const defaultBuildingId = (buildings.find((building) => building.sellable) ?? buildings[0])?.id ?? DEFAULT_BUILDING_ID;

  const param = (unit: Pick<Unit, 'buildingId' | 'code'>) => (multi ? `${unit.buildingId}:${unit.code}` : unit.code);
  const pathFor = (buildingId: string, code: string) => (multi ? `${MASTERPLAN_PATH}/edificio/${buildingId}/unidad/${code}` : `${MASTERPLAN_PATH}/unidad/${code}`);

  return {
    multi,
    defaultBuildingId,
    param,
    pathFor,
    path: (unit) => pathFor(unit.buildingId, unit.code),
    find: (units, value) => {
      if (!value) return undefined;
      if (!multi) return units.find((unit) => unit.code === value);
      const separator = value.indexOf(':');
      if (separator > 0) {
        const buildingId = value.slice(0, separator);
        const code = value.slice(separator + 1);
        return units.find((unit) => unit.buildingId === buildingId && unit.code === code);
      }
      const matches = units.filter((unit) => unit.code === value);
      return matches.length === 1 ? matches[0] : undefined;
    },
  };
}

/**
 * Las unidades sin un edificio válido (las que ya estaban en Supabase antes de existir
 * `building_id` quedan con el valor por omisión `principal`) pasan al edificio por omisión del
 * conjunto: así el inventario viejo sigue visible mientras se corre el seed nuevo.
 */
export function assignBuildings(units: Unit[], buildings: Pick<ResolvedBuilding, 'id'>[], defaultBuildingId: string): Unit[] {
  const known = new Set(buildings.map((building) => building.id));
  return units.map((unit) => (known.has(unit.buildingId) ? unit : { ...unit, buildingId: defaultBuildingId }));
}

// ─── Volumen del masterplan ──────────────────────────────────────────────────────────

/** Una franja horizontal del volumen simplificado de un edificio: de qué altura a qué altura y de qué color. */
export interface MassingBand {
  y: number;
  height: number;
  color: string;
}

/**
 * Franjas del volumen de un edificio visto de lejos: la planta baja, y por cada nivel una franja de
 * vidrio con su losa encima. Es lo mínimo para que se lea como un edificio de N pisos y no como un
 * bloque liso, sin pagar el detalle (balcones, canceles) que solo tiene el edificio activo.
 */
export function massingBands(geometry: TowerGeometryConfig, colors: { slab: string; glass: string; ground: string }): MassingBand[] {
  const { groundFloorHeight, floorHeight, slabThickness, levels } = geometry;
  const bands: MassingBand[] = [{ y: 0, height: groundFloorHeight, color: colors.ground }];
  for (let level = 1; level <= levels; level += 1) {
    const base = groundFloorHeight + (level - 1) * floorHeight;
    bands.push({ y: base, height: floorHeight - slabThickness, color: colors.glass });
    bands.push({ y: base + floorHeight - slabThickness, height: slabThickness, color: colors.slab });
  }
  return bands;
}

// ─── Rutas ───────────────────────────────────────────────────────────────────────────

export function buildingPath(buildingId: string): string {
  return `${MASTERPLAN_PATH}/edificio/${buildingId}`;
}

// ─── Disponibilidad ──────────────────────────────────────────────────────────────────

export interface BuildingAvailability {
  available: number;
  reserved: number;
  sold: number;
  total: number;
}

export function buildingAvailability(units: Unit[], buildingId: string): BuildingAvailability {
  const result: BuildingAvailability = { available: 0, reserved: 0, sold: 0, total: 0 };
  for (const unit of units) {
    if (unit.buildingId !== buildingId) continue;
    result[unit.status] += 1;
    result.total += 1;
  }
  return result;
}

/** El estado que tiñe el volumen de un edificio: lo más vendible que le quede (disponible > apartado > vendido). */
export function availabilityStatus(availability: BuildingAvailability): UnitStatus | null {
  if (availability.total === 0) return null;
  if (availability.available > 0) return 'available';
  if (availability.reserved > 0) return 'reserved';
  return 'sold';
}
