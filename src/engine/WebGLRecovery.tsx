import { memo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Recuperación de contexto WebGL: el navegador puede soltar el contexto en cualquier
 * momento (presión de memoria de GPU, la pestaña vuelve de segundo plano en móvil, el
 * sistema recicla contextos inactivos) — no es un error de la app, pasa incluso en código
 * perfecto. Sin manejarlo, `canvas.getContext('webgl2')` simplemente deja de dibujar: bajo
 * `frameloop="demand"` (Selector3D.tsx) nada vuelve a pedir un cuadro por su cuenta, así
 * que la pantalla queda congelada/en blanco para siempre, aunque el navegador restaure el
 * contexto un instante después.
 *
 * `event.preventDefault()` en `webglcontextlost` es lo que le dice al navegador "sí quiero
 * que intentes restaurarlo" — sin eso, el contexto se pierde permanentemente por diseño del
 * propio WebGL. En `webglcontextrestored`, three.js ya reconstruye sus recursos internos
 * solo; lo único que falta es pedir un cuadro nuevo (`invalidate()`) para que ese trabajo
 * se refleje en pantalla bajo "demand".
 */
function WebGLRecoveryComponent() {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;

    function handleContextLost(event: Event) {
      event.preventDefault();
      console.error('Contexto WebGL perdido — esperando a que el navegador lo restaure.');
    }

    function handleContextRestored() {
      console.error('Contexto WebGL restaurado — reanudando el render.');
      invalidate();
    }

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, invalidate]);

  return null;
}

export const WebGLRecovery = memo(WebGLRecoveryComponent);
