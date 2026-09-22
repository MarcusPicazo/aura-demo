import * as THREE from 'three';
import type { DoorSymbol, Point, TowerGeometryConfig, PlateUnit, Unit } from '../types';

/**
 * Construye un THREE.Shape a partir de un polígono en coordenadas de planta [x, z].
 * Se usa (x, -z) como plano local del Shape para que, tras rotar -90° en X tras la
 * extrusión, el mundo resultante quede en (x, altura, z) sin espejear el eje z.
 */
export function polygonToShape(polygon: Point[]): THREE.Shape {
  const points = polygon.map(([x, z]) => new THREE.Vector2(x, -z));
  return new THREE.Shape(points);
}

export interface PolygonBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Bounding box (en planta) de un conjunto de polígonos. */
export function polygonBounds(polygons: Point[][]): PolygonBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const polygon of polygons) {
    for (const [x, z] of polygon) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  return { minX, maxX, minZ, maxZ };
}

/**
 * Centroide simple (promedio de vértices) de un polígono. Sirve para cualquier espacio
 * 2D (metros de planta, fracciones 0–1 de una imagen, etc.) — se usa para ubicar la
 * etiqueta de número de piso sobre cada polígono de la fachada.
 */
export function polygonCentroid(polygon: Point[]): Point {
  const [sumX, sumY] = polygon.reduce<Point>(([accX, accY], [x, y]) => [accX + x, accY + y], [0, 0]);
  return [sumX / polygon.length, sumY / polygon.length];
}

export interface TowerLevel {
  /** Número de piso: 1..(levels-1) para plate, `levels` para penthousePlate. */
  index: number;
  /** Y de la base del nivel. */
  y: number;
  /** Es el nivel superior (penthouses). */
  isPenthouse: boolean;
  units: PlateUnit[];
}

export interface TowerLayout {
  totalHeight: number;
  levels: TowerLevel[];
  /** Y de cada frontera de nivel (base, cada piso, techo), para las losas. */
  slabYs: number[];
  slabThickness: number;
  footprint: PolygonBounds;
  core: Point[];
}

/**
 * Calcula la distribución vertical de la torre a partir de la config de geometría:
 * pisos 1..(levels-1) usan `plate`, el último nivel (`levels`) usa `penthousePlate`.
 * No depende de React ni de three.js: solo números y arreglos.
 */
export function buildTowerLayout(geometry: TowerGeometryConfig): TowerLayout {
  const { floorHeight, groundFloorHeight, levels, plate, penthousePlate, core } = geometry;

  const towerLevels: TowerLevel[] = [];
  for (let index = 1; index <= levels; index += 1) {
    const isPenthouse = index === levels;
    towerLevels.push({
      index,
      y: groundFloorHeight + (index - 1) * floorHeight,
      isPenthouse,
      units: isPenthouse ? penthousePlate : plate,
    });
  }

  const totalHeight = groundFloorHeight + levels * floorHeight;

  const slabYs = [0, groundFloorHeight];
  for (let index = 1; index <= levels; index += 1) {
    slabYs.push(groundFloorHeight + index * floorHeight);
  }

  const footprint = polygonBounds([
    ...plate.map((unit) => unit.polygon),
    ...penthousePlate.map((unit) => unit.polygon),
    core,
  ]);

  return {
    totalHeight,
    levels: towerLevels,
    slabYs,
    slabThickness: geometry.slabThickness,
    footprint,
    core,
  };
}

/**
 * Código de unidad regular por piso, SPEC §3: `{piso}{nn}` → 101,102,103,104…1101…1104.
 * `orderInFloor` es la posición dentro de `geometry.plate` (0=A, 1=B, 2=C, 3=D). Vive aquí
 * (no en un archivo de negocio) porque tanto el motor (Tower, para casar unidad↔código)
 * como el seed (para generar los códigos) necesitan la misma derivación determinista.
 */
export function deriveRegularUnitCode(floor: number, orderInFloor: number): string {
  return `${floor}${String(orderInFloor + 1).padStart(2, '0')}`;
}

/**
 * Encuentra el polígono de planta de una unidad de negocio dentro de la geometría:
 * penthouses se buscan por código (son únicos), las demás por tipo (se repiten por piso).
 */
export function findUnitPolygon(
  geometry: TowerGeometryConfig,
  unit: Pick<Unit, 'code' | 'type' | 'floor'>,
): Point[] | undefined {
  if (unit.floor === geometry.levels) {
    return geometry.penthousePlate.find((candidate) => candidate.code === unit.code)?.polygon;
  }
  return geometry.plate.find((candidate) => candidate.type === unit.type)?.polygon;
}

/**
 * Clave para buscar plano interior/renders de una unidad en `config.floorPlans`/`interiors`:
 * mismo criterio que `findUnitPolygon` (código si es penthouse, tipo si no), porque los
 * penthouses son únicos pero las unidades regulares comparten distribución por tipo.
 */
export function floorPlanKey(unit: Pick<Unit, 'code' | 'type' | 'floor'>, levels: number): string {
  return unit.floor === levels ? unit.code : unit.type;
}

/** Área de un polígono simple (fórmula del cofre/shoelace), en las mismas unidades que sus vértices. */
export function polygonArea(polygon: Point[]): number {
  let sum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, z1] = polygon[index];
    const [x2, z2] = polygon[(index + 1) % polygon.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

/**
 * Rectángulo (como polígono de 4 puntos) que representa un segmento de línea con grosor:
 * la forma de dibujar muros y ventanas del plano de unidad como una sola primitiva.
 */
export function thickSegmentPolygon(from: Point, to: Point, thickness: number): Point[] {
  const [x1, z1] = from;
  const [x2, z2] = to;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz) || 1;
  const nx = (-dz / length) * (thickness / 2);
  const nz = (dx / length) * (thickness / 2);
  return [
    [x1 + nx, z1 + nz],
    [x2 + nx, z2 + nz],
    [x2 - nx, z2 - nz],
    [x1 - nx, z1 - nz],
  ];
}

export interface DoorGeometry {
  /** Hoja abierta, de la bisagra al extremo libre. */
  leaf: [Point, Point];
  /** Arco de abatimiento (cuarto de círculo): extremos + radio, sin normalizar a ningún origen. */
  arcFrom: Point;
  arcTo: Point;
  radius: number;
  sweepFlag: 0 | 1;
}

/**
 * Símbolo arquitectónico de puerta: hoja perpendicular a la posición cerrada + arco de
 * abatimiento. `angle`/`swing` están en el mismo plano local (x, z) que el resto del plano
 * de unidad — no son orientación geográfica real, solo geometría 2D del dibujo. Devuelve
 * puntos (no un `d` ya armado) para que quien dibuje pueda desplazarlos al normalizar el plano.
 */
export function doorSwingPath({ hinge, angle, width, swing }: DoorSymbol): DoorGeometry {
  const [hx, hz] = hinge;
  const closedRad = (angle * Math.PI) / 180;
  const openRad = ((angle + swing * 90) * Math.PI) / 180;
  const openEnd: Point = [hx + width * Math.cos(openRad), hz + width * Math.sin(openRad)];
  const closedEnd: Point = [hx + width * Math.cos(closedRad), hz + width * Math.sin(closedRad)];

  return { leaf: [hinge, openEnd], arcFrom: closedEnd, arcTo: openEnd, radius: width, sweepFlag: swing === 1 ? 1 : 0 };
}

/** Convierte una lista de puntos en el `d` de un `<path>` SVG cerrado (M ... L ... Z). */
export function pointsToSvgPath(points: Point[]): string {
  return points
    .map(([x, z], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${z.toFixed(2)}`)
    .concat('Z')
    .join(' ');
}

export interface ContextBlock {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

/**
 * Distribución fija (ángulo, distancia, tamaño y altura relativa) de los bloques de
 * contexto urbano alrededor de la torre. Son proporciones, no metros: se escalan con
 * el tamaño de la huella de cada torre, así que sirven para cualquier cliente.
 */
const CONTEXT_LAYOUT = [
  { angle: 0.3, distance: 1.8, width: 0.5, depth: 0.4, heightFactor: 0.55 },
  { angle: 1.1, distance: 2.1, width: 0.65, depth: 0.5, heightFactor: 0.35 },
  { angle: 2.0, distance: 1.7, width: 0.4, depth: 0.45, heightFactor: 0.7 },
  { angle: 2.8, distance: 2.3, width: 0.55, depth: 0.6, heightFactor: 0.45 },
  { angle: 3.6, distance: 1.9, width: 0.5, depth: 0.5, heightFactor: 0.6 },
  { angle: 4.4, distance: 2.2, width: 0.45, depth: 0.55, heightFactor: 0.3 },
  { angle: 5.2, distance: 1.85, width: 0.6, depth: 0.4, heightFactor: 0.5 },
  { angle: 6.0, distance: 2.0, width: 0.5, depth: 0.5, heightFactor: 0.4 },
] as const;

/**
 * Bloques de contexto urbano (edificios vecinos) alrededor de la huella de la torre.
 * Distribución determinista (no aleatoria) derivada solo de la huella y la altura total,
 * para que el resultado sea estable entre renders y genérico para cualquier cliente.
 */
export function buildContextBlocks(footprint: PolygonBounds, towerHeight: number): ContextBlock[] {
  const centerX = (footprint.minX + footprint.maxX) / 2;
  const centerZ = (footprint.minZ + footprint.maxZ) / 2;
  const span = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ);

  return CONTEXT_LAYOUT.map(({ angle, distance, width, depth, heightFactor }) => ({
    x: centerX + Math.cos(angle) * span * distance,
    z: centerZ + Math.sin(angle) * span * distance,
    width: span * width,
    depth: span * depth,
    height: Math.max(towerHeight * heightFactor, 6),
  }));
}
