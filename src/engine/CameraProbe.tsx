import { memo, useEffect, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';

/** Dónde está la cámara y a qué punto mira. */
export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

interface CameraProbeProps {
  /** Se llena con una función que lee la pose actual: quien está fuera del `<Canvas>` no tiene acceso a la cámara. */
  poseRef: MutableRefObject<(() => CameraPose) | null>;
}

/** El punto de mira es el del control de órbita si hay uno; si no, un punto a 20 m al frente de la cámara. */
function CameraProbeComponent({ poseRef }: CameraProbeProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as { target: { x: number; y: number; z: number } } | null;

  useEffect(() => {
    poseRef.current = () => {
      const target = controls
        ? [controls.target.x, controls.target.y, controls.target.z]
        : (() => {
            const forward = camera.getWorldDirection(camera.position.clone());
            return [camera.position.x + forward.x * 20, camera.position.y + forward.y * 20, camera.position.z + forward.z * 20];
          })();
      return { position: [camera.position.x, camera.position.y, camera.position.z], target: target as [number, number, number] };
    };
    return () => {
      poseRef.current = null;
    };
  }, [camera, controls, poseRef]);

  return null;
}

export const CameraProbe = memo(CameraProbeComponent);
