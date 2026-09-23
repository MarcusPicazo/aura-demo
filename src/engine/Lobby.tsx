import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { computeMullionPoints, type PolygonBounds } from '../lib/geometry';
import type { LobbyConfig } from '../types';

/** Decorativo/estructural, no vendible: fuera del raycasting para no interferir con el picking de unidades. */
const noRaycast = () => null;

interface LobbyProps {
  footprint: PolygonBounds;
  groundFloorHeight: number;
  profileColor: string;
  lobby: LobbyConfig;
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
 * Planta baja: antes era un bloque sólido opaco. Ahora es un lobby de doble altura con
 * vidrio, columnas delgadas alrededor de la huella, y una marquesina en voladizo sobre la
 * entrada. Genérico: la huella y la altura vienen de `geometry`/`layout`, medidas y colores
 * de `lobby` (config del cliente) — nada de esto es un dato fijo de este cliente en particular.
 */
export function Lobby({ footprint, groundFloorHeight, profileColor, lobby }: LobbyProps) {
  const { minX, maxX, minZ, maxZ } = footprint;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  const glassGeometry = useMemo(() => new THREE.BoxGeometry(width, groundFloorHeight, depth), [width, groundFloorHeight, depth]);
  const glassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: lobby.glassColor,
        transparent: true,
        opacity: 0.35,
        roughness: 0.08,
        metalness: 0,
        clearcoat: 0.5,
        envMapIntensity: lobby.glassReflectivity,
        side: THREE.DoubleSide,
      }),
    [lobby.glassColor, lobby.glassReflectivity],
  );

  // Columnas: un punto cada `columnSpacing` m a lo largo del rectángulo de la huella —
  // se reutiliza la misma subdivisión de perímetro que la carpintería de fachada.
  const columnMatrices = useMemo(() => {
    const perimeter: [number, number][] = [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ];
    return computeMullionPoints(perimeter, lobby.columnSpacing).map(
      ([x, z]) => new THREE.Matrix4().makeTranslation(x, groundFloorHeight / 2, z),
    );
  }, [minX, maxX, minZ, maxZ, lobby.columnSpacing, groundFloorHeight]);

  const columnGeometry = useMemo(
    () => new THREE.CylinderGeometry(lobby.columnRadius, lobby.columnRadius, groundFloorHeight, 12),
    [lobby.columnRadius, groundFloorHeight],
  );
  const columnMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: lobby.columnColor, roughness: 0.4, metalness: 0.3 }),
    [lobby.columnColor],
  );
  const columnRef = useInstanceMatrices(columnMatrices);

  // Marquesina: losa en voladizo sobre el lado de la entrada, fuera de la huella.
  const marqueeAxis = lobby.marqueeSide === 'minX' || lobby.marqueeSide === 'maxX' ? 'x' : 'z';
  const marqueeSign = lobby.marqueeSide === 'minX' || lobby.marqueeSide === 'minZ' ? -1 : 1;
  const marqueeSpan = marqueeAxis === 'x' ? depth : width;
  const marqueeWidth = marqueeAxis === 'x' ? lobby.marqueeDepth : marqueeSpan;
  const marqueeDepthDim = marqueeAxis === 'x' ? marqueeSpan : lobby.marqueeDepth;
  const marqueeGeometry = useMemo(
    () => new THREE.BoxGeometry(marqueeWidth, lobby.marqueeThickness, marqueeDepthDim),
    [marqueeWidth, lobby.marqueeThickness, marqueeDepthDim],
  );
  const marqueeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: lobby.marqueeColor, roughness: 0.6, metalness: 0.05 }),
    [lobby.marqueeColor],
  );
  const marqueePosition: [number, number, number] =
    marqueeAxis === 'x'
      ? [centerX + marqueeSign * (width / 2 + lobby.marqueeDepth / 2), lobby.marqueeElevation, centerZ]
      : [centerX, lobby.marqueeElevation, centerZ + marqueeSign * (depth / 2 + lobby.marqueeDepth / 2)];

  return (
    <group>
      <mesh
        geometry={glassGeometry}
        material={glassMaterial}
        position={[centerX, groundFloorHeight / 2, centerZ]}
        raycast={noRaycast}
        receiveShadow
      />

      <instancedMesh
        ref={columnRef}
        args={[columnGeometry, columnMaterial, columnMatrices.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />

      <mesh geometry={marqueeGeometry} material={marqueeMaterial} position={marqueePosition} raycast={noRaycast} castShadow receiveShadow>
        <Edges color={profileColor} />
      </mesh>
    </group>
  );
}
