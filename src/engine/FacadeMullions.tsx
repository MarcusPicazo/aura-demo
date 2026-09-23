import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { computeMullionPointsWithNormal, computePolygonEdges, type TowerLayout } from '../lib/geometry';
import type { CarpentryConfig, TowerGeometryConfig } from '../types';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** Decorativos, no vendibles: fuera del raycasting para no interferir con el picking de unidades. */
const noRaycast = () => null;

interface FacadeMullionsProps {
  geometry: TowerGeometryConfig;
  layout: TowerLayout;
  carpentry: CarpentryConfig;
}

/**
 * Escribe las matrices en el buffer del InstancedMesh una sola vez (o cuando cambian) y pide
 * un frame: con `frameloop="demand"`, escribir el buffer fuera del reconciler de R3F no
 * invalida la escena por sí solo.
 */
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
 * Carpintería de fachada (canceles): un perfil vertical cada `carpentry.spacing` metros a lo
 * largo del perímetro de vidrio de cada unidad, más un perfil horizontal arriba y abajo de
 * cada nivel. Los verticales van en un solo `InstancedMesh` y los horizontales en otro — sin
 * importar cuántas unidades/niveles tenga la torre, siguen siendo 2 llamadas de dibujo.
 * Genérico: ni las posiciones (vienen de `geometry`) ni los materiales (vienen de
 * `carpentry`) son datos de cliente adentro de este archivo.
 */
export function FacadeMullions({ geometry, layout, carpentry }: FacadeMullionsProps) {
  // Los perfiles se desplazan `depth/2` hacia afuera de la línea de vidrio: así su cara
  // interior queda a esa distancia del vidrio (el "hueco") y su cara exterior, a `depth`
  // completo — la profundidad real que hace que el sol proyecte una sombra dura hacia
  // adentro en vez de una tira plana pintada sobre el vidrio.
  const { verticalMatrices, horizontalMatrices } = useMemo(() => {
    const verticals: THREE.Matrix4[] = [];
    const horizontals: THREE.Matrix4[] = [];
    const halfFloorHeight = geometry.floorHeight / 2;
    const halfDepth = carpentry.depth / 2;

    for (const level of layout.levels) {
      const units = level.isPenthouse ? geometry.penthousePlate : geometry.plate;

      for (const unit of units) {
        for (const { position, outward } of computeMullionPointsWithNormal(unit.polygon, carpentry.spacing)) {
          const x = position[0] + outward[0] * halfDepth;
          const z = position[1] + outward[1] * halfDepth;
          verticals.push(new THREE.Matrix4().makeTranslation(x, level.y + halfFloorHeight, z));
        }

        for (const edge of computePolygonEdges(unit.polygon)) {
          const midX = edge.midpoint[0] + edge.outward[0] * halfDepth;
          const midZ = edge.midpoint[1] + edge.outward[1] * halfDepth;
          const quaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, edge.rotationY);
          const scale = new THREE.Vector3(edge.length, 1, 1);
          for (const y of [level.y, level.y + geometry.floorHeight]) {
            horizontals.push(new THREE.Matrix4().compose(new THREE.Vector3(midX, y, midZ), quaternion, scale));
          }
        }
      }
    }

    return { verticalMatrices: verticals, horizontalMatrices: horizontals };
  }, [geometry, layout, carpentry.spacing, carpentry.depth]);

  const verticalGeometry = useMemo(
    () => new THREE.BoxGeometry(carpentry.thickness, geometry.floorHeight, carpentry.depth),
    [carpentry.thickness, carpentry.depth, geometry.floorHeight],
  );
  // Largo unitario (1) en X: cada instancia lo estira a su arista real vía la escala de su matriz.
  const horizontalGeometry = useMemo(
    () => new THREE.BoxGeometry(1, carpentry.thickness, carpentry.depth),
    [carpentry.thickness, carpentry.depth],
  );
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: carpentry.color, roughness: 0.5, metalness: 0.3 }),
    [carpentry.color],
  );

  const verticalRef = useInstanceMatrices(verticalMatrices);
  const horizontalRef = useInstanceMatrices(horizontalMatrices);

  return (
    <>
      <instancedMesh
        ref={verticalRef}
        args={[verticalGeometry, material, verticalMatrices.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={horizontalRef}
        args={[horizontalGeometry, material, horizontalMatrices.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
    </>
  );
}
