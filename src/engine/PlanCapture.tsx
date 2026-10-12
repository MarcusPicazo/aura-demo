import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { frameImageSize, type PlanFrame } from '../lib/levelPlan';

/** Lo que `PlanCapture` le entrega a quien quiera exportar la planta que se está mostrando. */
export interface PlanCaptureApi {
  /** PNG del recuadro completo de la planta, de `widthPx` de ancho (el alto sale de la proporción del recuadro). */
  capture: (widthPx: number) => Promise<Blob>;
}

/**
 * Puente para exportar la planta como imagen, dentro del mismo `<Canvas>` que la muestra: lo
 * que se exporta es exactamente lo que se ve (mismo escena, mismos colores, mismo estado de
 * "códigos" y "color por estado"), solo que a otro tamaño y con una cámara ortográfica que
 * abarca justo el recuadro (`frame`), sin depender del tamaño de la ventana.
 *
 * Redimensiona el lienzo de la escena un instante, dibuja un cuadro y lo restaura; la
 * pantalla no parpadea porque el navegador no pinta entre esas líneas (todo ocurre en la
 * misma tarea). Con `frameloop="demand"` no hay ningún otro dibujo que se cruce.
 */
export function PlanCapture({ frame, apiRef }: { frame: PlanFrame; apiRef: RefObject<PlanCaptureApi | null> }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const capture = (widthPx: number) =>
      new Promise<Blob>((resolve, reject) => {
        const { width, height } = frameImageSize(frame, widthPx);
        const centerX = frame.minX + frame.width / 2;
        const centerZ = frame.minZ + frame.depth / 2;
        const camera = new THREE.OrthographicCamera(-frame.width / 2, frame.width / 2, frame.depth / 2, -frame.depth / 2, 1, 100);
        camera.up.set(0, 0, -1);
        camera.position.set(centerX, 50, centerZ);
        camera.lookAt(centerX, 0, centerZ);
        camera.updateMatrixWorld();

        const previousSize = gl.getSize(new THREE.Vector2());
        const previousRatio = gl.getPixelRatio();
        const restore = () => {
          gl.setPixelRatio(previousRatio);
          gl.setSize(previousSize.x, previousSize.y, false);
          invalidate();
        };

        try {
          gl.setPixelRatio(1);
          gl.setSize(width, height, false);
          gl.render(scene, camera);
        } catch (error) {
          restore();
          reject(error);
          return;
        }
        // `toBlob` toma la foto del lienzo en este mismo instante; recién después se restaura.
        gl.domElement.toBlob((blob) => {
          restore();
          if (blob) resolve(blob);
          else reject(new Error('El navegador no pudo generar el PNG de la planta.'));
        }, 'image/png');
      });

    apiRef.current = { capture };
    return () => {
      apiRef.current = null;
    };
  }, [gl, scene, frame, invalidate, apiRef]);

  return null;
}
