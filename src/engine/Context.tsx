import { useMemo } from 'react';
import * as THREE from 'three';
import { buildContextBlocks, type PolygonBounds } from '../lib/geometry';

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

const blockMaterial = new THREE.MeshStandardMaterial({
  color: '#8a8a86',
  transparent: true,
  opacity: 0.45,
  roughness: 0.9,
  metalness: 0,
});

const groundMaterial = new THREE.MeshStandardMaterial({
  color: '#c9c4b8',
  roughness: 1,
  metalness: 0,
});

/** No son unidades vendibles: fuera del raycasting para no interferir con el picking. */
const noRaycast = () => null;

interface ContextProps {
  footprint: PolygonBounds;
  towerHeight: number;
}

/**
 * Contexto urbano genérico: plano de piso y edificios vecinos como bloques grises
 * semitransparentes, distribuidos alrededor de la huella de la torre. No conoce nada
 * del cliente: solo recibe la huella y la altura por props.
 */
export function Context({ footprint, towerHeight }: ContextProps) {
  const blocks = useMemo(() => buildContextBlocks(footprint, towerHeight), [footprint, towerHeight]);

  const centerX = (footprint.minX + footprint.maxX) / 2;
  const centerZ = (footprint.minZ + footprint.maxZ) / 2;
  const span = Math.max(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ);
  const groundSize = span * 6;

  return (
    <group>
      <mesh
        position={[centerX, -0.02, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={groundMaterial}
        raycast={noRaycast}
      >
        <planeGeometry args={[groundSize, groundSize]} />
      </mesh>

      {blocks.map((block, index) => (
        <mesh
          key={index}
          geometry={blockGeometry}
          material={blockMaterial}
          position={[block.x, block.height / 2, block.z]}
          scale={[block.width, block.height, block.depth]}
          raycast={noRaycast}
        />
      ))}
    </group>
  );
}
