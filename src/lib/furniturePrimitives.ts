import type { FurniturePiece, FurnitureType, Point } from '../types';

/**
 * Símbolos de mobiliario como DATOS, vistos en planta y centrados en el origen a su tamaño
 * real en metros. Una sola definición alimenta los dos dibujos del plano: el SVG de la ficha
 * de unidad (`furnitureLibrary.tsx`) y la planta del motor (`levelPlan.ts` → `engine/FloorPlan`),
 * así un mueble nuevo o ajustado aparece igual en los dos. Genérico: nada de esto es de un cliente.
 */
export type FurniturePrimitive =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

/** Grosor del trazo del mobiliario, en metros. */
export const FURNITURE_STROKE_WIDTH = 0.03;

const rect = (x: number, y: number, width: number, height: number, rx?: number): FurniturePrimitive => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  rx,
});
const line = (x1: number, y1: number, x2: number, y2: number): FurniturePrimitive => ({ kind: 'line', x1, y1, x2, y2 });
const circle = (cx: number, cy: number, r: number): FurniturePrimitive => ({ kind: 'circle', cx, cy, r });
const ellipse = (cx: number, cy: number, rx: number, ry: number): FurniturePrimitive => ({ kind: 'ellipse', cx, cy, rx, ry });

const DINING_CHAIRS: Point[] = [
  [-0.35, -0.65],
  [0.35, -0.65],
  [-0.35, 0.65],
  [0.35, 0.65],
];

export const FURNITURE_PRIMITIVES: Record<FurnitureType, FurniturePrimitive[]> = {
  bed_double: [rect(-0.75, -1, 1.5, 2), line(-0.75, -0.65, 0.75, -0.65), rect(-0.65, -0.9, 0.5, 0.35), rect(0.15, -0.9, 0.5, 0.35)],
  bed_single: [rect(-0.45, -1, 0.9, 2), line(-0.45, -0.65, 0.45, -0.65), rect(-0.35, -0.9, 0.7, 0.35)],
  sofa: [rect(-0.9, -0.4, 1.8, 0.8), line(-0.9, -0.15, 0.9, -0.15), line(-0.3, -0.15, -0.3, 0.4), line(0.3, -0.15, 0.3, 0.4)],
  dining_table: [rect(-0.7, -0.4, 1.4, 0.8), ...DINING_CHAIRS.map(([cx, cy]) => rect(cx - 0.2, cy - 0.2, 0.4, 0.4))],
  kitchen: [rect(-1.2, -0.3, 2.4, 0.6), circle(-0.75, 0, 0.12), circle(-0.35, 0, 0.12), rect(0.35, -0.2, 0.7, 0.4)],
  toilet: [rect(-0.2, -0.35, 0.4, 0.2), ellipse(0, 0.15, 0.22, 0.3)],
  sink: [rect(-0.25, -0.2, 0.5, 0.4, 0.05), circle(0, 0, 0.12)],
  shower: [rect(-0.45, -0.45, 0.9, 0.9), line(-0.45, -0.45, 0.45, 0.45)],
};

/** Una línea quebrada del trazo de un mueble; `closed` une el último punto con el primero. */
export interface Polyline {
  points: Point[];
  closed: boolean;
}

/** Segmentos por cuarto de vuelta al aproximar curvas (círculos, elipses, esquinas redondeadas). */
const CURVE_STEPS_PER_QUARTER = 6;

function arcPoints(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Point[] {
  const steps = Math.max(2, Math.ceil((Math.abs(to - from) / (Math.PI / 2)) * CURVE_STEPS_PER_QUARTER));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / steps;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

function primitivePolyline(primitive: FurniturePrimitive): Polyline {
  switch (primitive.kind) {
    case 'line':
      return {
        points: [
          [primitive.x1, primitive.y1],
          [primitive.x2, primitive.y2],
        ],
        closed: false,
      };
    case 'circle':
      return { points: arcPoints(primitive.cx, primitive.cy, primitive.r, primitive.r, 0, Math.PI * 2).slice(0, -1), closed: true };
    case 'ellipse':
      return { points: arcPoints(primitive.cx, primitive.cy, primitive.rx, primitive.ry, 0, Math.PI * 2).slice(0, -1), closed: true };
    case 'rect': {
      const { x, y, width, height } = primitive;
      const r = Math.min(primitive.rx ?? 0, width / 2, height / 2);
      if (r <= 0) {
        return {
          points: [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
          ],
          closed: true,
        };
      }
      return {
        points: [
          ...arcPoints(x + width - r, y + r, r, r, -Math.PI / 2, 0),
          ...arcPoints(x + width - r, y + height - r, r, r, 0, Math.PI / 2),
          ...arcPoints(x + r, y + height - r, r, r, Math.PI / 2, Math.PI),
          ...arcPoints(x + r, y + r, r, r, Math.PI, (Math.PI * 3) / 2),
        ],
        closed: true,
      };
    }
  }
}

/**
 * Trazo de una pieza ya colocada: las primitivas de su tipo, giradas `rotation` grados en
 * sentido horario (igual que el `rotate()` del SVG, con x a la derecha y z hacia abajo) y
 * trasladadas a su `position`, en las mismas coordenadas locales del plano de la unidad.
 */
export function furniturePolylines(piece: FurniturePiece): Polyline[] {
  const angle = ((piece.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [offsetX, offsetZ] = piece.position;
  return FURNITURE_PRIMITIVES[piece.type].map((primitive) => {
    const { points, closed } = primitivePolyline(primitive);
    return {
      closed,
      points: points.map(([x, y]): Point => [offsetX + x * cos - y * sin, offsetZ + x * sin + y * cos]),
    };
  });
}
