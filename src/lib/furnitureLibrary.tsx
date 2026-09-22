import type { ReactElement } from 'react';
import type { FurniturePiece } from '../types';

const STROKE = '#8a8478';
const STROKE_WIDTH = 0.03;
const FILL = 'none';

/**
 * Símbolos 2D genéricos de mobiliario, vistos en planta, dibujados centrados en el origen
 * a su tamaño real en metros (coincide 1:1 con las unidades del resto del plano, así que
 * no llevan escala propia). El motor solo los traslada/rota según `FurniturePiece`; el tipo
 * de mobiliario no depende de ningún cliente.
 */
function BedDouble() {
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-0.75} y={-1} width={1.5} height={2} />
      <line x1={-0.75} y1={-0.65} x2={0.75} y2={-0.65} />
      <rect x={-0.65} y={-0.9} width={0.5} height={0.35} />
      <rect x={0.15} y={-0.9} width={0.5} height={0.35} />
    </g>
  );
}

function BedSingle() {
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-0.45} y={-1} width={0.9} height={2} />
      <line x1={-0.45} y1={-0.65} x2={0.45} y2={-0.65} />
      <rect x={-0.35} y={-0.9} width={0.7} height={0.35} />
    </g>
  );
}

function Sofa() {
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-0.9} y={-0.4} width={1.8} height={0.8} />
      <line x1={-0.9} y1={-0.15} x2={0.9} y2={-0.15} />
      <line x1={-0.3} y1={-0.15} x2={-0.3} y2={0.4} />
      <line x1={0.3} y1={-0.15} x2={0.3} y2={0.4} />
    </g>
  );
}

function DiningTable() {
  const chairs: [number, number][] = [
    [-0.35, -0.65],
    [0.35, -0.65],
    [-0.35, 0.65],
    [0.35, 0.65],
  ];
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-0.7} y={-0.4} width={1.4} height={0.8} />
      {chairs.map(([cx, cy]) => (
        <rect key={`${cx}-${cy}`} x={cx - 0.2} y={cy - 0.2} width={0.4} height={0.4} />
      ))}
    </g>
  );
}

function Kitchen() {
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-1.2} y={-0.3} width={2.4} height={0.6} />
      <circle cx={-0.75} cy={0} r={0.12} />
      <circle cx={-0.35} cy={0} r={0.12} />
      <rect x={0.35} y={-0.2} width={0.7} height={0.4} />
    </g>
  );
}

function Toilet() {
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-0.2} y={-0.35} width={0.4} height={0.2} />
      <ellipse cx={0} cy={0.15} rx={0.22} ry={0.3} />
    </g>
  );
}

function Sink() {
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-0.25} y={-0.2} width={0.5} height={0.4} rx={0.05} />
      <circle cx={0} cy={0} r={0.12} />
    </g>
  );
}

function Shower() {
  return (
    <g stroke={STROKE} strokeWidth={STROKE_WIDTH} fill={FILL}>
      <rect x={-0.45} y={-0.45} width={0.9} height={0.9} />
      <line x1={-0.45} y1={-0.45} x2={0.45} y2={0.45} />
    </g>
  );
}

const SYMBOLS: Record<FurniturePiece['type'], () => ReactElement> = {
  bed_double: BedDouble,
  bed_single: BedSingle,
  sofa: Sofa,
  dining_table: DiningTable,
  kitchen: Kitchen,
  toilet: Toilet,
  sink: Sink,
  shower: Shower,
};

interface FurnitureSymbolProps {
  piece: FurniturePiece;
}

export function FurnitureSymbol({ piece }: FurnitureSymbolProps) {
  const Symbol = SYMBOLS[piece.type];
  const [x, z] = piece.position;
  return (
    <g transform={`translate(${x} ${z}) rotate(${piece.rotation ?? 0})`}>
      <Symbol />
    </g>
  );
}
