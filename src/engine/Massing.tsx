import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { polygonToShape } from '../lib/geometry';
import type { Point } from '../types';

/** Una franja del volumen: de qué altura a qué altura, y de qué color (hex). */
export interface MassingBandSpec {
  y: number;
  height: number;
  color: string;
}

/** Un edificio visto de lejos: solo su volumen, sin balcones, canceles ni lobby. */
export interface MassingItem {
  id: string;
  /** Polígonos de planta (x, z en metros, coordenadas locales) que se extruyen hasta `height`. */
  polygons: Point[][];
  /** Franjas de abajo arriba (planta baja, vidrio, losa…): le dan al volumen su lectura de edificio. */
  bands: MassingBandSpec[];
  /** Centro de la huella en el mundo, centro de la huella en su planta local, y giro en Y (radianes). */
  position: Point;
  pivot: Point;
  rotationY: number;
}

interface MassingProps {
  /** La forma de cada edificio. Debe ser estable (no cambiar de referencia por cambios de color). */
  items: MassingItem[];
  /** Tinte de cada edificio por id (hex): blanco deja los colores de las franjas tal cual; la disponibilidad lo vira hacia su color. */
  tints: ReadonlyMap<string, string>;
  /** El edificio activo se dibuja con todo su detalle aparte; aquí se oculta para no duplicarlo. */
  hiddenId: string | null;
  onSelect: (id: string) => void;
  roughness?: number;
}

/** Cuánto se aclara el volumen bajo el cursor (0 = igual, 1 = blanco). */
const HOVER_LIGHTEN = 0.25;
const WHITE = new THREE.Color('#ffffff');
const noRaycast = () => null;

/** Dos edificios con la misma forma y altura comparten geometría (y un solo InstancedMesh). */
function shapeKey(item: MassingItem): string {
  const bands = item.bands.map((band) => `${band.y}:${band.height}:${band.color}`).join(',');
  return `${bands}|${item.polygons.map((polygon) => polygon.map(([x, z]) => `${x},${z}`).join(';')).join('/')}`;
}

function buildGeometry(item: MassingItem): THREE.BufferGeometry {
  const parts = item.bands.flatMap((band) => {
    const color = new THREE.Color(band.color);
    return item.polygons.map((polygon) => {
      const geometry = new THREE.ExtrudeGeometry(polygonToShape(polygon), { depth: band.height, bevelEnabled: false });
      // La extrusión crece hacia +Z del Shape; girada −90° en X crece hacia arriba y deja la planta en (x, z).
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, band.y, 0);
      // Un color por vértice (la franja entera): el material los multiplica por el tinte de la instancia.
      const count = geometry.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) colors.set([color.r, color.g, color.b], index * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geometry;
    });
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

interface MassingGroup {
  key: string;
  geometry: THREE.BufferGeometry;
  items: MassingItem[];
}

/**
 * Volúmenes de todos los edificios del conjunto, con instancing: los que comparten forma salen
 * de un solo `InstancedMesh` (un draw call, una geometría), cada instancia con su posición, giro
 * y color. Es la versión barata de lejos; el detalle completo (`Tower`) se monta solo para el
 * edificio activo. Cada volumen es clicable (`onSelect`) y se aclara al pasar el cursor.
 *
 * La geometría solo se reconstruye si cambia la FORMA de algún edificio (`items`), no por cada cambio de
 * color (`tints`, que llega a cada actualización de disponibilidad por Realtime).
 */
function MassingComponent({ items, tints, hiddenId, onSelect, roughness = 0.85 }: MassingProps) {
  const geometries = useMemo(() => {
    const byKey = new Map<string, THREE.BufferGeometry>();
    for (const item of items) {
      const key = shapeKey(item);
      if (!byKey.has(key)) byKey.set(key, buildGeometry(item));
    }
    return byKey;
  }, [items]);

  // La geometría la arma este componente a mano: hay que liberarla al reemplazarla o desmontar.
  useEffect(
    () => () => {
      geometries.forEach((geometry) => geometry.dispose());
    },
    [geometries],
  );

  const groups = useMemo<MassingGroup[]>(() => {
    const byKey = new Map<string, MassingItem[]>();
    for (const item of items) {
      const key = shapeKey(item);
      byKey.set(key, [...(byKey.get(key) ?? []), item]);
    }
    return [...byKey.entries()].flatMap(([key, groupItems]) => {
      const geometry = geometries.get(key);
      return geometry ? [{ key, geometry, items: groupItems }] : [];
    });
  }, [items, geometries]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness, metalness: 0.05 }), [roughness]);
  useEffect(() => () => material.dispose(), [material]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <group>
      {groups.map((group) => (
        <MassingInstances
          key={group.key}
          group={group}
          material={material}
          tints={tints}
          hiddenId={hiddenId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={setHoveredId}
        />
      ))}
    </group>
  );
}

interface MassingInstancesProps {
  group: MassingGroup;
  material: THREE.Material;
  tints: ReadonlyMap<string, string>;
  hiddenId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function MassingInstances({ group, material, tints, hiddenId, hoveredId, onSelect, onHover }: MassingInstancesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const { items } = group;

  // Matrices y colores se escriben en el buffer del InstancedMesh (no por instancia en React) y
  // piden un cuadro: bajo `frameloop="demand"` nada se redibuja solo.
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    items.forEach((item, index) => {
      if (item.id === hiddenId) {
        matrix.makeScale(0, 0, 0);
      } else {
        matrix
          .makeTranslation(item.position[0], 0, item.position[1])
          .multiply(new THREE.Matrix4().makeRotationY(item.rotationY))
          .multiply(new THREE.Matrix4().makeTranslation(-item.pivot[0], 0, -item.pivot[1]));
      }
      mesh.setMatrixAt(index, matrix);
      color.set(tints.get(item.id) ?? '#ffffff');
      if (item.id === hoveredId) color.lerp(WHITE, HOVER_LIGHTEN);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Sin esto el raycaster usaría la caja de la geometría original, no la de las instancias colocadas.
    mesh.computeBoundingSphere();
    invalidate();
  }, [items, tints, hiddenId, hoveredId, invalidate]);

  function itemFor(event: ThreeEvent<MouseEvent | PointerEvent>): MassingItem | undefined {
    return event.instanceId === undefined ? undefined : items[event.instanceId];
  }

  return (
    <instancedMesh
      ref={ref}
      args={[group.geometry, material, items.length]}
      castShadow
      receiveShadow
      // El que está oculto tiene escala 0, pero el raycaster igual lo probaría; que no estorbe.
      raycast={items.length === 1 && items[0].id === hiddenId ? noRaycast : undefined}
      onClick={(event) => {
        const item = itemFor(event);
        if (!item || item.id === hiddenId) return;
        event.stopPropagation();
        onSelect(item.id);
      }}
      onPointerOver={(event) => {
        const item = itemFor(event);
        if (!item || item.id === hiddenId) return;
        event.stopPropagation();
        onHover(item.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = 'auto';
      }}
    />
  );
}

export const Massing = memo(MassingComponent);
