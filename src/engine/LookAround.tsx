import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

/** Cuánto gira una flecha del teclado, en grados. */
const KEY_STEP_DEG = 4;
/** El giro solo se reporta si cambió al menos esto (grados): arrastrar produce decenas de eventos por segundo. */
const REPORT_STEP_DEG = 0.5;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

interface LookAroundProps {
  /** Encendido solo cuando la cámara ya está en su sitio (no durante un vuelo). */
  enabled: boolean;
  /** Hacia dónde mira la cámara al empezar, como giro en Y (radianes, convención de three.js: 0 = hacia −z). */
  yaw: number;
  /** Cuánto se puede girar la cabeza a cada lado, hacia arriba y hacia abajo, en grados. */
  yawLimitDeg: number;
  pitchUpDeg: number;
  pitchDownDeg: number;
  /** Avisa el giro actual (radianes, absoluto) cada vez que cambia lo suficiente. */
  onYawChange?: (yaw: number) => void;
}

/**
 * Mirar alrededor desde un punto fijo: arrastrar (o las flechas del teclado) gira la cámara sin moverla, con límites
 * a cada lado para no quedar mirando el interior. Reemplaza a los controles de órbita mientras se está dentro de un
 * espacio. El arrastre es 1:1 con el dedo (el campo de visión recorre el alto de la pantalla), así se siente igual
 * en celular y en escritorio. Genérico: solo recibe una orientación base y sus límites.
 */
function LookAroundComponent({ enabled, yaw, yawLimitDeg, pitchUpDeg, pitchDownDeg, onYawChange }: LookAroundProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const onYawChangeRef = useRef(onYawChange);
  useEffect(() => {
    onYawChangeRef.current = onYawChange;
  }, [onYawChange]);

  useEffect(() => {
    if (!enabled) return undefined;

    const euler = new THREE.Euler(0, yaw, 0, 'YXZ');
    let offset = 0;
    let pitch = 0;
    let reported = yaw;
    const yawLimit = toRadians(yawLimitDeg);
    const pitchUp = toRadians(pitchUpDeg);
    const pitchDown = toRadians(pitchDownDeg);

    function apply() {
      offset = Math.min(yawLimit, Math.max(-yawLimit, offset));
      pitch = Math.min(pitchUp, Math.max(-pitchDown, pitch));
      euler.set(pitch, yaw + offset, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);
      invalidate();
      if (Math.abs(yaw + offset - reported) >= toRadians(REPORT_STEP_DEG)) {
        reported = yaw + offset;
        onYawChangeRef.current?.(reported);
      }
    }
    apply();

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const previousTouchAction = domElement.style.touchAction;
    domElement.style.touchAction = 'none';
    domElement.style.cursor = 'grab';

    function handlePointerDown(event: PointerEvent) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      domElement.style.cursor = 'grabbing';
      domElement.setPointerCapture(event.pointerId);
    }
    function handlePointerMove(event: PointerEvent) {
      if (!dragging) return;
      const perspective = camera as THREE.PerspectiveCamera;
      const radiansPerPixel = toRadians(perspective.fov) / Math.max(1, domElement.clientHeight);
      offset += (event.clientX - lastX) * radiansPerPixel;
      pitch += (event.clientY - lastY) * radiansPerPixel;
      lastX = event.clientX;
      lastY = event.clientY;
      apply();
    }
    function handlePointerEnd(event: PointerEvent) {
      if (!dragging) return;
      dragging = false;
      domElement.style.cursor = 'grab';
      if (domElement.hasPointerCapture(event.pointerId)) domElement.releasePointerCapture(event.pointerId);
    }
    function handleKeyDown(event: KeyboardEvent) {
      // Las flechas en un control de formulario (la hora del sol, un deslizador) son suyas, no del giro.
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))) return;
      const step = toRadians(KEY_STEP_DEG);
      if (event.key === 'ArrowLeft') offset += step;
      else if (event.key === 'ArrowRight') offset -= step;
      else if (event.key === 'ArrowUp') pitch += step;
      else if (event.key === 'ArrowDown') pitch -= step;
      else return;
      event.preventDefault();
      apply();
    }

    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('pointermove', handlePointerMove);
    domElement.addEventListener('pointerup', handlePointerEnd);
    domElement.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerup', handlePointerEnd);
      domElement.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('keydown', handleKeyDown);
      domElement.style.touchAction = previousTouchAction;
      domElement.style.cursor = '';
    };
  }, [enabled, yaw, yawLimitDeg, pitchUpDeg, pitchDownDeg, camera, domElement, invalidate]);

  return null;
}

export const LookAround = memo(LookAroundComponent);
