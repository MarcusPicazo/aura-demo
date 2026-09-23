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

/**
 * Árboles sencillos (tronco + copa, sin geometría pesada) repartidos en la banqueta, cada
 * `tree.spacing` metros. 2 `InstancedMesh` (troncos y copas) — sin importar cuántos árboles
 * haya, siguen siendo 2 llamadas de dibujo.
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
    () => positions.map(([x, z]) => new THREE.Matrix4().makeTranslation(x, tree.trunkHeight / 2, z)),
    [positions, tree.trunkHeight],
  );
  const canopyMatrices = useMemo(
    () => positions.map(([x, z]) => new THREE.Matrix4().makeTranslation(x, tree.trunkHeight + tree.canopyRadius * 0.7, z)),
    [positions, tree.trunkHeight, tree.canopyRadius],
  );

  const trunkGeometry = useMemo(
    () => new THREE.CylinderGeometry(tree.trunkRadius, tree.trunkRadius * 1.2, tree.trunkHeight, 6),
    [tree.trunkRadius, tree.trunkHeight],
  );
  const trunkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: tree.trunkColor, roughness: 0.9, metalness: 0 }),
    [tree.trunkColor],
  );
  const canopyGeometry = useMemo(() => new THREE.IcosahedronGeometry(tree.canopyRadius, 1), [tree.canopyRadius]);
  const canopyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: tree.canopyColor, roughness: 0.85, metalness: 0 }),
    [tree.canopyColor],
  );

  const trunkRef = useInstanceMatrices(trunkMatrices);
  const canopyRef = useInstanceMatrices(canopyMatrices);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, trunkMaterial, trunkMatrices.length]} raycast={noRaycast} castShadow receiveShadow />
      <instancedMesh ref={canopyRef} args={[canopyGeometry, canopyMaterial, canopyMatrices.length]} raycast={noRaycast} castShadow receiveShadow />
    </>
  );
}
