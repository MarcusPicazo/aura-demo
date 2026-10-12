import { memo, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

interface PrecompileSceneProps {
  /** Verdadero cuando ya está en la escena todo lo que se va a dibujar al arrancar. */
  enabled: boolean;
  /** Se llama una sola vez cuando los shaders quedaron compilados (o se acabó el tiempo de espera). */
  onDone: () => void;
  /** Tope de espera: si la compilación se cuelga, la escena arranca igual. */
  timeoutMs?: number;
}

/**
 * Compila los shaders de la escena en paralelo (`compileAsync` usa KHR_parallel_shader_compile donde existe) ANTES del primer
 * cuadro. Sin esto, el primer render compila y enlaza todos los programas de golpe en el hilo principal: en un celular son
 * varios cientos de milisegundos con la pantalla congelada, justo al empezar la animación de entrada.
 */
function PrecompileSceneComponent({ enabled, onDone, timeoutMs = 4000 }: PrecompileSceneProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!enabled) return undefined;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      onDoneRef.current();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    gl.compileAsync(scene, camera).then(finish, finish);
    return () => {
      finished = true;
      window.clearTimeout(timer);
    };
  }, [enabled, gl, scene, camera, timeoutMs]);

  return null;
}

export const PrecompileScene = memo(PrecompileSceneComponent);
