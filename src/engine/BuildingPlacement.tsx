import type { ReactNode } from 'react';

interface BuildingPlacementProps {
  /** Dónde queda el centro de la huella del edificio en el mundo: [x, z] en metros. */
  position: [number, number];
  /** Centro de la huella en las coordenadas locales de su planta: [x, z]. */
  pivot: [number, number];
  /** Giro alrededor de Y, en radianes (convención de three.js). */
  rotationY: number;
  children: ReactNode;
}

/**
 * Coloca un edificio dentro del conjunto: lleva el centro de su huella a `position` y lo gira
 * `rotationY` alrededor de ese centro. Los hijos se escriben en las coordenadas locales de su
 * propia planta (origen en la esquina del plano), igual que cuando era la única torre.
 */
export function BuildingPlacement({ position, pivot, rotationY, children }: BuildingPlacementProps) {
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotationY, 0]}>
      <group position={[-pivot[0], 0, -pivot[1]]}>{children}</group>
    </group>
  );
}
