import { memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { CameraCollisionBounds } from '../lib/geometry';

interface CameraCollisionProps {
  bounds: CameraCollisionBounds;
  target: [number, number, number];
  /** Qué tan rápido se amortigua la corrección hacia la superficie segura — 1/segundos:
   *  más alto pega más rápido a la superficie, más bajo se siente más "cojín". */
  dampingSpeed?: number;
}

/**
 * Caja de colisión alrededor del edificio: si la cámara queda DENTRO de `bounds` (el
 * `minDistance` esférico de `OrbitControls` es un límite parejo en todas direcciones, pero
 * la torre no es una esfera — en la diagonal hacia una esquina, o mirando hacia arriba
 * contra la azotea, un radio "seguro" en la dirección más corta deja pasar la cámara en
 * las demás), la empuja de vuelta a la superficie a lo largo del rayo target→cámara. No de
 * golpe: amortiguado cuadro a cuadro (lerp exponencial, independiente del framerate) para
 * que se sienta como un tope elástico, no un corte seco.
 *
 * Genérico: `bounds`/`target` llegan ya calculados desde la geometría real de la torre
 * (`computeCameraLimits`, en `lib/geometry.ts`) y el margen de la config del cliente — este
 * componente no sabe nada de balcones, azoteas, ni de ningún cliente en particular.
 */
function CameraCollisionComponent({ bounds, target, dampingSpeed = 8 }: CameraCollisionProps) {
  const { camera, invalidate } = useThree();
  const targetVec = useMemo(() => new THREE.Vector3(), []);
  targetVec.set(target[0], target[1], target[2]);
  const offset = useRef(new THREE.Vector3());
  const safePosition = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    offset.current.copy(camera.position).sub(targetVec);

    // El `target` (centro de la torre) cae DENTRO del volumen por construcción, así que
    // este es un rayo saliendo desde adentro: el `t` más chico de los tres ejes es la
    // primera cara de la caja que cruza — el método estándar de "slabs" de raytracing,
    // aplicado a la cara de salida en vez de a la de entrada.
    let exitT = Infinity;
    if (offset.current.lengthSq() < 1e-6) {
      // Cámara prácticamente encima del target (no debería pasar en uso normal, pero sin
      // dirección no hay por dónde empujarla): usa +Z como salida arbitraria.
      offset.current.set(0, 0, 1);
    }
    if (offset.current.x > 0) exitT = Math.min(exitT, (bounds.maxX - targetVec.x) / offset.current.x);
    else if (offset.current.x < 0) exitT = Math.min(exitT, (bounds.minX - targetVec.x) / offset.current.x);
    if (offset.current.y > 0) exitT = Math.min(exitT, (bounds.maxY - targetVec.y) / offset.current.y);
    else if (offset.current.y < 0) exitT = Math.min(exitT, (bounds.minY - targetVec.y) / offset.current.y);
    if (offset.current.z > 0) exitT = Math.min(exitT, (bounds.maxZ - targetVec.z) / offset.current.z);
    else if (offset.current.z < 0) exitT = Math.min(exitT, (bounds.minZ - targetVec.z) / offset.current.z);

    // La posición de la cámara es exactamente `target + offset·1` (offset ya es
    // `camera.position - target`), así que "adentro de la caja" es "la cara de salida
    // queda MÁS LEJOS que la cámara": `exitT > 1`. `exitT <= 1` es afuera (la cámara ya
    // pasó esa cara o está justo en ella) — nada que corregir.
    if (!Number.isFinite(exitT) || exitT <= 1) return;

    safePosition.current.copy(targetVec).addScaledVector(offset.current, exitT);

    // Sin este piso, el lerp exponencial nunca llega EXACTO a `safePosition` (se acerca para
    // siempre, cada vez más despacio) y `invalidate()` seguiría pidiendo cuadros por
    // siempre bajo `frameloop="demand"` aunque el usuario ya haya soltado el gesto. A menos
    // de 1cm, se resuelve directo: ese último cuadro deja `exitT≈1` la próxima vez que algo
    // sí dispare un render, así que no hace falta seguir invalidando después de este.
    if (camera.position.distanceTo(safePosition.current) < 0.01) {
      camera.position.copy(safePosition.current);
    } else {
      const easing = 1 - Math.exp(-dampingSpeed * delta);
      camera.position.lerp(safePosition.current, easing);
    }
    camera.lookAt(targetVec);
    invalidate();
  });

  return null;
}

export const CameraCollision = memo(CameraCollisionComponent);
