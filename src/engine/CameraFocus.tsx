import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/** El control de órbita que usa la escena: solo necesitamos mover su punto de mira. */
interface OrbitLike {
  target: THREE.Vector3;
  update: () => boolean | void;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

interface CameraFocusProps {
  /** Dónde debe quedar la cámara y a qué punto debe mirar al terminar el vuelo. */
  position: [number, number, number];
  target: [number, number, number];
  /** Segundos que dura el vuelo. */
  duration?: number;
  /** Cuánto se eleva la cámara a mitad del vuelo, como fracción de la distancia recorrida (da el arco). */
  arc?: number;
  /** Campo de visión vertical con que debe quedar la cámara (se interpola durante el vuelo). Sin esto no se toca. */
  fov?: number;
  /** Plano cercano con que debe quedar la cámara al terminar el vuelo. Sin esto no se toca. */
  near?: number;
  /** Avisa al empezar y al terminar un vuelo, para apagar los controles y la colisión mientras dura. */
  onFlightChange?: (flying: boolean) => void;
}

interface Flight {
  elapsed: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  lift: number;
  fromFov: number;
  toFov: number;
}

/**
 * Vuelo de cámara entre dos encuadres (masterplan ⇄ edificio): cuando cambian `position` o
 * `target`, la cámara y su punto de mira se desplazan suavemente de donde están a donde deben
 * quedar, con un arco hacia arriba. El primer encuadre no se anima aquí —de la entrada se
 * ocupa `CameraRig`—. Genérico: no sabe qué es un edificio, solo recibe una pose destino.
 *
 * Si la pose trae `fov` (p. ej. la vista desde adentro de una unidad, más abierta), también se interpola.
 *
 * Mueve la cámara y el `target` del `OrbitControls` directamente, así que quien lo use debe
 * apagar los controles (y cualquier colisión) mientras `onFlightChange(true)` esté activo.
 */
function CameraFocusComponent({ position, target, duration = 1.4, arc = 0.18, fov, near, onFlightChange }: CameraFocusProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;
  const invalidate = useThree((state) => state.invalidate);
  const flight = useRef<Flight | null>(null);
  const lastPose = useRef<string | null>(null);
  const onFlightChangeRef = useRef(onFlightChange);
  useEffect(() => {
    onFlightChangeRef.current = onFlightChange;
  }, [onFlightChange]);

  // La cámara de la escena es de perspectiva; si no lo fuera, el campo de visión simplemente no se toca.
  const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (camera as THREE.PerspectiveCamera) : null;
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  useEffect(() => {
    const pose = `${position.join(',')}|${target.join(',')}|${fov ?? ''}`;
    if (lastPose.current === null) {
      lastPose.current = pose;
      return;
    }
    if (lastPose.current === pose || !controls) return;
    lastPose.current = pose;

    const toPosition = new THREE.Vector3(...position);
    const fromPosition = camera.position.clone();
    flight.current = {
      elapsed: 0,
      fromPosition,
      toPosition,
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...target),
      lift: fromPosition.distanceTo(toPosition) * arc,
      fromFov: perspective?.fov ?? 0,
      toFov: fov ?? perspective?.fov ?? 0,
    };
    onFlightChangeRef.current?.(true);
    invalidate();
  }, [position, target, fov, controls, camera, perspective, arc, invalidate]);

  useFrame((_, delta) => {
    const current = flight.current;
    if (!current || !controls) return;

    current.elapsed += delta;
    const t = Math.min(current.elapsed / duration, 1);
    const eased = easeInOutCubic(t);

    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
    camera.position.y += Math.sin(Math.PI * eased) * current.lift;
    controls.target.lerpVectors(current.fromTarget, current.toTarget, eased);
    camera.lookAt(controls.target);
    if (perspective && current.fromFov !== current.toFov) {
      perspective.fov = THREE.MathUtils.lerp(current.fromFov, current.toFov, eased);
      perspective.updateProjectionMatrix();
    }
    invalidate();

    if (t >= 1) {
      flight.current = null;
      if (perspective && nearRef.current !== undefined && perspective.near !== nearRef.current) {
        perspective.near = nearRef.current;
        perspective.updateProjectionMatrix();
      }
      onFlightChangeRef.current?.(false);
    }
  });

  return null;
}

export const CameraFocus = memo(CameraFocusComponent);
