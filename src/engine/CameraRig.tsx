import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

interface CameraRigProps {
  intro: [number, number, number];
  target: [number, number, number];
  duration?: number;
  onComplete?: () => void;
  /** Avance real de la animación (0–1), para la barra de la pantalla de carga; se avisa solo cuando cambia lo suficiente. */
  onProgress?: (progress: number) => void;
  /** Falso mantiene la cámara en el punto de partida (la animación espera, por ejemplo a que cargue lo que va a mostrar). */
  start?: boolean;
}

/**
 * Animación de entrada: la cámara arranca en un punto más lejano/alto y orbita
 * (interpola en coordenadas esféricas alrededor de `target`, no en línea recta)
 * hasta llegar exactamente a `intro`. Genérico: solo depende de intro/target por props.
 */
function CameraRigComponent({ intro, target, duration = 2.4, onComplete, onProgress, start = true }: CameraRigProps) {
  const { camera, invalidate } = useThree();
  const elapsed = useRef(0);
  const done = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  const lastProgress = useRef(0);
  // Reutilizada en cada cuadro: crear un objeto por cuadro dispara el recolector de basura en pleno movimiento.
  const current = useMemo(() => new THREE.Spherical(), []);
  const prefersReducedMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onProgressRef.current = onProgress;
  }, [onComplete, onProgress]);

  const rig = useMemo(() => {
    const targetVec = new THREE.Vector3(target[0], target[1], target[2]);
    const endSpherical = new THREE.Spherical().setFromVector3(
      new THREE.Vector3(intro[0], intro[1], intro[2]).sub(targetVec),
    );
    const startSpherical = new THREE.Spherical(
      endSpherical.radius * 1.4,
      Math.min(endSpherical.phi + 0.3, Math.PI / 2 - 0.05),
      endSpherical.theta - 1.25,
    );
    return { targetVec, endSpherical, startSpherical };
  }, [intro, target]);

  useEffect(() => {
    elapsed.current = 0;
    done.current = false;
    const start = new THREE.Vector3().setFromSpherical(rig.startSpherical).add(rig.targetVec);
    camera.position.copy(start);
    camera.lookAt(rig.targetVec);
    invalidate();
  }, [rig, camera, invalidate]);

  useFrame((_, delta) => {
    if (done.current || !start) return;

    elapsed.current += delta;
    // Quien pidió menos movimiento en su sistema ve la torre ya en su encuadre, sin la órbita de entrada.
    const t = prefersReducedMotion ? 1 : Math.min(elapsed.current / duration, 1);
    const eased = easeOutCubic(t);
    if (t - lastProgress.current >= 0.03 || t >= 1) {
      lastProgress.current = t;
      onProgressRef.current?.(t);
    }

    current.set(
      THREE.MathUtils.lerp(rig.startSpherical.radius, rig.endSpherical.radius, eased),
      THREE.MathUtils.lerp(rig.startSpherical.phi, rig.endSpherical.phi, eased),
      THREE.MathUtils.lerp(rig.startSpherical.theta, rig.endSpherical.theta, eased),
    );
    camera.position.setFromSpherical(current).add(rig.targetVec);
    camera.lookAt(rig.targetVec);
    invalidate();

    if (t >= 1) {
      done.current = true;
      onCompleteRef.current?.();
    }
  });

  return null;
}

export const CameraRig = memo(CameraRigComponent);
