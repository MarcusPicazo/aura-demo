import * as THREE from 'three';
import type { DoorSymbol, FootprintSide, Point, TowerGeometryConfig, PlateUnit, Unit } from '../types';

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

export interface NeighborBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  levels: number;
  /** Índice 0..(tones.length-1) para elegir tono de fachada en la paleta de config, determinista. */
  toneIndex: number;
}

/** Ángulo (radianes, mismo sistema que `computePolygonEdges`) hacia el que da cada lado de la huella. */
const SIDE_ANGLE: Record<'minX' | 'maxX' | 'minZ' | 'maxZ', number> = {
  maxX: 0,
  minZ: -Math.PI / 2,
  minX: Math.PI,
  maxZ: Math.PI / 2,
};

export interface NeighborBuildingsParams {
  count: number;
  minLevels: number;
  maxLevels: number;
  levelHeight: number;
  minWidth: number;
  maxWidth: number;
  minClearance: number;
  toneCount: number;
  /** Lado de la huella donde está la calle: no se ponen vecinos ahí (banqueta/coches van en ese lado). */
  streetSide: 'minX' | 'maxX' | 'minZ' | 'maxZ';
}

/**
 * Distribución determinista (no aleatoria, para que el resultado sea estable entre renders)
 * de edificios vecinos: un anillo alrededor de la huella de la torre, a una distancia mínima
 * garantizada (`minClearance` medido desde el círculo que circunscribe la huella, así que
 * nunca se encima con la torre sin importar su forma), evitando el arco que da a la calle.
 * Alturas, anchos y tono varían por índice con aritmética modular, no `Math.random()`.
 */
export function buildNeighborBuildings(footprint: PolygonBounds, params: NeighborBuildingsParams): NeighborBuilding[] {
  const centerX = (footprint.minX + footprint.maxX) / 2;
  const centerZ = (footprint.minZ + footprint.maxZ) / 2;
  const circumRadius = Math.hypot(footprint.maxX - centerX, footprint.maxZ - centerZ);
  const baseRadius = circumRadius + params.minClearance;

  const streetAngle = SIDE_ANGLE[params.streetSide];
  const excludeHalfWidth = Math.PI / 4;
  const arcStart = streetAngle + excludeHalfWidth;
  const arcSpan = Math.PI * 2 - excludeHalfWidth * 2;

  const levelRange = params.maxLevels - params.minLevels + 1;
  const widthRange = Math.max(1, Math.round(params.maxWidth - params.minWidth));

  const buildings: NeighborBuilding[] = [];
  for (let index = 0; index < params.count; index += 1) {
    const angle = arcStart + (arcSpan * (index + 0.5)) / params.count;
    const levels = params.minLevels + ((index * 5) % levelRange);
    const width = params.minWidth + ((index * 7) % widthRange);
    const depth = params.minWidth + (((index + 3) * 11) % widthRange);
    // Variación chica y determinista de profundidad radial, para que no queden en un anillo perfecto.
    const radius = baseRadius + (index % 3) * (params.minClearance / 3) + Math.max(width, depth) / 2;

    buildings.push({
      x: centerX + Math.cos(angle) * radius,
      z: centerZ + Math.sin(angle) * radius,
      width,
      depth,
      height: levels * params.levelHeight,
      levels,
      toneIndex: index % Math.max(1, params.toneCount),
    });
  }
  return buildings;
}

/**
 * Puntos a lo largo del perímetro de un polígono, espaciados como máximo `maxSpacing`
 * (cada arista se subdivide en el número entero de tramos que lo garantiza). Se usa para
 * los perfiles verticales de la carpintería de fachada: un punto por vértice y por cada
 * subdivisión intermedia, sin duplicar esquinas.
 */
export function computeMullionPoints(polygon: Point[], maxSpacing: number): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, z1] = polygon[index];
    const [x2, z2] = polygon[(index + 1) % polygon.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;

    const segments = Math.max(1, Math.ceil(length / maxSpacing));
    for (let segment = 0; segment < segments; segment += 1) {
      const t = segment / segments;
      points.push([x1 + dx * t, z1 + dz * t]);
    }
  }
  return points;
}

export interface MullionPoint {
  position: Point;
  /** Normal unitaria hacia afuera del polígono en ese punto (constante a lo largo de cada arista). */
  outward: Point;
}

/**
 * Igual que `computeMullionPoints`, pero además regresa la normal hacia afuera de cada
 * punto — para desplazar un perfil vertical más allá de la línea de vidrio y que tenga
 * profundidad real (en vez de quedar centrado y al ras).
 */
export function computeMullionPointsWithNormal(polygon: Point[], maxSpacing: number): MullionPoint[] {
  const [centroidX, centroidZ] = polygonCentroid(polygon);
  const points: MullionPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, z1] = polygon[index];
    const [x2, z2] = polygon[(index + 1) % polygon.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;

    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    let outwardX = -dz / length;
    let outwardZ = dx / length;
    if (outwardX * (midX - centroidX) + outwardZ * (midZ - centroidZ) < 0) {
      outwardX = -outwardX;
      outwardZ = -outwardZ;
    }

    const segments = Math.max(1, Math.ceil(length / maxSpacing));
    for (let segment = 0; segment < segments; segment += 1) {
      const t = segment / segments;
      points.push({ position: [x1 + dx * t, z1 + dz * t], outward: [outwardX, outwardZ] });
    }
  }
  return points;
}

export interface PolygonEdge {
  midpoint: Point;
  length: number;
  /** Rotación en Y (radianes) que alinea el eje +X local de una caja con esta arista. */
  rotationY: number;
  /** Normal unitaria hacia afuera del polígono (se aleja del centroide), en el plano (x,z). */
  outward: Point;
}

/**
 * Cada arista de un polígono (punto medio, largo, rotación y normal hacia afuera), para
 * los perfiles horizontales de la carpintería y para proyectar balcones/cantos de losa
 * más allá de la línea de vidrio.
 */
export function computePolygonEdges(polygon: Point[]): PolygonEdge[] {
  const [centroidX, centroidZ] = polygonCentroid(polygon);
  const edges: PolygonEdge[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, z1] = polygon[index];
    const [x2, z2] = polygon[(index + 1) % polygon.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;

    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    // Perpendicular a la arista; se elige el sentido que se aleja del centroide.
    let outwardX = -dz / length;
    let outwardZ = dx / length;
    if (outwardX * (midX - centroidX) + outwardZ * (midZ - centroidZ) < 0) {
      outwardX = -outwardX;
      outwardZ = -outwardZ;
    }

    edges.push({
      midpoint: [midX, midZ],
      length,
      rotationY: Math.atan2(-dz, dx),
      outward: [outwardX, outwardZ],
    });
  }
  return edges;
}

export interface SideAxis {
  /** `u` = a lo largo del lado elegido (centrado en la huella); `v` = distancia hacia afuera desde ese lado. */
  toWorld: (u: number, v: number) => Point;
  /** Rotación en Y que alinea el eje +X local (largo unitario) con la dirección de `u`. */
  rotationY: number;
}

/**
 * Sistema de coordenadas (u = a lo largo del lado, v = hacia afuera) para un lado de la
 * huella (bounding box) de la torre, útil para acomodar cualquier cosa "pegada a un lado"
 * (calle, banqueta, marquesina) sin repetir la trigonometría en cada componente.
 */
export function sideAxisFrom(footprint: PolygonBounds, side: FootprintSide): SideAxis {
  const centerX = (footprint.minX + footprint.maxX) / 2;
  const centerZ = (footprint.minZ + footprint.maxZ) / 2;
  const outwardIsX = side === 'minX' || side === 'maxX';
  const sign = side === 'minX' || side === 'minZ' ? -1 : 1;
  const edge = outwardIsX ? (sign === -1 ? footprint.minX : footprint.maxX) : (sign === -1 ? footprint.minZ : footprint.maxZ);
  const uCenter = outwardIsX ? centerZ : centerX;

  return {
    rotationY: outwardIsX ? Math.PI / 2 : 0,
    toWorld: (u, v) => {
      const along = uCenter + u;
      const outward = edge + sign * v;
      return outwardIsX ? [outward, along] : [along, outward];
    },
  };
}

/**
 * Encoge un polígono ortogonal (todos los lados horizontales o verticales — el caso de
 * cualquier planta de unidad de esta config) `distance` metros hacia adentro. Cada lado se
 * desplaza hacia el interior y el vértice nuevo es la intersección de los dos lados
 * desplazados que se juntan ahí — trivial en un polígono ortogonal, porque cada lado es una
 * recta x=cte o z=cte.
 *
 * La normal hacia afuera de cada lado sale de rotar -90° el vector de la arista (asume
 * recorrido antihorario, el mismo que usa la config), no de comparar contra el centroide
 * como `computePolygonEdges`: esa comparación puede fallar justo en la esquina recortada de
 * un polígono cóncavo (unidad en L), donde el centroide cae casi sobre la propia arista.
 *
 * Se usa para el forro interior oscuro detrás del vidrio (evita que la torre se vea hueca).
 */
export function insetRectilinearPolygon(polygon: Point[], distance: number): Point[] {
  const n = polygon.length;

  const shiftedLines = polygon.map((p1, index) => {
    const [x1, z1] = p1;
    const [x2, z2] = polygon[(index + 1) % n];
    const dx = x2 - x1;
    const dz = z2 - z1;
    if (Math.abs(dx) < 1e-6) {
      // Arista vertical (x constante): la normal hacia afuera es (signo(dz), 0).
      const outward = Math.sign(dz);
      return { axis: 'x' as const, value: x1 - outward * distance };
    }
    // Arista horizontal (z constante): la normal hacia afuera es (0, -signo(dx)).
    const outward = -Math.sign(dx);
    return { axis: 'z' as const, value: z1 - outward * distance };
  });

  return polygon.map((_, index) => {
    const prev = shiftedLines[(index - 1 + n) % n];
    const curr = shiftedLines[index];
    const xLine = prev.axis === 'x' ? prev : curr;
    const zLine = prev.axis === 'z' ? prev : curr;
    return [xLine.value, zLine.value] as Point;
  });
}
