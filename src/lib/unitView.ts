import { azimuthOfVector } from './solar';
import { horizontalHitDistance, viewFreeDistance, type Occluder, type UnitSunProbe } from './sunExposure';
import type { UnitViewConfig } from '../types';

/** Una vista de 40 m o más hacia afuera cuenta como vista abierta; menos se descuenta (un muro a 2 m no es "vista"). */
const OPEN_VIEW_DISTANCE = 40;
/** Hasta dónde se busca qué hay enfrente de un muro. */
const MAX_VIEW_DISTANCE = 200;
/** Si los muros se anulan entre sí (dos fachadas opuestas igual de abiertas), se mira por el más abierto en vez de al promedio, que sería el interior. */
const CANCELLATION_RATIO = 0.35;
/** A qué distancia delante de los ojos queda el punto al que mira la cámara. */
const LOOK_AHEAD = 10;

export interface UnitViewPose {
  /** Ojos y punto de mira en el mundo. */
  position: [number, number, number];
  target: [number, number, number];
  /** Hacia dónde mira, como rumbo (grados desde el norte, horario) y como giro de cámara (radianes, convención de three.js). */
  headingDeg: number;
  yaw: number;
}

/**
 * Dónde poner la cámara para ver desde una unidad: a la altura de los ojos de su piso, dentro de la unidad pegada
 * a su fachada, mirando hacia afuera. "Hacia afuera" es el promedio de las normales de sus muros exteriores
 * ponderado por su largo y por cuánta vista abierta tienen (un muro que da a otro edificio a 2 m pesa poco), así que una
 * unidad de esquina mira a la diagonal y una con dos fachadas opuestas mira por la más abierta. Funciona con
 * cualquier planta: usa el contorno real de la unidad.
 */
export function computeUnitViewPose(
  probe: UnitSunProbe,
  occluders: Occluder[],
  config: Pick<UnitViewConfig, 'eyeHeight' | 'wallInset'>,
  northAngleDeg: number,
): UnitViewPose | null {
  if (probe.walls.length === 0) return null;
  const eyeY = probe.floorY + config.eyeHeight;

  let sumX = 0;
  let sumZ = 0;
  let total = 0;
  let best = probe.walls[0];
  let bestWeight = -1;
  for (const wall of probe.walls) {
    const midX = wall.points.reduce((sum, [x]) => sum + x, 0) / wall.points.length;
    const midZ = wall.points.reduce((sum, [, z]) => sum + z, 0) / wall.points.length;
    const free = viewFreeDistance(midX + wall.normal[0] * 0.05, eyeY, midZ + wall.normal[1] * 0.05, wall.normal[0], wall.normal[1], occluders, MAX_VIEW_DISTANCE);
    const weight = wall.length * Math.min(1, free / OPEN_VIEW_DISTANCE);
    sumX += wall.normal[0] * weight;
    sumZ += wall.normal[1] * weight;
    total += weight;
    if (weight > bestWeight) {
      bestWeight = weight;
      best = wall;
    }
  }

  let headingX = best.normal[0];
  let headingZ = best.normal[1];
  const sumLength = Math.hypot(sumX, sumZ);
  if (total > 1e-6 && sumLength >= CANCELLATION_RATIO * total) {
    headingX = sumX / sumLength;
    headingZ = sumZ / sumLength;
  }

  // Desde el punto más "adentro" de la unidad se avanza hacia su fachada hasta quedar a `wallInset` del vidrio.
  const [centerX, centerZ] = probe.center;
  const exit = horizontalHitDistance(centerX, centerZ, headingX, headingZ, probe.polygon) ?? 0;
  const advance = Math.max(0, exit - config.wallInset);
  const x = centerX + headingX * advance;
  const z = centerZ + headingZ * advance;

  return {
    position: [x, eyeY, z],
    target: [x + headingX * LOOK_AHEAD, eyeY, z + headingZ * LOOK_AHEAD],
    headingDeg: azimuthOfVector(headingX, headingZ, northAngleDeg),
    yaw: Math.atan2(-headingX, -headingZ),
  };
}
