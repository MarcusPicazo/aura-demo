import { doorSwingPath, pointsToSvgPath, polygonArea, polygonBounds, thickSegmentPolygon } from '../lib/geometry';
import { FurnitureSymbol } from '../lib/furnitureLibrary';
import { useI18n, type I18n } from '../i18n/useI18n';
import type { FloorPlanConfig, Point } from '../types';

const PADDING = 0.6;
const WALL_FILL = '#4a473f';
const WINDOW_FILL = '#a9c6d8';
const ROOM_LABEL_COLOR = '#6b6862';

interface FloorPlanDetailedProps {
  /** Contorno de la unidad tal como vive en `geometry.plate`/`penthousePlate` (coordenadas de la
   *  torre). Sin modelo 3D no hay contorno: un plano en imagen se muestra igual, uno dibujado no. */
  outline: Point[] | undefined;
  plan: FloorPlanConfig | undefined;
  /** Idioma con que se rotulan los espacios; por omisión el de la interfaz. Se pasa explícito al rasterizar el plano para el PDF (fuera de React no hay estado vivo). */
  i18n?: I18n;
}

/**
 * Plano de planta de una unidad: si `plan.kind === 'image'` es solo el archivo del cliente;
 * si es `'drawn'`, arma el SVG a partir de datos (muros con grosor, puertas con abatimiento,
 * ventanas, espacios con su m² calculado, y mobiliario). No conoce nada de "aura": todo
 * (outline, plan) llega por props desde la vista que sí conoce la config del cliente activo.
 */
export function FloorPlanDetailed({ outline, plan, i18n }: FloorPlanDetailedProps) {
  const live = useI18n();
  const { t, text } = i18n ?? live;
  if (!plan) return null;

  if (plan.kind === 'image') {
    return <img src={plan.src} alt={t('floorPlan.alt')} className="w-full rounded-lg bg-neutral-50" />;
  }

  if (!outline) return null;

  // El contorno viene en coordenadas absolutas de la torre (geometry.plate); los datos del
  // plano (muros, puertas, cuartos, mobiliario) se escriben en config ya en coordenadas
  // locales a la unidad (0,0 = esquina de su bounding box), para no tener que repetir la
  // posición de cada unidad dentro de la torre al describir su interior. Por eso llevan
  // desplazamientos distintos: el contorno se normaliza restando su propio bounding box;
  // lo local solo necesita el margen del padding.
  const bounds = polygonBounds([outline]);
  const width = bounds.maxX - bounds.minX + PADDING * 2;
  const height = bounds.maxZ - bounds.minZ + PADDING * 2;

  const shiftOutline = ([x, z]: Point): Point => [x - bounds.minX + PADDING, z - bounds.minZ + PADDING];
  const shiftOutlineAll = (points: Point[]): Point[] => points.map(shiftOutline);

  const shiftLocal = ([x, z]: Point): Point => [x + PADDING, z + PADDING];
  const shiftLocalAll = (points: Point[]): Point[] => points.map(shiftLocal);

  const { wallThickness, walls, doors, windows, rooms, furniture } = plan;

  return (
    <svg viewBox={`0 0 ${width.toFixed(2)} ${height.toFixed(2)}`} className="w-full rounded-lg bg-neutral-50">
      {/* Colores como atributos (no clases): el mismo SVG se rasteriza para la cotización en PDF, donde no hay CSS. */}
      <path d={pointsToSvgPath(shiftOutlineAll(outline))} fill="#ffffff" stroke="#d4d4d4" strokeWidth={0.03} />

      {walls.map((segment, index) => (
        <polygon
          key={`wall-${index}`}
          points={shiftLocalAll(thickSegmentPolygon(segment.from, segment.to, wallThickness))
            .map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`)
            .join(' ')}
          fill={WALL_FILL}
        />
      ))}

      {/* Ventanas se dibujan encima de los muros: son un tramo de muro con un acabado
          distinto, no huecos aparte que haya que restar de la geometría del muro. */}
      {windows.map((segment, index) => (
        <polygon
          key={`window-${index}`}
          points={shiftLocalAll(thickSegmentPolygon(segment.from, segment.to, wallThickness * 0.6))
            .map(([x, z]) => `${x.toFixed(2)},${z.toFixed(2)}`)
            .join(' ')}
          fill={WINDOW_FILL}
        />
      ))}

      {furniture.map((piece, index) => (
        <g key={`${piece.type}-${index}`} transform={`translate(${PADDING} ${PADDING})`}>
          <FurnitureSymbol piece={piece} />
        </g>
      ))}

      {rooms.map((room) => {
        const shiftedRoom = shiftLocalAll(room.polygon);
        const [labelX, labelZ] = shiftedRoom.reduce<Point>(
          ([accX, accZ], [x, z]) => [accX + x / shiftedRoom.length, accZ + z / shiftedRoom.length],
          [0, 0],
        );
        return (
          <g key={text(room.label)}>
            <text x={labelX} y={labelZ - 0.12} textAnchor="middle" fontSize={0.26} fill={ROOM_LABEL_COLOR}>
              {text(room.label)}
            </text>
            <text x={labelX} y={labelZ + 0.16} textAnchor="middle" fontSize={0.22} fill={ROOM_LABEL_COLOR}>
              {polygonArea(room.polygon).toFixed(1)} m²
            </text>
          </g>
        );
      })}

      {doors.map((door, index) => {
        const { leaf, arcFrom, arcTo, radius, sweepFlag } = doorSwingPath(door);
        const [leafFrom, leafTo] = shiftLocalAll(leaf);
        const [shiftedArcFrom, shiftedArcTo] = shiftLocalAll([arcFrom, arcTo]);
        const arcD =
          `M ${shiftedArcFrom[0].toFixed(2)} ${shiftedArcFrom[1].toFixed(2)} ` +
          `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 ${sweepFlag} ${shiftedArcTo[0].toFixed(2)} ${shiftedArcTo[1].toFixed(2)}`;
        return (
          <g key={`door-${index}`} stroke="#4a473f" strokeWidth={0.02} fill="none">
            <line x1={leafFrom[0]} y1={leafFrom[1]} x2={leafTo[0]} y2={leafTo[1]} />
            <path d={arcD} strokeDasharray="0.06 0.06" />
          </g>
        );
      })}
    </svg>
  );
}
