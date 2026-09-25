import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { buildNeighborBuildings, type NeighborBuilding, type PolygonBounds } from '../lib/geometry';
import { createWindowGridTexture } from './textures';
import type { NeighborBuildingsConfig } from '../types';

/** Referencia (no vendible, no interactivo): fuera del raycasting. */
const noRaycast = () => null;

interface NeighborBuildingsProps {
  footprint: PolygonBounds;
  streetSide: 'minX' | 'maxX' | 'minZ' | 'maxZ';
  config: NeighborBuildingsConfig;
}

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

interface ToneGroupProps {
  buildings: NeighborBuilding[];
  /** Tono de fachada de este grupo — se hornea como color de muro de SU PROPIA textura
   * (no se multiplica por `material.color`, que se queda blanco: dos oscurecidos en
   * cadena — textura ya oscura × color ya oscuro — se ven negros, no solo "más oscuros"). */
  wallColor: string;
  windowColor: string;
  repeat: [number, number];
}

/** Un `InstancedMesh` por tono de la paleta, cada uno con su propia textura de ventanas. */
function ToneGroup({ buildings, wallColor, windowColor, repeat }: ToneGroupProps) {
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const texture = useMemo(() => {
    const tex = createWindowGridTexture(wallColor, windowColor);
    tex.repeat.set(repeat[0], repeat[1]);
    return tex;
  }, [wallColor, windowColor, repeat]);
  // `roughness` alto y `envMapIntensity` bajo a propósito: sin esto, el environment map
  // (agregado para los reflejos del vidrio de la torre) también le pone brillo a estas
  // fachadas de fondo, compitiendo con la torre. Los vecinos deben leerse apagados, tipo
  // maqueta — los materiales ricos son exclusivos de la torre.
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, roughness: 0.97, metalness: 0, envMapIntensity: 0.12 }),
    [texture],
  );
  const matrices = useMemo(
    () =>
      buildings.map(
        (building) =>
          new THREE.Matrix4().compose(
            new THREE.Vector3(building.x, building.height / 2, building.z),
            new THREE.Quaternion(),
            new THREE.Vector3(building.width, building.height, building.depth),
          ),
      ),
    [buildings],
  );
  const ref = useInstanceMatrices(matrices);

  if (buildings.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} raycast={noRaycast} castShadow receiveShadow />;
}

/** Mancha oscura y plana en la base de cada vecino (oclusión ambiental falsa, misma idea
 *  que `<ContactShadows>` de la torre pero sin el costo de una pasada de render aparte —
 *  aquí basta un plano semitransparente por edificio, todos en un solo `InstancedMesh`):
 *  sin esto, los vecinos se veían flotando sobre el piso en vez de asentados en él. */
function BuildingOcclusion({ buildings, opacity, margin }: { buildings: NeighborBuilding[]; opacity: number; margin: number }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity, depthWrite: false }),
    [opacity],
  );
  const rotation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), []);
  const matrices = useMemo(
    () =>
      buildings.map(
        (building) =>
          new THREE.Matrix4().compose(
            // Un poco por encima del piso (`Context.tsx` lo pone en y=-0.02): si quedara a
            // la misma altura, el z-fighting la haría parpadear en vez de verse sólida.
            new THREE.Vector3(building.x, 0.015, building.z),
            rotation,
            new THREE.Vector3(building.width * (1 + margin), building.depth * (1 + margin), 1),
          ),
      ),
    [buildings, rotation, margin],
  );
  const ref = useInstanceMatrices(matrices);

  if (buildings.length === 0 || opacity <= 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} raycast={noRaycast} />;
}

/**
 * Edificios vecinos: antes, cajas grises semitransparentes en posiciones fijas. Ahora son
 * masas opacas de 3-8 niveles con tono variado y cuadrícula de ventanas por textura,
 * repartidas de forma determinista en un anillo que evita el lado de la calle, a una
 * distancia mínima garantizada del pie de la torre, con una mancha de oclusión en su base
 * para que se asienten en el piso. Un `InstancedMesh` por tono de la paleta (no uno por
 * edificio): sigue siendo un puñado de llamadas de dibujo sin importar cuántos vecinos haya.
 */
export function NeighborBuildings({ footprint, streetSide, config }: NeighborBuildingsProps) {
  const buildings = useMemo(
    () =>
      buildNeighborBuildings(footprint, {
        count: config.count,
        minLevels: config.minLevels,
        maxLevels: config.maxLevels,
        levelHeight: config.levelHeight,
        minWidth: config.minWidth,
        maxWidth: config.maxWidth,
        minClearance: config.minClearance,
        toneCount: config.tones.length,
        streetSide,
      }),
    [footprint, streetSide, config],
  );

  // Repeat calibrado para un edificio "típico" (promedio de min/max niveles y ancho de
  // config) — cada vecino mide distinto, así que no es exacto piso por piso en todos, pero
  // a la distancia a la que se ven no se nota (ver textures.ts).
  const repeat: [number, number] = useMemo(() => {
    const typicalWidth = (config.minWidth + config.maxWidth) / 2;
    const typicalLevels = (config.minLevels + config.maxLevels) / 2;
    return [Math.max(2, Math.round(typicalWidth / 1.6)), Math.max(2, Math.round(typicalLevels * 1.4))];
  }, [config.minWidth, config.maxWidth, config.minLevels, config.maxLevels]);

  const groups = useMemo(() => {
    const byTone = new Map<number, NeighborBuilding[]>();
    for (const building of buildings) {
      const list = byTone.get(building.toneIndex) ?? [];
      list.push(building);
      byTone.set(building.toneIndex, list);
    }
    return Array.from(byTone.entries());
  }, [buildings]);

  return (
    <>
      <BuildingOcclusion buildings={buildings} opacity={config.baseOcclusionOpacity} margin={config.baseOcclusionMargin} />
      {groups.map(([toneIndex, group]) => (
        <ToneGroup
          key={toneIndex}
          buildings={group}
          wallColor={config.tones[toneIndex]}
          windowColor={config.windowColor}
          repeat={repeat}
        />
      ))}
    </>
  );
}
