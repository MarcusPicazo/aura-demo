import { memo, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { polygonToShape, strokePolygons } from '../lib/geometry';
import type { LevelPlan, LevelPlanUnit, PlanFrame } from '../lib/levelPlan';
import type { FloorPlanStyle, Point, UnitStatus } from '../types';

/** Cuánto pesa el color de estado sobre el piso de la unidad (0 = blanco, 1 = color pleno). */
const STATUS_STRENGTH = 0.55;
const HOVER_LIGHTEN = 0.28;
const SELECTED_OUTLINE_THICKNESS = 0.28;

/** Alturas de las capas (m): todo es plano, el orden lo da la altura y la cámara cenital lo respeta. */
const LAYER = { slab: 0, core: 0.01, unit: 0.02, outline: 0.04, furniture: 0.06, door: 0.08, wall: 0.1, window: 0.12, selected: 0.14, code: 0.2 };

const WHITE = new THREE.Color('#ffffff');

/** Tamaño del código de unidad: alto en metros del cuadro de texto. */
const CODE_HEIGHT = 1.1;
const CODE_FONT = '700 120px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Triangula un conjunto de polígonos (x, z en metros) en un único BufferGeometry plano a altura `y`. */
function flatGeometry(polygons: Point[][], y: number): THREE.BufferGeometry | null {
  const parts = polygons
    .filter((polygon) => polygon.length >= 3)
    .map((polygon) => {
      const geometry = new THREE.ShapeGeometry(polygonToShape(polygon));
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, y, 0);
      return geometry;
    });
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Geometría de una capa que se libera al reemplazarla o desmontar (la GPU no la libera sola). */
function useFlatGeometry(polygons: Point[][], y: number): THREE.BufferGeometry | null {
  const geometry = useMemo(() => flatGeometry(polygons, y), [polygons, y]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

function FlatLayer({ polygons, y, color, renderOrder }: { polygons: Point[][]; y: number; color: string; renderOrder: number }) {
  const geometry = useFlatGeometry(polygons, y);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} renderOrder={renderOrder} raycast={() => null}>
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Textura con el código de la unidad (canvas 2D: ninguna fuente que descargar). */
function useCodeTexture(text: string, color: string, halo: string): { texture: THREE.CanvasTexture; aspect: number } {
  const made = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo crear el contexto 2D para el código de unidad.');
    context.font = CODE_FONT;
    const textWidth = Math.ceil(context.measureText(text).width);
    const padding = 24;
    canvas.width = textWidth + padding * 2;
    canvas.height = 160;
    context.font = CODE_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = 22;
    context.strokeStyle = halo;
    context.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, aspect: canvas.width / canvas.height };
  }, [text, color, halo]);
  useEffect(() => () => made.texture.dispose(), [made]);
  return made;
}

function UnitCode({ unit, style }: { unit: LevelPlanUnit; style: FloorPlanStyle }) {
  const { texture, aspect } = useCodeTexture(unit.code, style.codeText, style.codeHalo);
  const [x, z] = unit.labelPoint;
  return (
    <mesh position={[x, LAYER.code, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20} raycast={() => null}>
      <planeGeometry args={[CODE_HEIGHT * aspect, CODE_HEIGHT]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function unitFloorColor(style: FloorPlanStyle, status: UnitStatus | null, hovered: boolean, showStatus: boolean): THREE.Color {
  const color = new THREE.Color(style.unitFill);
  if (showStatus && status) color.lerp(new THREE.Color(style.statusFill[status]), STATUS_STRENGTH);
  if (hovered) color.lerp(WHITE, HOVER_LIGHTEN);
  return color;
}

interface UnitFloorProps {
  unit: LevelPlanUnit;
  status: UnitStatus | null;
  style: FloorPlanStyle;
  showStatus: boolean;
  hovered: boolean;
  onClick: (code: string) => void;
  onHover: (code: string | null, event: ThreeEvent<PointerEvent> | null) => void;
}

function UnitFloor({ unit, status, style, showStatus, hovered, onClick, onHover }: UnitFloorProps) {
  const polygons = useMemo(() => [unit.polygon], [unit.polygon]);
  const geometry = useFlatGeometry(polygons, LAYER.unit);
  const color = useMemo(() => unitFloorColor(style, status, hovered, showStatus), [style, status, hovered, showStatus]);
  if (!geometry) return null;
  return (
    <mesh
      geometry={geometry}
      onClick={(event) => {
        event.stopPropagation();
        onClick(unit.code);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(unit.code, event);
      }}
      onPointerMove={(event) => onHover(unit.code, event)}
      onPointerOut={() => onHover(null, null)}
    >
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

export interface FloorPlanProps {
  plan: LevelPlan;
  /** Estado de disponibilidad por código de unidad (el inventario real). */
  statuses: ReadonlyMap<string, UnitStatus>;
  style: FloorPlanStyle;
  showStatus: boolean;
  showCodes: boolean;
  selectedUnitCode: string | null;
  onSelectUnit: (code: string) => void;
  /** Unidad bajo el cursor, con la posición del puntero en pantalla (para el tooltip); null al salir. */
  onHoverUnit?: (hover: { code: string; x: number; y: number } | null) => void;
}

function FloorPlanComponent({ plan, statuses, style, showStatus, showCodes, selectedUnitCode, onSelectUnit, onHoverUnit }: FloorPlanProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const layers = useMemo(
    () => ({
      outline: plan.units.flatMap((unit) => unit.outline),
      walls: plan.units.flatMap((unit) => unit.walls),
      windows: plan.units.flatMap((unit) => unit.windows),
      doors: plan.units.flatMap((unit) => unit.doors),
      furniture: plan.units.flatMap((unit) => unit.furniture),
    }),
    [plan],
  );

  const slab = useMemo<Point[][]>(() => {
    const { minX, maxX, minZ, maxZ } = plan.bounds;
    return [
      [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ],
    ];
  }, [plan.bounds]);
  const core = useMemo(() => [plan.core], [plan.core]);

  const selectedUnit = plan.units.find((unit) => unit.code === selectedUnitCode);
  const selectedOutline = useMemo(
    () => (selectedUnit ? strokePolygons(selectedUnit.polygon, true, SELECTED_OUTLINE_THICKNESS) : []),
    [selectedUnit],
  );

  useCursor(hoveredCode !== null);

  function handleHover(code: string | null, event: ThreeEvent<PointerEvent> | null) {
    setHoveredCode(code);
    onHoverUnit?.(code && event ? { code, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY } : null);
  }

  return (
    <>
      <color attach="background" args={[style.paper]} />
      <FlatLayer polygons={slab} y={LAYER.slab} color={style.slab} renderOrder={0} />
      <FlatLayer polygons={core} y={LAYER.core} color={style.core} renderOrder={1} />

      {plan.units.map((unit) => (
        <UnitFloor
          key={unit.code}
          unit={unit}
          status={statuses.get(unit.code) ?? null}
          style={style}
          showStatus={showStatus}
          hovered={hoveredCode === unit.code}
          onClick={onSelectUnit}
          onHover={handleHover}
        />
      ))}

      <FlatLayer polygons={layers.outline} y={LAYER.outline} color={style.outline} renderOrder={2} />
      <FlatLayer polygons={layers.furniture} y={LAYER.furniture} color={style.furniture} renderOrder={3} />
      <FlatLayer polygons={layers.doors} y={LAYER.door} color={style.door} renderOrder={4} />
      <FlatLayer polygons={layers.walls} y={LAYER.wall} color={style.wall} renderOrder={5} />
      <FlatLayer polygons={layers.windows} y={LAYER.window} color={style.window} renderOrder={6} />
      <FlatLayer polygons={selectedOutline} y={LAYER.selected} color={style.selected} renderOrder={7} />

      {showCodes && plan.units.map((unit) => <UnitCode key={unit.code} unit={unit} style={style} />)}
    </>
  );
}

/**
 * Planta de un nivel dibujada por el motor, vista desde arriba: losa, unidades coloreadas
 * por estado de disponibilidad, muros, ventanas, puertas, mobiliario y el código de cada
 * unidad. Es plana y de colores lisos (`MeshBasicMaterial`, sin luces), así que se ve igual
 * en pantalla que en la imagen exportada. Genérica: la forma sale de `LevelPlan` y los
 * colores de `style`, nada es de un cliente.
 */
export const FloorPlan = memo(FloorPlanComponent);

/**
 * Cámara ortográfica cenital que encuadra `frame` completo en el lienzo, con el norte del
 * plano (z mínima) hacia arriba y x creciendo hacia la derecha, igual que el plano SVG de
 * la ficha de unidad. Se reajusta sola al cambiar el tamaño del lienzo.
 */
export function PlanCamera({ frame }: { frame: PlanFrame }) {
  const getState = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    // La cámara se lee del estado de R3F dentro del efecto (no como valor de un hook): se va a modificar.
    const { camera } = getState();
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const centerX = frame.minX + frame.width / 2;
    const centerZ = frame.minZ + frame.depth / 2;
    camera.up.set(0, 0, -1);
    camera.position.set(centerX, 50, centerZ);
    camera.lookAt(centerX, 0, centerZ);
    camera.near = 1;
    camera.far = 100;
    // El lienzo mide `size` píxeles y la cámara abarca `size` unidades a zoom 1: el zoom es píxeles por metro.
    camera.zoom = Math.min(size.width / frame.width, size.height / frame.depth);
    camera.updateProjectionMatrix();
    invalidate();
  }, [getState, size.width, size.height, frame, invalidate]);

  return null;
}
