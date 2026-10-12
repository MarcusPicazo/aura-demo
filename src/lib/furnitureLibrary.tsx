import type { ReactElement } from 'react';
import { FURNITURE_PRIMITIVES, FURNITURE_STROKE_WIDTH, type FurniturePrimitive } from './furniturePrimitives';
import type { FurniturePiece } from '../types';

const STROKE = '#8a8478';

function renderPrimitive(primitive: FurniturePrimitive, index: number): ReactElement {
  switch (primitive.kind) {
    case 'rect':
      return <rect key={index} x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} rx={primitive.rx} />;
    case 'line':
      return <line key={index} x1={primitive.x1} y1={primitive.y1} x2={primitive.x2} y2={primitive.y2} />;
    case 'circle':
      return <circle key={index} cx={primitive.cx} cy={primitive.cy} r={primitive.r} />;
    case 'ellipse':
      return <ellipse key={index} cx={primitive.cx} cy={primitive.cy} rx={primitive.rx} ry={primitive.ry} />;
  }
}

interface FurnitureSymbolProps {
  piece: FurniturePiece;
}

/**
 * Símbolo 2D (SVG) de una pieza de mobiliario, visto en planta. Las formas salen de
 * `furniturePrimitives.ts` —la misma fuente que usa la planta del motor—; aquí solo se
 * traduce cada primitiva a su elemento SVG y se traslada/rota según `FurniturePiece`.
 */
export function FurnitureSymbol({ piece }: FurnitureSymbolProps) {
  const [x, z] = piece.position;
  return (
    <g transform={`translate(${x} ${z}) rotate(${piece.rotation ?? 0})`}>
      <g stroke={STROKE} strokeWidth={FURNITURE_STROKE_WIDTH} fill="none">
        {FURNITURE_PRIMITIVES[piece.type].map(renderPrimitive)}
      </g>
    </g>
  );
}
