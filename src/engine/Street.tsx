import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { sideAxisFrom, type PolygonBounds } from '../lib/geometry';
import type { StreetConfig } from '../types';

const CURB_WIDTH = 0.15;
const DASH_LENGTH = 1.5;
const DASH_GAP = 1.5;
const DASH_WIDTH = 0.12;
const CAR_GAP_FROM_CURB = 0.35;

/** Piso/coches/línea, no interactivos: fuera del raycasting. */
const noRaycast = () => null;

interface StreetProps {
  footprint: PolygonBounds;
  street: StreetConfig;
}

/** Escribe las matrices en el buffer del InstancedMesh una sola vez (o cuando cambian) y pide un frame. */
function useInstanceMatrices(matrices: THREE.Matrix4[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [matrices, invalidate]);
  return ref;
}

/**
 * Calle a lo largo de un lado de la huella de la torre: banqueta con guarnición, arroyo de
 * asfalto con línea central punteada, banqueta/guarnición espejo del otro lado, y coches
 * estacionados junto a la guarnición cercana. Todo en coordenadas locales (u = a lo largo
 * de la calle, v = hacia afuera de la torre) convertidas a mundo según `street.side`.
 */
export function Street({ footprint, street }: StreetProps) {
  const span = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ);
  const streetLength = span * 5;

  const { toWorld: toWorldRaw, rotationY } = useMemo(() => sideAxisFrom(footprint, street.side), [footprint, street.side]);
  const toWorld = (u: number, v: number): [number, number] => toWorldRaw(u, street.distanceFromTower + v);

  // v acumulada desde el pie de la torre hacia afuera: banqueta, guarnición, arroyo, guarnición, banqueta.
  const vSidewalkNear = street.sidewalkWidth / 2;
  const vCurbNear = street.sidewalkWidth + CURB_WIDTH / 2;
  const vAsphalt = street.sidewalkWidth + CURB_WIDTH + street.width / 2;
  const vCurbFar = street.sidewalkWidth + CURB_WIDTH + street.width + CURB_WIDTH / 2;
  const vSidewalkFar = street.sidewalkWidth + CURB_WIDTH + street.width + CURB_WIDTH + street.sidewalkWidth / 2;

  const sidewalkGeometry = useMemo(
    () => new THREE.BoxGeometry(streetLength, 0.1, street.sidewalkWidth),
    [streetLength, street.sidewalkWidth],
  );
  const sidewalkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: street.sidewalkColor, roughness: 0.9, metalness: 0 }),
    [street.sidewalkColor],
  );
  const curbGeometry = useMemo(
    () => new THREE.BoxGeometry(streetLength, street.curbHeight, CURB_WIDTH),
    [streetLength, street.curbHeight],
  );
  const curbMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: street.curbColor, roughness: 0.8, metalness: 0 }),
    [street.curbColor],
  );
  const asphaltGeometry = useMemo(() => new THREE.BoxGeometry(streetLength, 0.05, street.width), [streetLength, street.width]);
  const asphaltMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: street.asphaltColor, roughness: 0.95, metalness: 0 }),
    [street.asphaltColor],
  );

  const [sidewalkNearX, sidewalkNearZ] = toWorld(0, vSidewalkNear);
  const [curbNearX, curbNearZ] = toWorld(0, vCurbNear);
  const [asphaltX, asphaltZ] = toWorld(0, vAsphalt);
  const [curbFarX, curbFarZ] = toWorld(0, vCurbFar);
  const [sidewalkFarX, sidewalkFarZ] = toWorld(0, vSidewalkFar);

  // Línea central punteada: un InstancedMesh de segmentos cortos a lo largo del arroyo.
  const dashMatrices = useMemo(() => {
    const step = DASH_LENGTH + DASH_GAP;
    const count = Math.max(1, Math.floor(streetLength / step));
    const matrices: THREE.Matrix4[] = [];
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    for (let index = 0; index < count; index += 1) {
      const u = -streetLength / 2 + step * index + step / 2;
      const [x, z] = toWorld(u, vAsphalt);
      matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.06, z), quaternion, new THREE.Vector3(1, 1, 1)));
    }
    return matrices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streetLength, rotationY, vAsphalt, toWorldRaw, street.distanceFromTower]);
  const dashGeometry = useMemo(() => new THREE.BoxGeometry(DASH_LENGTH, 0.01, DASH_WIDTH), []);
  const dashMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: street.lineColor, roughness: 0.6 }), [street.lineColor]);
  const dashRef = useInstanceMatrices(dashMatrices);

  // Coches estacionados junto a la guarnición cercana, dentro del arroyo. Un InstancedMesh
  // por color de la paleta (no `vertexColors` con InstancedMesh: en esta versión de three.js
  // el tinte por instancia se ve negro — ver NeighborBuildings.tsx para el mismo hallazgo).
  const carsByColor = useMemo(() => {
    const count = Math.max(0, Math.floor(streetLength / street.carSpacing) - 1);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    const scale = new THREE.Vector3(1, 1, 1);
    const vCar = street.sidewalkWidth + CURB_WIDTH + CAR_GAP_FROM_CURB + street.carWidth / 2;
    const groups = new Map<string, THREE.Matrix4[]>();
    for (let index = 0; index < count; index += 1) {
      const u = -streetLength / 2 + street.carSpacing * (index + 1);
      const [x, z] = toWorld(u, vCar);
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, street.carHeight / 2, z), quaternion, scale);
      const color = street.carColors[index % Math.max(1, street.carColors.length)] ?? '#8B8B8B';
      const list = groups.get(color) ?? [];
      list.push(matrix);
      groups.set(color, list);
    }
    return Array.from(groups.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    streetLength,
    street.carSpacing,
    street.sidewalkWidth,
    street.carWidth,
    street.carHeight,
    street.carColors,
    rotationY,
    toWorldRaw,
    street.distanceFromTower,
  ]);
  const carGeometry = useMemo(
    () => new THREE.BoxGeometry(street.carLength, street.carHeight, street.carWidth),
    [street.carLength, street.carHeight, street.carWidth],
  );

  return (
    <group>
      <mesh geometry={sidewalkGeometry} material={sidewalkMaterial} position={[sidewalkNearX, 0.05, sidewalkNearZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} receiveShadow />
      <mesh geometry={curbGeometry} material={curbMaterial} position={[curbNearX, street.curbHeight / 2, curbNearZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} castShadow receiveShadow />
      <mesh geometry={asphaltGeometry} material={asphaltMaterial} position={[asphaltX, 0.025, asphaltZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} receiveShadow />
      <mesh geometry={curbGeometry} material={curbMaterial} position={[curbFarX, street.curbHeight / 2, curbFarZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} castShadow receiveShadow />
      <mesh geometry={sidewalkGeometry} material={sidewalkMaterial} position={[sidewalkFarX, 0.05, sidewalkFarZ]} rotation={[0, rotationY, 0]} raycast={noRaycast} receiveShadow />

      <instancedMesh ref={dashRef} args={[dashGeometry, dashMaterial, dashMatrices.length]} raycast={noRaycast} />
      {carsByColor.map(([color, matrices]) => (
        <CarGroup key={color} color={color} matrices={matrices} geometry={carGeometry} />
      ))}
    </group>
  );
}

function CarGroup({ color, matrices, geometry }: { color: string; matrices: THREE.Matrix4[]; geometry: THREE.BoxGeometry }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 }), [color]);
  const ref = useInstanceMatrices(matrices);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} raycast={noRaycast} castShadow receiveShadow />;
}
