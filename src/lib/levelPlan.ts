import { deriveRegularUnitCode, doorSwingPath, polygonBounds, polygonLabelPoint, strokePolygons, thickSegmentPolygon, type PolygonBounds } from './geometry';
import { FURNITURE_STROKE_WIDTH, furniturePolylines } from './furniturePrimitives';
import { unitMediaKey } from './render';
import { variantWidths } from './renderWidths';
import type { FloorPlanConfig, Point, RenderHotspot, RenderImage, RenderLevelConfig, TowerGeometryConfig } from '../types';

/**
 * Trazos de la planta del motor. A escala de nivel completo (unos 25 m en un celular, ~25 px
 * por metro) los grosores del plano de unidad (0.02–0.03 m) quedarían por debajo de un
 * píxel, así que aquí son más gruesos; los muros ya traen su grosor real (`wallThickness`).
 */
const OUTLINE_STROKE = 0.1;
const DOOR_STROKE = 0.05;
const FURNITURE_STROKE = FURNITURE_STROKE_WIDTH * 2;
const DOOR_ARC_STEPS = 12;
/** Un tramo de ventana ocupa este porcentaje del grosor del muro (igual que el plano SVG de la ficha). */
const WINDOW_THICKNESS_RATIO = 0.6;
/** Muro perimetral de respaldo para unidades sin plano dibujado, en metros. */
const FALLBACK_WALL_THICKNESS = 0.15;

/** Una unidad del nivel, con todo su dibujo ya en las coordenadas de la torre (x, z en metros). */
export interface LevelPlanUnit {
  buildingId: string;
  code: string;
  type: string;
  polygon: Point[];
  /** Dónde va el código: el punto más "adentro" de la forma (no el promedio de vértices). */
  labelPoint: Point;
  /** Cada lista es un conjunto de polígonos planos listos para triangular. */
  outline: Point[][];
  walls: Point[][];
  windows: Point[][];
  doors: Point[][];
  furniture: Point[][];
}

export interface LevelPlan {
  floor: number;
  units: LevelPlanUnit[];
  core: Point[];
  /** Caja que envuelve unidades y núcleo. */
  bounds: PolygonBounds;
}

/** Lo que hace falta para dibujar los niveles de un edificio: su geometría, los planos de unidad y cómo se llama. */
export interface LevelPlanSource {
  buildingId: string;
  geometry: TowerGeometryConfig;
  floorPlans: Record<string, FloorPlanConfig>;
}

/** Los pisos de la torre, de abajo arriba (la planta baja no tiene unidades). */
export function levelFloors(geometry: Pick<TowerGeometryConfig, 'levels'>): number[] {
  return Array.from({ length: geometry.levels }, (_, index) => index + 1);
}

/** Pisos que comparten dibujo: los regulares usan `plate`; el último, `penthousePlate`. */
export function levelLayouts(geometry: Pick<TowerGeometryConfig, 'levels'>): { id: 'tipo' | 'penthouse'; floors: number[] }[] {
  const floors = levelFloors(geometry);
  const regular = floors.filter((floor) => floor !== geometry.levels);
  return [
    ...(regular.length > 0 ? [{ id: 'tipo' as const, floors: regular }] : []),
    ...(floors.length > 0 ? [{ id: 'penthouse' as const, floors: [geometry.levels] }] : []),
  ];
}

function shifted(polygons: Point[][], [originX, originZ]: Point): Point[][] {
  return polygons.map((polygon) => polygon.map(([x, z]): Point => [x + originX, z + originZ]));
}

function drawnUnitShapes(plan: Extract<FloorPlanConfig, { kind: 'drawn' }>) {
  const walls = plan.walls.map((segment) => thickSegmentPolygon(segment.from, segment.to, plan.wallThickness));
  const windows = plan.windows.map((segment) => thickSegmentPolygon(segment.from, segment.to, plan.wallThickness * WINDOW_THICKNESS_RATIO));

  const doors = plan.doors.flatMap((door) => {
    const { leaf, radius } = doorSwingPath(door);
    const start = (door.angle * Math.PI) / 180;
    const arc = Array.from({ length: DOOR_ARC_STEPS + 1 }, (_, index): Point => {
      const angle = start + (door.swing * (Math.PI / 2) * index) / DOOR_ARC_STEPS;
      return [door.hinge[0] + radius * Math.cos(angle), door.hinge[1] + radius * Math.sin(angle)];
    });
    return [...strokePolygons(leaf, false, DOOR_STROKE), ...strokePolygons(arc, false, DOOR_STROKE * 0.5)];
  });

  const furniture = plan.furniture.flatMap((piece) =>
    furniturePolylines(piece).flatMap(({ points, closed }) => strokePolygons(points, closed, FURNITURE_STROKE)),
  );
  return { walls, windows, doors, furniture };
}

/**
 * Arma el dibujo de un nivel a partir de la geometría y los planos de unidad del config: qué
 * unidades hay en ese piso (con su código, como en el seed), y por cada una sus muros,
 * ventanas, puertas y mobiliario. Los datos de cada plano vienen en coordenadas locales a la
 * esquina de la caja de la unidad (ver `FloorPlanDetailed`); aquí se llevan a las de la torre.
 * Función pura: la misma config da siempre la misma planta, y la planta siempre coincide con
 * el inventario porque ambos salen de los mismos códigos.
 */
export function buildLevelPlan(source: LevelPlanSource, floor: number): LevelPlan {
  const { geometry, floorPlans, buildingId } = source;
  const sources =
    floor === geometry.levels
      ? geometry.penthousePlate.map((unit) => ({ code: unit.code, type: unit.type, polygon: unit.polygon }))
      : geometry.plate.map((unit, order) => ({
          code: deriveRegularUnitCode(floor, order),
          type: unit.type,
          polygon: unit.polygon,
        }));

  const units = sources.map(({ code, type, polygon }): LevelPlanUnit => {
    const unitBounds = polygonBounds([polygon]);
    const origin: Point = [unitBounds.minX, unitBounds.minZ];
    const planKey = unitMediaKey({ buildingId, code, type }, floorPlans);
    const plan = planKey ? floorPlans[planKey] : undefined;
    const drawn = plan?.kind === 'drawn' ? drawnUnitShapes(plan) : null;
    return {
      buildingId,
      code,
      type,
      polygon,
      labelPoint: polygonLabelPoint(polygon),
      outline: strokePolygons(polygon, true, OUTLINE_STROKE),
      // Sin plano dibujado, la unidad se queda con un muro perimetral en vez de quedar sin muros.
      walls: drawn ? shifted(drawn.walls, origin) : strokePolygons(polygon, true, FALLBACK_WALL_THICKNESS),
      windows: drawn ? shifted(drawn.windows, origin) : [],
      doors: drawn ? shifted(drawn.doors, origin) : [],
      furniture: drawn ? shifted(drawn.furniture, origin) : [],
    };
  });

  return { floor, units, core: geometry.core, bounds: polygonBounds([...units.map((unit) => unit.polygon), geometry.core]) };
}

// ─── Encuadre y exportación ──────────────────────────────────────────────────────────

/** Aire alrededor del nivel en la vista y en la imagen exportada, en metros. */
export const PLAN_FRAME_MARGIN = 1.5;

/** Recuadro (en metros) que muestra la cámara y que ocupa toda la imagen exportada. */
export interface PlanFrame {
  minX: number;
  minZ: number;
  width: number;
  depth: number;
}

export function planFrame(bounds: PolygonBounds, margin = PLAN_FRAME_MARGIN): PlanFrame {
  return {
    minX: bounds.minX - margin,
    minZ: bounds.minZ - margin,
    width: bounds.maxX - bounds.minX + margin * 2,
    depth: bounds.maxZ - bounds.minZ + margin * 2,
  };
}

/** Tamaño en píxeles de la imagen exportada para un ancho dado (la proporción es la del recuadro). */
export function frameImageSize(frame: PlanFrame, widthPx: number): { width: number; height: number } {
  return { width: widthPx, height: Math.round((widthPx * frame.depth) / frame.width) };
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

/** Un polígono de la torre (metros) como fracciones 0–1 de la imagen exportada del recuadro. */
export function polygonToFrameFractions(polygon: Point[], frame: PlanFrame): Point[] {
  return polygon.map(([x, z]): Point => [round4((x - frame.minX) / frame.width), round4((z - frame.minZ) / frame.depth)]);
}

/** Zonas clicables de una planta exportada: una por unidad, con su código, ya en fracciones de la imagen. */
export function levelHotspots(plan: LevelPlan, frame: PlanFrame, scopeToBuilding = false): RenderHotspot[] {
  return plan.units.map((unit) => ({
    id: `u${unit.code}`,
    label: unit.code,
    polygon: polygonToFrameFractions(unit.polygon, frame),
    // En un conjunto el código solo puede repetirse entre edificios: la zona dice de cuál es.
    target: scopeToBuilding ? { type: 'unit', code: unit.code, buildingId: unit.buildingId } : { type: 'unit', code: unit.code },
  }));
}

/**
 * Las entradas `levels` de una vista de planta con imágenes (`kind: 'plan'`) para todas las
 * plantas de un edificio, usando las imágenes exportadas (`<slug>/render/<nombre de la imagen>`,
 * ancho `widthPx`). Es lo que se pega en el config junto con los PNG que descarga el exportador.
 */
export function exportedLevels(
  source: LevelPlanSource & { name: string; scopeToBuilding?: boolean },
  slug: string,
  widthPx: number,
  imageStem: (layoutId: string) => string,
): RenderLevelConfig[] {
  return levelLayouts(source.geometry).flatMap(({ id, floors }) =>
    floors.map((floor) => {
      const plan = buildLevelPlan(source, floor);
      const frame = planFrame(plan.bounds);
      const size = frameImageSize(frame, widthPx);
      const image: RenderImage = {
        base: `/clients/${slug}/render/${imageStem(id)}`,
        widths: variantWidths(size.width),
        width: size.width,
        height: size.height,
        alt: `Planta ${id === 'tipo' ? 'tipo' : 'de penthouses'} de ${source.name}`,
      };
      return { floor, label: `Piso ${floor}`, image, hotspots: levelHotspots(plan, frame, source.scopeToBuilding) };
    }),
  );
}
