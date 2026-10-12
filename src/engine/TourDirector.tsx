import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { sampleTrackInto, type Keyframe } from '../lib/tour';

/** El control de órbita de la escena: solo hace falta mover su punto de mira para que, al devolverlo, no salte. */
interface OrbitLike {
  target: THREE.Vector3;
}

export interface CameraTrack {
  keyframes: Keyframe[];
  /** Segundos. */
  duration: number;
}

interface TourDirectorProps {
  /** La pista que recorre la cámara; `null` = sin recorrido. Cambiar de pista reinicia desde su primer cuadro. */
  track: CameraTrack | null;
  /** Al subir este contador, la cámara vuelve en `returnSeconds` al primer cuadro de la pista y el recorrido termina. */
  stopToken: number;
  returnSeconds?: number;
  /** Se llama en cada cuadro con el tiempo transcurrido y el avance (0–1) de la pista. */
  onTime?: (time: number, progress: number) => void;
  /** Termina: `completed` es falso si se detuvo antes de acabar. */
  onEnd: (completed: boolean) => void;
}

/** Un cuadro de la pista es largo como mucho esto: tras una pausa de la pestaña, el recorrido no salta de golpe. */
const MAX_FRAME_SECONDS = 0.1;

/**
 * Director de cámara: mueve la cámara a lo largo de una pista de cuadros clave (posición, punto de mira, campo de
 * visión y plano cercano) y avisa del tiempo para que quien lo use ponga rótulos, mueva el sol, etc. Es genérico: no
 * sabe qué es un edificio, solo recorre una pista. Mientras corre, apaga el control de órbita de quien lo use (eso es de
 * quien lo monta). Detenerlo (`stopToken`) devuelve la cámara suavemente al primer cuadro en vez de dejarla en el aire.
 */
function TourDirectorComponent({ track, stopToken, returnSeconds = 1.2, onTime, onEnd }: TourDirectorProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;
  const invalidate = useThree((state) => state.invalidate);
  const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera) : null;

  const elapsed = useRef(0);
  const active = useRef<CameraTrack | null>(track);
  const returning = useRef(false);
  const scratch = useRef<Keyframe>({ time: 0, position: [0, 0, 0], target: [0, 0, 0], fov: 50, near: 1 });
  const lookTarget = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const lastStop = useRef(stopToken);
  const callbacks = useRef({ onTime, onEnd });
  useEffect(() => {
    callbacks.current = { onTime, onEnd };
  }, [onTime, onEnd]);

  // Una pista nueva arranca desde su primer cuadro.
  useEffect(() => {
    active.current = track;
    elapsed.current = 0;
    returning.current = false;
    if (track) invalidate();
  }, [track, invalidate]);

  // Detener: una pista corta de regreso desde donde está la cámara ahora hasta donde empezó el recorrido.
  useEffect(() => {
    if (stopToken === lastStop.current) return;
    lastStop.current = stopToken;
    const current = active.current;
    if (!current || returning.current) return;
    const home = current.keyframes[0];
    camera.getWorldDirection(forward.current);
    const distance = controls ? camera.position.distanceTo(controls.target) : 20;
    const here: Keyframe = {
      time: 0,
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [camera.position.x + forward.current.x * distance, camera.position.y + forward.current.y * distance, camera.position.z + forward.current.z * distance],
      fov: perspective?.fov ?? home.fov,
      near: perspective?.near ?? home.near,
    };
    active.current = { duration: returnSeconds, keyframes: [here, { ...home, time: returnSeconds }] };
    elapsed.current = 0;
    returning.current = true;
    invalidate();
  }, [stopToken, camera, controls, perspective, returnSeconds, invalidate]);

  useFrame((_, delta) => {
    const current = active.current;
    if (!current) return;
    elapsed.current += Math.min(delta, MAX_FRAME_SECONDS);
    const time = Math.min(elapsed.current, current.duration);
    const frame = scratch.current;
    sampleTrackInto(frame, current.keyframes, time);

    camera.position.set(frame.position[0], frame.position[1], frame.position[2]);
    lookTarget.current.set(frame.target[0], frame.target[1], frame.target[2]);
    camera.lookAt(lookTarget.current);
    controls?.target.copy(lookTarget.current);
    if (perspective && (perspective.fov !== frame.fov || perspective.near !== frame.near)) {
      perspective.fov = frame.fov;
      perspective.near = frame.near;
      perspective.updateProjectionMatrix();
    }
    invalidate();

    if (!returning.current) callbacks.current.onTime?.(time, time / current.duration);
    if (time >= current.duration) {
      const completed = !returning.current;
      active.current = null;
      returning.current = false;
      callbacks.current.onEnd(completed);
    }
  });

  return null;
}

export const TourDirector = memo(TourDirectorComponent);
