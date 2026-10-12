import { memo, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

interface StaticShadowsProps {
  /**
   * Cualquier cambio de este valor vuelve a calcular el mapa de sombras: lo que cambia dónde cae una sombra (el sol, el edificio
   * activo, que termine de montarse su detalle, qué piezas proyectan sombra). Girar o acercar la cámara no cambia nada de eso.
   */
  refreshKey: string;
  /** Cuadros que se recalcula como mínimo tras un cambio: lo que se monta en un efecto (matrices de instancias) llega un cuadro tarde. */
  minFrames?: number;
  /** Tiempo mínimo, en ms, durante el que se sigue recalculando tras un cambio (por ejemplo mientras se arrastra el control del sol). */
  settleMs?: number;
}

/**
 * Congela el mapa de sombras del sol. three.js lo vuelve a dibujar en CADA render por omisión —todas las piezas que proyectan sombra,
 * otra vez— y en un celular eso es más de la mitad del costo de cada cuadro mientras se orbita una escena que no cambia. Con esto
 * se calcula al arrancar y tras cada cambio de `refreshKey`, y el resto del tiempo se reutiliza. Genérico: no sabe nada de la escena.
 */
function StaticShadowsComponent({ refreshKey, minFrames = 4, settleMs = 700 }: StaticShadowsProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const framesLeft = useRef(minFrames);
  const settleUntil = useRef(0);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useEffect(() => {
    framesLeft.current = minFrames;
    settleUntil.current = performance.now() + settleMs;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [refreshKey, minFrames, settleMs, gl, invalidate]);

  useFrame(() => {
    if (framesLeft.current > 0 || performance.now() < settleUntil.current) {
      framesLeft.current = Math.max(0, framesLeft.current - 1);
      gl.shadowMap.needsUpdate = true;
    }
  });

  return null;
}

export const StaticShadows = memo(StaticShadowsComponent);
