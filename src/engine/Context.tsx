import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { type PolygonBounds } from '../lib/geometry';
import { createGroundTexture } from './textures';
import { Street } from './Street';
import { Trees } from './Trees';
import { NeighborBuildings } from './NeighborBuildings';
import type { ContextConfig } from '../types';

/** No son unidades vendibles: fuera del raycasting para no interferir con el picking. */
const noRaycast = () => null;

interface ContextProps {
  footprint: PolygonBounds;
  context: ContextConfig;
}

/**
 * Entorno urbano genérico alrededor de la torre: piso con textura sutil, calle con
 * banquetas/guarnición/coches/árboles en `context.street.side`, y edificios vecinos de 3-8
 * niveles con ventanas por textura en el resto del perímetro. No conoce nada del cliente:
 * todo (huella, medidas, colores) llega por props/config.
 *
 * `memo`: no depende de nada que cambie por interacción de UI (selección, filtros, paneles
 * abiertos) — sin esto, React lo vuelve a reconciliar completo (piso + calle + coches +
 * árboles + vecinos) cada vez que algo AJENO a este componente hace que `Selector3D` se
 * vuelva a renderizar, con `footprint`/`context` iguales.
 */
function ContextComponent({ footprint, context }: ContextProps) {
  const centerX = (footprint.minX + footprint.maxX) / 2;
  const centerZ = (footprint.minZ + footprint.maxZ) / 2;
  const span = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ);
  const groundSize = span * context.ground.sizeFactor;

  const groundTexture = useMemo(
    () => createGroundTexture(context.ground.color, context.ground.noiseColor),
    [context.ground.color, context.ground.noiseColor],
  );
  const groundRepeat = Math.max(4, Math.round(groundSize / 6));
  groundTexture.repeat.set(groundRepeat, groundRepeat);

  // `envMapIntensity` bajo a propósito: por default (1) el piso recibe tanta luz ambiental
  // del `Environment` (el cielo entero como fuente de luz) que la sombra del sol — que solo
  // resta la contribución DIRECCIONAL, no la ambiental — se volvía casi imperceptible contra
  // un tono tan claro. Con menos ambiental, la sombra directa pesa más en el resultado final.
  const groundMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1, metalness: 0, envMapIntensity: 0.3 }),
    [groundTexture],
  );

  const treeBaseDistance = context.street.distanceFromTower + context.street.sidewalkWidth / 2;

  return (
    <group>
      <mesh
        position={[centerX, -0.02, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={groundMaterial}
        raycast={noRaycast}
        receiveShadow
      >
        <planeGeometry args={[groundSize, groundSize]} />
      </mesh>

      <Street footprint={footprint} street={context.street} />
      <Trees footprint={footprint} side={context.street.side} baseDistance={treeBaseDistance} tree={context.trees} />
      <NeighborBuildings footprint={footprint} streetSide={context.street.side} config={context.neighborBuildings} />
    </group>
  );
}

export const Context = memo(ContextComponent);
