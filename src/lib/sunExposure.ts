import { buildTowerLayout, deriveRegularUnitCode, pointInPolygon, polygonBounds, polygonLabelPoint, type NeighborBuilding } from './geometry';
import { localToWorld, type ResolvedBuilding } from './buildings';
import { solarPosition, sunVector, type MonthDay } from './solar';
import type { PenthousePlateUnit, Point, SolarConfig } from '../types';

/**
 * Horas de sol directo de cada unidad, estimadas sobre el propio modelo de la escena: para cada
 * muestra del día (cada `sampleMinutes`) se lanza un rayo hacia el sol desde puntos de las
 * fachadas exteriores de la unidad y se revisa si lo tapa algún volumen — otro edificio del
 * conjunto, otra ala del mismo edificio o un vecino del entorno. Todo son funciones puras sobre
 * números (sin three.js ni React); la escena solo recibe el resultado.
 *
 * Es una estimación para decidir y comparar unidades ("esta recibe sol de tarde, esa no"), no
 * una simulación de ingeniería: no cuenta los voladizos de balcón, los árboles ni la nubosidad.
 */

/** Un muro cuenta como "mirando al sol" si el sol le pega con al menos ~6° de incidencia: más rasante que eso casi no entra luz. */
const MIN_WALL_INCIDENCE = 0.1;
/** Fracción mínima de los puntos de un muro con sol libre para contar la unidad como asoleada (una esquina suelta no basta). */
const MIN_LIT_FRACTION = 0.3;
/** Separación entre cada punto de muestra de un muro, en metros (se reparten uniformes, de 2 a 5 por muro). */
const WALL_SAMPLE_SPACING = 3;
const WALL_SAMPLES_MIN = 2;
const WALL_SAMPLES_MAX = 5;
/** Cuánto se saca el origen del rayo del muro, para que no choque con el volumen de su propia unidad. */
const RAY_ORIGIN_OFFSET = 0.05;
/** A qué fracción de la altura del piso se toma la muestra (a media ventana). */
const WALL_SAMPLE_HEIGHT = 0.5;

// ─── Volúmenes que tapan el sol ──────────────────────────────────────────────────────

/** Un prisma vertical: un polígono de planta (x, z del mundo) entre dos alturas. */
export interface Occluder {
  polygon: Point[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  topY: number;
}

function makeOccluder(polygon: Point[], baseY: number, topY: number): Occluder {
  const { minX, maxX, minZ, maxZ } = polygonBounds([polygon]);
  return { polygon, minX, maxX, minZ, maxZ, baseY, topY };
}

/** Los volúmenes de un edificio: cada ala de planta hasta donde llega, los penthouses encima y el núcleo de punta a punta. */
export function buildingOccluders(building: ResolvedBuilding): Occluder[] {
  const { geometry } = building;
  const layout = buildTowerLayout(geometry);
  const penthouseY = geometry.groundFloorHeight + (geometry.levels - 1) * geometry.floorHeight;
  const toWorld = (polygon: Point[]) => polygon.map((point) => localToWorld(building, point));
  return [
    ...geometry.plate.map((unit) => makeOccluder(toWorld(unit.polygon), 0, penthouseY)),
    ...geometry.penthousePlate.map((unit) => makeOccluder(toWorld(unit.polygon), penthouseY, layout.totalHeight)),
    makeOccluder(toWorld(geometry.core), 0, layout.totalHeight),
  ];
}

/** Un edificio vecino del entorno (caja centrada en x, z). */
export function neighborOccluder(neighbor: NeighborBuilding): Occluder {
  const halfWidth = neighbor.width / 2;
  const halfDepth = neighbor.depth / 2;
  return makeOccluder(
    [
      [neighbor.x - halfWidth, neighbor.z - halfDepth],
      [neighbor.x + halfWidth, neighbor.z - halfDepth],
      [neighbor.x + halfWidth, neighbor.z + halfDepth],
      [neighbor.x - halfWidth, neighbor.z + halfDepth],
    ],
    0,
    neighbor.height,
  );
}

function orientation(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}

/** ¿Se cruzan los segmentos (a→b) y (c→d)? Sin contar el roce exacto de extremos: da igual para un rayo. */
function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const d1 = orientation(cx, cz, dx, dz, ax, az);
  const d2 = orientation(cx, cz, dx, dz, bx, bz);
  const d3 = orientation(ax, az, bx, bz, cx, cz);
  const d4 = orientation(ax, az, bx, bz, dx, dz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function segmentHitsPolygon(x0: number, z0: number, x1: number, z1: number, polygon: Point[]): boolean {
  if (pointInPolygon([x0, z0], polygon)) return true;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [cx, cz] = polygon[previous];
    const [dx, dz] = polygon[index];
    if (segmentsCross(x0, z0, x1, z1, cx, cz, dx, dz)) return true;
  }
  return false;
}

/**
 * ¿Tapa algún prisma el rayo que sale de (ox, oy, oz) hacia el sol (dx, dy, dz, con dy > 0)?
 * El rayo sube, así que dentro de la franja de alturas de un prisma recorre un tramo recto en
 * planta: basta ver si ese tramo toca el polígono.
 */
function rayBlocked(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, occluders: Occluder[]): boolean {
  for (const occluder of occluders) {
    const tTop = (occluder.topY - oy) / dy;
    // El prisma entero queda por debajo del punto de partida.
    if (tTop <= 0) continue;
    const tBase = Math.max(0, (occluder.baseY - oy) / dy);
    const x0 = ox + dx * tBase;
    const z0 = oz + dz * tBase;
    const x1 = ox + dx * tTop;
    const z1 = oz + dz * tTop;
    if (Math.max(x0, x1) < occluder.minX || Math.min(x0, x1) > occluder.maxX) continue;
    if (Math.max(z0, z1) < occluder.minZ || Math.min(z0, z1) > occluder.maxZ) continue;
    if (segmentHitsPolygon(x0, z0, x1, z1, occluder.polygon)) return true;
  }
  return false;
}

/**
 * Distancia a la que un rayo horizontal (desde (ox, oz), dirección unitaria (dx, dz)) toca el borde de un polígono;
 * `null` si no lo toca. Desde afuera es la entrada al polígono; desde adentro, la salida.
 */
export function horizontalHitDistance(ox: number, oz: number, dx: number, dz: number, polygon: Point[]): number | null {
  let best: number | null = null;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [cx, cz] = polygon[previous];
    const edgeX = polygon[index][0] - cx;
    const edgeZ = polygon[index][1] - cz;
    const denominator = dx * edgeZ - dz * edgeX;
    if (Math.abs(denominator) < 1e-9) continue;
    const wx = cx - ox;
    const wz = cz - oz;
    const along = (wx * edgeZ - wz * edgeX) / denominator;
    const across = (wx * dz - wz * dx) / denominator;
    if (along > 1e-6 && across >= 0 && across <= 1 && (best === null || along < best)) best = along;
  }
  return best;
}

/** Cuánto se ve libremente hacia afuera desde un punto, a una altura: hasta el primer volumen que se cruza (o `maxDistance`). */
export function viewFreeDistance(ox: number, y: number, oz: number, dx: number, dz: number, occluders: Occluder[], maxDistance: number): number {
  let free = maxDistance;
  for (const occluder of occluders) {
    if (y < occluder.baseY || y > occluder.topY) continue;
    const hit = horizontalHitDistance(ox, oz, dx, dz, occluder.polygon);
    if (hit !== null && hit < free) free = hit;
  }
  return free;
}

// ─── Fachadas exteriores de cada unidad ──────────────────────────────────────────────

/** Un muro exterior de una unidad: sus puntos de muestra (x, z del mundo), hacia dónde da y a qué altura. */
export interface SunWall {
  points: Point[];
  /** Normal horizontal unitaria hacia afuera, en el mundo. */
  normal: Point;
  y: number;
  /** Largo en metros (para ponderar el rumbo de la unidad). */
  length: number;
}

export interface UnitSunProbe {
  code: string;
  floor: number;
  /** Altura del piso de la unidad (donde apoya), en metros. */
  floorY: number;
  /** Contorno de la unidad y su punto más "adentro", ya en el mundo (x, z). */
  polygon: Point[];
  center: Point;
  walls: SunWall[];
}

/** Sondeo hacia afuera de una arista: sirve para saber de qué lado queda el exterior, sea cual sea el sentido de los vértices. */
const EDGE_PROBE = 0.05;

/**
 * Los muros exteriores de cada unidad de un edificio: las aristas de su polígono que dan al aire
 * (no a otra unidad ni al núcleo). La normal hacia afuera sale de probar qué lado cae dentro del
 * polígono, así que sirve también para una planta en L.
 */
export function buildingUnitProbes(building: ResolvedBuilding): UnitSunProbe[] {
  const { geometry } = building;
  const layout = buildTowerLayout(geometry);
  const probes: UnitSunProbe[] = [];

  for (const level of layout.levels) {
    const levelPolygons = [...level.units.map((unit) => unit.polygon), geometry.core];
    level.units.forEach((unit, orderInFloor) => {
      const code = level.isPenthouse ? (unit as PenthousePlateUnit).code : deriveRegularUnitCode(level.index, orderInFloor);
      const walls: SunWall[] = [];
      const polygon = unit.polygon;
      for (let index = 0; index < polygon.length; index += 1) {
        const [x1, z1] = polygon[index];
        const [x2, z2] = polygon[(index + 1) % polygon.length];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        if (length < 1e-6) continue;

        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        let normalX = dz / length;
        let normalZ = -dx / length;
        if (pointInPolygon([midX + normalX * EDGE_PROBE, midZ + normalZ * EDGE_PROBE], polygon)) {
          normalX = -normalX;
          normalZ = -normalZ;
        }
        // Si del otro lado hay otra unidad o el núcleo, es un muro interior: ahí no entra sol.
        const outside: Point = [midX + normalX * EDGE_PROBE, midZ + normalZ * EDGE_PROBE];
        if (levelPolygons.some((other) => other !== polygon && pointInPolygon(outside, other))) continue;

        const worldMid = localToWorld(building, [midX, midZ]);
        const worldAhead = localToWorld(building, [midX + normalX, midZ + normalZ]);
        const worldNormal: Point = [worldAhead[0] - worldMid[0], worldAhead[1] - worldMid[1]];
        const normalLength = Math.hypot(worldNormal[0], worldNormal[1]) || 1;

        const count = Math.min(WALL_SAMPLES_MAX, Math.max(WALL_SAMPLES_MIN, Math.ceil(length / WALL_SAMPLE_SPACING)));
        const points: Point[] = [];
        for (let sample = 0; sample < count; sample += 1) {
          const t = (sample + 0.5) / count;
          points.push(localToWorld(building, [x1 + dx * t, z1 + dz * t]));
        }
        walls.push({
          points,
          normal: [worldNormal[0] / normalLength, worldNormal[1] / normalLength],
          y: level.y + geometry.floorHeight * WALL_SAMPLE_HEIGHT,
          length,
        });
      }
      probes.push({
        code,
        floor: level.index,
        floorY: level.y,
        polygon: polygon.map((point) => localToWorld(building, point)),
        center: localToWorld(building, polygonLabelPoint(polygon)),
        walls,
      });
    });
  }
  return probes;
}

// ─── Un día de sol ───────────────────────────────────────────────────────────────────

export type SunSite = Pick<
  SolarConfig,
  'latitude' | 'longitude' | 'utcOffsetHours' | 'northAngleDeg' | 'minSunElevationDeg' | 'sampleMinutes' | 'afternoonFromHour' | 'afternoonMinHours'
>;

/** El sol a lo largo de un día: una muestra por cada `sampleMinutes`, tomada a la mitad de su intervalo. */
export interface DaySun {
  date: MonthDay;
  /** Duración de cada muestra, en horas. */
  stepHours: number;
  /** Hora local (decimal) del centro de cada muestra. */
  hours: number[];
  /** Vector unitario hacia el sol (x, y, z del mundo) en cada muestra. */
  directions: [number, number, number][];
  /** El sol está lo bastante alto para contar como sol directo. */
  usable: boolean[];
}

export function daySunSamples(site: SunSite, date: MonthDay): DaySun {
  const stepHours = Math.max(1, site.sampleMinutes) / 60;
  const count = Math.round(24 / stepHours);
  const hours: number[] = [];
  const directions: [number, number, number][] = [];
  const usable: boolean[] = [];
  for (let index = 0; index < count; index += 1) {
    const hour = (index + 0.5) * stepHours;
    const position = solarPosition(site, date, hour);
    hours.push(hour);
    directions.push(sunVector(position, site.northAngleDeg));
    usable.push(position.elevationDeg >= Math.max(0.5, site.minSunElevationDeg));
  }
  return { date, stepHours, hours, directions, usable };
}

/** 1 en cada muestra del día en que la unidad recibe sol directo. */
export function unitDayLight(probe: UnitSunProbe, day: DaySun, occluders: Occluder[]): Uint8Array {
  const lit = new Uint8Array(day.hours.length);
  for (let sample = 0; sample < lit.length; sample += 1) {
    if (!day.usable[sample]) continue;
    const [sx, sy, sz] = day.directions[sample];
    for (const wall of probe.walls) {
      if (wall.normal[0] * sx + wall.normal[1] * sz < MIN_WALL_INCIDENCE) continue;
      let open = 0;
      for (const [px, pz] of wall.points) {
        const ox = px + wall.normal[0] * RAY_ORIGIN_OFFSET;
        const oz = pz + wall.normal[1] * RAY_ORIGIN_OFFSET;
        if (!rayBlocked(ox, wall.y, oz, sx, sy, sz, occluders)) open += 1;
      }
      if (open / wall.points.length >= MIN_LIT_FRACTION) {
        lit[sample] = 1;
        break;
      }
    }
  }
  return lit;
}

/** ¿Recibe sol directo la unidad a esa hora local? */
export function isLitAt(lit: Uint8Array, day: DaySun, hour: number): boolean {
  const index = Math.min(lit.length - 1, Math.max(0, Math.floor(hour / day.stepHours)));
  return lit[index] === 1;
}

export interface SunSummary {
  /** Horas de sol directo en el día. */
  directHours: number;
  /** Las que caen antes de `afternoonFromHour` y las que caen desde ahí. */
  morningHours: number;
  afternoonHours: number;
  /** Recibe sol de tarde: al menos `afternoonMinHours` desde `afternoonFromHour`. */
  afternoon: boolean;
  /** Hora local (decimal) en que entra el primer sol y en que sale el último; null si nunca hay sol. */
  firstLight: number | null;
  lastLight: number | null;
  /** Fracción (0–1) de cada hora del día (0–23) con sol directo, para dibujar la franja del día. */
  hourly: number[];
}

export function summarizeLight(lit: Uint8Array, day: DaySun, site: Pick<SunSite, 'afternoonFromHour' | 'afternoonMinHours'>): SunSummary {
  let morning = 0;
  let afternoon = 0;
  let firstLight: number | null = null;
  let lastLight: number | null = null;
  const hourly = new Array<number>(24).fill(0);
  for (let sample = 0; sample < lit.length; sample += 1) {
    if (lit[sample] === 0) continue;
    const hour = day.hours[sample];
    if (hour >= site.afternoonFromHour) afternoon += day.stepHours;
    else morning += day.stepHours;
    if (firstLight === null) firstLight = hour - day.stepHours / 2;
    lastLight = hour + day.stepHours / 2;
    const bucket = Math.min(23, Math.floor(hour));
    hourly[bucket] += day.stepHours;
  }
  return {
    directHours: morning + afternoon,
    morningHours: morning,
    afternoonHours: afternoon,
    afternoon: afternoon >= site.afternoonMinHours,
    firstLight,
    lastLight,
    hourly: hourly.map((value) => Math.min(1, value)),
  };
}

// ─── Todo el conjunto ────────────────────────────────────────────────────────────────

/** Lo que no cambia con la fecha: los volúmenes que tapan el sol y los muros de cada unidad. */
export interface SunModel {
  occluders: Occluder[];
  probes: Map<string, UnitSunProbe[]>;
}

export function createSunModel(buildings: ResolvedBuilding[], neighbors: NeighborBuilding[]): SunModel {
  return {
    occluders: [...buildings.flatMap(buildingOccluders), ...neighbors.map(neighborOccluder)],
    probes: new Map(buildings.map((building) => [building.id, buildingUnitProbes(building)])),
  };
}

/** El sol directo de cada unidad de un edificio en un día: código de unidad → muestras con sol. */
export function buildingDayLight(model: SunModel, buildingId: string, day: DaySun): Map<string, Uint8Array> {
  const result = new Map<string, Uint8Array>();
  for (const probe of model.probes.get(buildingId) ?? []) {
    result.set(probe.code, unitDayLight(probe, day, model.occluders));
  }
  return result;
}
