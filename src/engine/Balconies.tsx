import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { computePolygonEdges, type TowerLayout } from '../lib/geometry';
import type { BalconyConfig, TowerGeometryConfig } from '../types';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** Decorativos, no vendibles: fuera del raycasting para no interferir con el picking de unidades. */
const noRaycast = () => null;

interface BalconiesProps {
  geometry: TowerGeometryConfig;
  layout: TowerLayout;
  balcony: BalconyConfig;
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

/** Matriz para una banda que sigue una arista, desplazada `outwardOffset` m hacia afuera de la línea de vidrio, a altura `y`. */
function edgeBandMatrix(
  edge: { midpoint: [number, number]; length: number; rotationY: number; outward: [number, number] },
  outwardOffset: number,
  y: number,
): THREE.Matrix4 {
  const [ox, oz] = edge.outward;
  const position = new THREE.Vector3(edge.midpoint[0] + ox * outwardOffset, y, edge.midpoint[1] + oz * outwardOffset);
  const quaternion = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, edge.rotationY);
  const scale = new THREE.Vector3(edge.length, 1, 1);
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

/**
 * Balcones: canto de losa (blanco, grueso), barandal de vidrio con pasamanos metálico
 * delgado, y plafón de madera bajo el voladizo — uno por cada arista de vidrio, en cada
 * nivel con unidades (no en planta baja). 4 `InstancedMesh` (uno por elemento), sin
 * importar cuántas unidades/niveles tenga la torre. Genérico: posiciones de `geometry`,
 * medidas/colores de `balcony` (config del cliente).
 */
export function Balconies({ geometry, layout, balcony }: BalconiesProps) {
  const { slabEdge, railing, handrail, soffit } = useMemo(() => {
    const slabEdgeMatrices: THREE.Matrix4[] = [];
    const railingMatrices: THREE.Matrix4[] = [];
    const handrailMatrices: THREE.Matrix4[] = [];
    const soffitMatrices: THREE.Matrix4[] = [];

    const railingBaseY = balcony.slabEdgeHeight / 2;
    const handrailBaseY = balcony.slabEdgeHeight / 2 + balcony.railingHeight;
    const soffitOffsetY = -(balcony.slabEdgeHeight / 2 + balcony.soffitThickness / 2);

    for (const level of layout.levels) {
      const units = level.isPenthouse ? geometry.penthousePlate : geometry.plate;

      for (const unit of units) {
        for (const edge of computePolygonEdges(unit.polygon)) {
          slabEdgeMatrices.push(edgeBandMatrix(edge, balcony.depth / 2, level.y));
          railingMatrices.push(
            edgeBandMatrix(edge, balcony.depth - balcony.railingThickness / 2, level.y + railingBaseY + balcony.railingHeight / 2),
          );
          handrailMatrices.push(
            edgeBandMatrix(edge, balcony.depth - balcony.railingThickness / 2, level.y + handrailBaseY + balcony.handrailHeight / 2),
          );
          soffitMatrices.push(edgeBandMatrix(edge, balcony.depth / 2, level.y + soffitOffsetY));
        }
      }
    }

    return { slabEdge: slabEdgeMatrices, railing: railingMatrices, handrail: handrailMatrices, soffit: soffitMatrices };
  }, [geometry, layout, balcony]);

  const slabEdgeGeometry = useMemo(
    () => new THREE.BoxGeometry(1, balcony.slabEdgeHeight, balcony.depth),
    [balcony.slabEdgeHeight, balcony.depth],
  );
  const railingGeometry = useMemo(
    () => new THREE.BoxGeometry(1, balcony.railingHeight, balcony.railingThickness),
    [balcony.railingHeight, balcony.railingThickness],
  );
  const handrailGeometry = useMemo(
    () => new THREE.BoxGeometry(1, balcony.handrailHeight, balcony.railingThickness * 1.6),
    [balcony.handrailHeight, balcony.railingThickness],
  );
  const soffitGeometry = useMemo(
    () => new THREE.BoxGeometry(1, balcony.soffitThickness, balcony.depth),
    [balcony.soffitThickness, balcony.depth],
  );

  const slabEdgeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: balcony.slabEdgeColor, roughness: 0.6, metalness: 0.05 }),
    [balcony.slabEdgeColor],
  );
  const railingMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: balcony.railingColor,
        transparent: true,
        opacity: 0.35,
        roughness: 0.05,
        metalness: 0,
        clearcoat: 0.6,
        side: THREE.DoubleSide,
      }),
    [balcony.railingColor],
  );
  const handrailMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: balcony.handrailColor, roughness: 0.35, metalness: 0.7 }),
    [balcony.handrailColor],
  );
  const soffitMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: balcony.soffitColor, roughness: 0.7, metalness: 0 }),
    [balcony.soffitColor],
  );

  const slabEdgeRef = useInstanceMatrices(slabEdge);
  const railingRef = useInstanceMatrices(railing);
  const handrailRef = useInstanceMatrices(handrail);
  const soffitRef = useInstanceMatrices(soffit);

  return (
    <>
      <instancedMesh
        ref={slabEdgeRef}
        args={[slabEdgeGeometry, slabEdgeMaterial, slabEdge.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
      <instancedMesh ref={railingRef} args={[railingGeometry, railingMaterial, railing.length]} raycast={noRaycast} receiveShadow />
      <instancedMesh
        ref={handrailRef}
        args={[handrailGeometry, handrailMaterial, handrail.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={soffitRef}
        args={[soffitGeometry, soffitMaterial, soffit.length]}
        raycast={noRaycast}
        castShadow
        receiveShadow
      />
    </>
  );
}
