import { useEffect, useMemo, useRef } from 'react';
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
}

/**
 * Animación de entrada: la cámara arranca en un punto más lejano/alto y orbita
 * (interpola en coordenadas esféricas alrededor de `target`, no en línea recta)
 * hasta llegar exactamente a `intro`. Genérico: solo depende de intro/target por props.
 */
export function CameraRig({ intro, target, duration = 2.4, onComplete }: CameraRigProps) {
  const { camera, invalidate } = useThree();
  const elapsed = useRef(0);
  const done = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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
    if (done.current) return;

    elapsed.current += delta;
    const t = Math.min(elapsed.current / duration, 1);
    const eased = easeOutCubic(t);

    const current = new THREE.Spherical(
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
