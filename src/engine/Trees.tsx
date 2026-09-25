import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { sideAxisFrom, type PolygonBounds } from '../lib/geometry';
import type { FootprintSide, TreeConfig } from '../types';

/** Decorativos, no interactivos: fuera del raycasting. */
const noRaycast = () => null;

interface TreesProps {
  footprint: PolygonBounds;
  side: FootprintSide;
  /** Distancia (v) desde el pie de la torre hasta la franja de plantación, en metros. */
  baseDistance: number;
  tree: TreeConfig;
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

/** Puntos relativos (offset x/y/z, radio) de una copa hecha de unas pocas esferas
 *  superpuestas en vez de una sola: rompe la silueta perfectamente esférica de un icosaedro
 *  suelto, se lee más como follaje real. Misma técnica que las nubes del cielo
 *  (`CLOUD_PUFFS` en `views/Selector3D.tsx`). */
const CANOPY_PUFFS: [number, number, number, number][] = [
  [0, 0.05, 0, 1],
  [0.5, -0.05, 0.15, 0.65],
  [-0.45, 0, -0.2, 0.6],
];
/** Variación de tamaño determinista por árbol (no `Math.random`: mismo resultado entre
 *  renders) — se repite en ciclo, para que la hilera no se lea como el mismo árbol clonado
 *  una y otra vez. Escala tronco y copa juntos (un árbol más grande es más alto Y más
 *  frondoso, no solo más alto). */
const SIZE_VARIANTS = [0.85, 1, 1.15, 0.95, 1.05, 0.9];

/**
 * Árboles con tronco + copa de varias esferas, tamaño y tono de copa variados de forma
 * determinista por posición en la hilera (2 grupos de color, derivados del mismo
 * `tree.canopyColor` de la config — no un campo nuevo). 3 `InstancedMesh` (tronco, copa
 * grupo A, copa grupo B) sin importar cuántos árboles haya la calle.
 */
export function Trees({ footprint, side, baseDistance, tree }: TreesProps) {
  const span = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ);
  const streetLength = span * 5;
  const { toWorld } = useMemo(() => sideAxisFrom(footprint, side), [footprint, side]);
  const v = baseDistance + tree.setback;

  const positions = useMemo(() => {
    const count = Math.max(0, Math.floor(streetLength / tree.spacing) - 1);
    const points: [number, number][] = [];
    for (let index = 0; index < count; index += 1) {
      const u = -streetLength / 2 + tree.spacing * (index + 1);
      points.push(toWorld(u, v));
    }
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streetLength, tree.spacing, toWorld, v]);

  const trunkMatrices = useMemo(
    () =>
      positions.map(([x, z], index) => {
        const size = SIZE_VARIANTS[index % SIZE_VARIANTS.length];
        const position = new THREE.Vector3(x, (tree.trunkHeight * size) / 2, z);
        const scale = new THREE.Vector3(size, size, size);
        return new THREE.Matrix4().compose(position, new THREE.Quaternion(), scale);
      }),
    [positions, tree.trunkHeight],
  );

  // Copa: 2 grupos de color por paridad de índice, cada uno con sus 3 esferas por árbol.
  const { canopyA, canopyB } = useMemo(() => {
    const canopyA: THREE.Matrix4[] = [];
    const canopyB: THREE.Matrix4[] = [];
    positions.forEach(([x, z], index) => {
      const size = SIZE_VARIANTS[index % SIZE_VARIANTS.length];
      const trunkTop = tree.trunkHeight * size;
      const canopyScale = tree.canopyRadius * size;
      const target = index % 2 === 0 ? canopyA : canopyB;
      for (const [dx, dy, dz, puffRadius] of CANOPY_PUFFS) {
        const position = new THREE.Vector3(
          x + dx * canopyScale,
          trunkTop + tree.canopyRadius * 0.7 * size + dy * canopyScale,
          z + dz * canopyScale,
        );
        const puffScale = puffRadius * canopyScale;
        target.push(new THREE.Matrix4().compose(position, new THREE.Quaternion(), new THREE.Vector3(puffScale, puffScale, puffScale)));
      }
    });
    return { canopyA, canopyB };
  }, [positions, tree.trunkHeight, tree.canopyRadius]);

  const trunkGeometry = useMemo(
    () => new THREE.CylinderGeometry(tree.trunkRadius, tree.trunkRadius * 1.2, tree.trunkHeight, 6),
    [tree.trunkRadius, tree.trunkHeight],
  );
  const trunkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: tree.trunkColor, roughness: 0.9, metalness: 0 }),
    [tree.trunkColor],
  );
  // Geometría base en radio unitario: cada instancia la escala a su propio tamaño de copa
  // vía la matriz, así un solo `IcosahedronGeometry` sirve para las dos copas y sus 3 puffs.
  const canopyGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  // Tono B derivado del mismo color de la config (no un segundo campo): un poco más oscuro
  // y algo más saturado, la variación sutil que rompe el efecto "árbol clonado".
  const canopyMaterialA = useMemo(
    () => new THREE.MeshStandardMaterial({ color: tree.canopyColor, roughness: 0.85, metalness: 0 }),
    [tree.canopyColor],
  );
  const canopyMaterialB = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(tree.canopyColor).offsetHSL(0, 0.05, -0.08),
        roughness: 0.85,
        metalness: 0,
      }),
    [tree.canopyColor],
  );

  const trunkRef = useInstanceMatrices(trunkMatrices);
  const canopyRefA = useInstanceMatrices(canopyA);
  const canopyRefB = useInstanceMatrices(canopyB);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, trunkMaterial, trunkMatrices.length]} raycast={noRaycast} castShadow receiveShadow />
      <instancedMesh ref={canopyRefA} args={[canopyGeometry, canopyMaterialA, canopyA.length]} raycast={noRaycast} castShadow receiveShadow />
      <instancedMesh ref={canopyRefB} args={[canopyGeometry, canopyMaterialB, canopyB.length]} raycast={noRaycast} castShadow receiveShadow />
    </>
  );
}
