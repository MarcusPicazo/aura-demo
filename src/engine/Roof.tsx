import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { computePolygonEdges, type PolygonBounds } from '../lib/geometry';
import type { RoofConfig } from '../types';

/** Decorativo, no vendible: fuera del raycasting para no interferir con el picking de unidades. */
const noRaycast = () => null;

interface RoofProps {
  footprint: PolygonBounds;
  roofY: number;
  roof: RoofConfig;
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
 * Azotea: pretil perimetral (remata la torre, para que no se vea cortada), pérgola de
 * madera sobre el centro de la losa, y un volumen de instalaciones en una esquina.
 * Genérico: la huella/altura vienen de `layout`, medidas y colores de `roof` (config).
 */
export function Roof({ footprint, roofY, roof }: RoofProps) {
  const { minX, maxX, minZ, maxZ } = footprint;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  // Pretil: 4 tramos (un box por arista del rectángulo de la huella), no hace falta InstancedMesh.
  const parapetEdges = useMemo(
    () =>
      computePolygonEdges([
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ]),
    [minX, maxX, minZ, maxZ],
  );
  const parapetGeometry = useMemo(
    () => new THREE.BoxGeometry(1, roof.parapetHeight, roof.parapetThickness),
    [roof.parapetHeight, roof.parapetThickness],
  );
  const parapetMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: roof.parapetColor, roughness: 0.7, metalness: 0.05 }),
    [roof.parapetColor],
  );

  // Pérgola: vigas paralelas al eje X, repartidas a lo largo de Z, centradas y acotadas a `pergolaCoverage`.
  const coveredWidth = width * roof.pergolaCoverage;
  const coveredDepth = depth * roof.pergolaCoverage;
  const beamY = roofY + roof.pergolaHeight;
  const beamMatrices = useMemo(() => {
    const count = Math.max(2, Math.round(coveredDepth / roof.pergolaBeamSpacing) + 1);
    const matrices: THREE.Matrix4[] = [];
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 0.5 : index / (count - 1);
      const z = centerZ - coveredDepth / 2 + coveredDepth * t;
      matrices.push(new THREE.Matrix4().makeTranslation(centerX, beamY, z));
    }
    return matrices;
  }, [coveredDepth, roof.pergolaBeamSpacing, centerX, centerZ, beamY]);
  const beamGeometry = useMemo(
    () => new THREE.BoxGeometry(coveredWidth, roof.pergolaBeamThickness, roof.pergolaBeamThickness),
    [coveredWidth, roof.pergolaBeamThickness],
  );
  const pergolaMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: roof.pergolaColor, roughness: 0.75, metalness: 0 }),
    [roof.pergolaColor],
  );
  const beamRef = useInstanceMatrices(beamMatrices);

  // Postes de esquina: sostienen la pérgola visualmente, misma madera.
  const postHeight = roof.pergolaHeight;
  const postGeometry = useMemo(
    () => new THREE.CylinderGeometry(roof.pergolaBeamThickness * 0.8, roof.pergolaBeamThickness * 0.8, postHeight, 8),
    [roof.pergolaBeamThickness, postHeight],
  );
  const postCorners: [number, number][] = [
    [centerX - coveredWidth / 2, centerZ - coveredDepth / 2],
    [centerX + coveredWidth / 2, centerZ - coveredDepth / 2],
    [centerX - coveredWidth / 2, centerZ + coveredDepth / 2],
    [centerX + coveredWidth / 2, centerZ + coveredDepth / 2],
  ];

  // Volumen de instalaciones: en una esquina de la azotea, fuera del área de la pérgola.
  const [equipWidth, equipHeight, equipDepth] = roof.equipmentSize;
  const equipmentGeometry = useMemo(
    () => new THREE.BoxGeometry(equipWidth, equipHeight, equipDepth),
    [equipWidth, equipHeight, equipDepth],
  );
  const equipmentMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: roof.equipmentColor, roughness: 0.8, metalness: 0.1 }),
    [roof.equipmentColor],
  );
  const equipmentPosition: [number, number, number] = [
    minX + equipWidth / 2 + roof.parapetThickness,
    roofY + equipHeight / 2,
    minZ + equipDepth / 2 + roof.parapetThickness,
  ];

  return (
    <group>
      {parapetEdges.map((edge, index) => (
        <mesh
          key={index}
          geometry={parapetGeometry}
          material={parapetMaterial}
          position={[edge.midpoint[0], roofY + roof.parapetHeight / 2, edge.midpoint[1]]}
          rotation={[0, edge.rotationY, 0]}
          scale={[edge.length, 1, 1]}
          raycast={noRaycast}
          castShadow
          receiveShadow
        />
      ))}

      <instancedMesh ref={beamRef} args={[beamGeometry, pergolaMaterial, beamMatrices.length]} raycast={noRaycast} castShadow receiveShadow />

      {postCorners.map(([x, z], index) => (
        <mesh
          key={index}
          geometry={postGeometry}
          material={pergolaMaterial}
          position={[x, roofY + postHeight / 2, z]}
          raycast={noRaycast}
          castShadow
          receiveShadow
        />
      ))}

      <mesh
        geometry={equipmentGeometry}
        material={equipmentMaterial}
        position={equipmentPosition}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
    </group>
  );
}
