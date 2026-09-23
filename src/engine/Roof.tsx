import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { computeMullionPointsWithNormal, computePolygonEdges, type PolygonBounds } from '../lib/geometry';
import { createConcreteTexture } from './textures';
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
  const parapetTexture = useMemo(() => createConcreteTexture(roof.parapetColor), [roof.parapetColor]);
  const parapetMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: parapetTexture, roughness: 0.7, metalness: 0.05 }),
    [parapetTexture],
  );
  // Mismo criterio que las losas: ~1.2 m por tile, usando el largo promedio de un tramo
  // de pretil (los 4 comparten una sola textura, no hay un `repeat` exacto por tramo).
  const parapetPerimeter = parapetEdges.reduce((sum, edge) => sum + edge.length, 0);
  const parapetAvgEdge = parapetEdges.length > 0 ? parapetPerimeter / parapetEdges.length : 1;
  parapetTexture.repeat.set(Math.max(2, Math.round(parapetAvgEdge / 1.2)), 1);

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

  // Jardineras a lo largo del pretil, hacia adentro `vegetationSetback` m: reutiliza el
  // mismo reparto por perímetro que la carpintería de fachada (`computeMullionPoints...`),
  // solo que aquí sobre el rectángulo de la huella en vez del polígono de una unidad.
  // Se saltan los puntos que caerían sobre el volumen de instalaciones, para no encimarse.
  const vegetationPositions = useMemo(() => {
    const equipMinX = minX + roof.parapetThickness;
    const equipMaxX = equipMinX + equipWidth;
    const equipMinZ = minZ + roof.parapetThickness;
    const equipMaxZ = equipMinZ + equipDepth;
    const points: [number, number][] = [];
    for (const { position, outward } of computeMullionPointsWithNormal(
      [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ],
      roof.vegetationSpacing,
    )) {
      const x = position[0] - outward[0] * roof.vegetationSetback;
      const z = position[1] - outward[1] * roof.vegetationSetback;
      const inEquipmentZone = x > equipMinX - 0.4 && x < equipMaxX + 0.4 && z > equipMinZ - 0.4 && z < equipMaxZ + 0.4;
      if (!inEquipmentZone) points.push([x, z]);
    }
    return points;
  }, [minX, maxX, minZ, maxZ, roof.vegetationSpacing, roof.vegetationSetback, roof.parapetThickness, equipWidth, equipDepth]);

  const vegetationPotMatrices = useMemo(
    () => vegetationPositions.map(([x, z]) => new THREE.Matrix4().makeTranslation(x, roofY + roof.vegetationPotHeight / 2, z)),
    [vegetationPositions, roofY, roof.vegetationPotHeight],
  );
  const vegetationFoliageMatrices = useMemo(
    () =>
      vegetationPositions.map(
        ([x, z]) => new THREE.Matrix4().makeTranslation(x, roofY + roof.vegetationPotHeight + roof.vegetationFoliageRadius * 0.7, z),
      ),
    [vegetationPositions, roofY, roof.vegetationPotHeight, roof.vegetationFoliageRadius],
  );
  const vegetationPotGeometry = useMemo(
    () => new THREE.CylinderGeometry(roof.vegetationPotRadius * 0.8, roof.vegetationPotRadius, roof.vegetationPotHeight, 8),
    [roof.vegetationPotRadius, roof.vegetationPotHeight],
  );
  // Icosaedro de bajo detalle, igual que la copa de los árboles de la calle (Trees.tsx).
  const vegetationFoliageGeometry = useMemo(
    () => new THREE.IcosahedronGeometry(roof.vegetationFoliageRadius, 1),
    [roof.vegetationFoliageRadius],
  );
  const vegetationPotMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: roof.vegetationPotColor, roughness: 0.8, metalness: 0 }),
    [roof.vegetationPotColor],
  );
  const vegetationFoliageMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: roof.vegetationFoliageColor, roughness: 0.85, metalness: 0 }),
    [roof.vegetationFoliageColor],
  );
  const vegetationPotRef = useInstanceMatrices(vegetationPotMatrices);
  const vegetationFoliageRef = useInstanceMatrices(vegetationFoliageMatrices);

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

      <instancedMesh
        ref={vegetationPotRef}
        args={[vegetationPotGeometry, vegetationPotMaterial, vegetationPotMatrices.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={vegetationFoliageRef}
        args={[vegetationFoliageGeometry, vegetationFoliageMaterial, vegetationFoliageMatrices.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
    </group>
  );
}
