import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import {
  computeMullionPoints,
  computeMullionPointsWithNormal,
  computePolygonEdges,
  type PolygonBounds,
} from '../lib/geometry';
import type { LobbyConfig } from '../types';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

  const perimeter: [number, number][] = useMemo(
    () => [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ],
    [minX, maxX, minZ, maxZ],
  );

  // Columnas: un punto cada `columnSpacing` m a lo largo del rectángulo de la huella —
  // se reutiliza la misma subdivisión de perímetro que la carpintería de fachada.
  const columnMatrices = useMemo(
    () =>
      computeMullionPoints(perimeter, lobby.columnSpacing).map(
        ([x, z]) => new THREE.Matrix4().makeTranslation(x, groundFloorHeight / 2, z),
      ),
    [perimeter, lobby.columnSpacing, groundFloorHeight],
  );

  const columnGeometry = useMemo(
    () => new THREE.CylinderGeometry(lobby.columnRadius, lobby.columnRadius, groundFloorHeight, 12),
    [lobby.columnRadius, groundFloorHeight],
  );
  const columnMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: lobby.columnColor, roughness: 0.4, metalness: 0.3 }),
    [lobby.columnColor],
  );
  const columnRef = useInstanceMatrices(columnMatrices);

  // Paños de vidrio con marco visible: montantes verticales cada `mullionSpacing` m a lo
  // largo del perímetro (escala de vitrina, no la de la carpintería de los niveles de
  // arriba), más un marco horizontal arriba y abajo del vidrio — mismo criterio que
  // `FacadeMullions`, para que el lobby se lea como vidrio armado en paños y no como un
  // bloque de vidrio liso.
  const halfMullionDepth = lobby.mullionDepth / 2;
  const glassMullionMatrices = useMemo(
    () =>
      computeMullionPointsWithNormal(perimeter, lobby.mullionSpacing).map(({ position, outward }) => {
        const x = position[0] + outward[0] * halfMullionDepth;
        const z = position[1] + outward[1] * halfMullionDepth;
        return new THREE.Matrix4().makeTranslation(x, groundFloorHeight / 2, z);
      }),
    [perimeter, lobby.mullionSpacing, halfMullionDepth, groundFloorHeight],
  );
  const glassFrameMatrices = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    for (const edge of computePolygonEdges(perimeter)) {
      const midX = edge.midpoint[0] + edge.outward[0] * halfMullionDepth;
      const midZ = edge.midpoint[1] + edge.outward[1] * halfMullionDepth;
      const quaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, edge.rotationY);
      const scale = new THREE.Vector3(edge.length, 1, 1);
      for (const y of [0, groundFloorHeight]) {
        matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(midX, y, midZ), quaternion, scale));
      }
    }
    return matrices;
  }, [perimeter, halfMullionDepth, groundFloorHeight]);

  const glassMullionGeometry = useMemo(
    () => new THREE.BoxGeometry(lobby.mullionThickness, groundFloorHeight, lobby.mullionDepth),
    [lobby.mullionThickness, groundFloorHeight, lobby.mullionDepth],
  );
  // Largo unitario (1) en X: cada instancia lo estira a su arista real vía la escala de su matriz.
  const glassFrameGeometry = useMemo(
    () => new THREE.BoxGeometry(1, lobby.mullionThickness, lobby.mullionDepth),
    [lobby.mullionThickness, lobby.mullionDepth],
  );
  const glassMullionMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: profileColor, roughness: 0.5, metalness: 0.3 }),
    [profileColor],
  );
  const glassMullionRef = useInstanceMatrices(glassMullionMatrices);
  const glassFrameRef = useInstanceMatrices(glassFrameMatrices);

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

      <instancedMesh
        ref={glassMullionRef}
        args={[glassMullionGeometry, glassMullionMaterial, glassMullionMatrices.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={glassFrameRef}
        args={[glassFrameGeometry, glassMullionMaterial, glassFrameMatrices.length]}
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
