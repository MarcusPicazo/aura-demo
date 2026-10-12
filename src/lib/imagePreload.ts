import { buildImageSources, imageSizes } from './render';
import type { RenderImage } from '../types';

/** Una entrada por imagen+tamaño: varias plantas comparten archivo y se descarga una sola vez. */
const loads = new Map<string, Promise<boolean>>();

/**
 * Descarga y decodifica la misma variante que elegirá el `<img>` del escenario (mismo
 * `srcset` y `sizes`), así el cambio de vista no espera red ni decodificación: cuando la
 * promesa resuelve, el `<img>` ya la tiene en caché y se pinta de inmediato.
 *
 * Resuelve `true` si cargó y `false` si falló. Nunca rechaza (el escenario muestra su propio
 * aviso con la imagen rota) y un fallo no se recuerda: el siguiente intento vuelve a pedirla.
 */
export function preloadImage(
  image: RenderImage,
  reservedVerticalRem: number,
  priority: 'high' | 'low' = 'high',
): Promise<boolean> {
  const sizes = imageSizes(image, reservedVerticalRem);
  const key = `${image.base}|${sizes}`;
  const existing = loads.get(key);
  if (existing) return existing;

  const { src, srcSet } = buildImageSources(image);
  const element = new Image();
  element.fetchPriority = priority;
  element.decoding = 'async';
  element.sizes = sizes;
  element.srcset = srcSet;
  element.src = src;

  const promise = element.decode().then(
    () => true,
    () => {
      loads.delete(key);
      return false;
    },
  );
  loads.set(key, promise);
  return promise;
}
