import { useEffect } from 'react';
import { preloadImage } from '../../lib/imagePreload';
import { allSurfaces, preloadOrder, uniqueImages, type RenderSurface } from '../../lib/render';
import { STAGE_RESERVED_VERTICAL_REM } from './layout';
import type { RenderConfig } from '../../types';

function isDataSaverOn(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Espera a que el navegador esté libre; Safari no tiene `requestIdleCallback`, ahí basta un respiro corto. */
function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 1500 });
    else setTimeout(resolve, 150);
  });
}

/**
 * Precarga en segundo plano las imágenes a las que puede llegar el usuario desde la
 * superficie actual: primero las que abren sus zonas (el siguiente clic), luego el resto.
 * Con `surface` null (la planta generada no tiene imagen) precarga todas.
 * Una a una y solo cuando el navegador está libre, para no competir con la imagen que se
 * está viendo. Con "ahorro de datos" activado no precarga nada.
 */
export function useRenderPreload(render: RenderConfig, surface: RenderSurface | null): void {
  useEffect(() => {
    if (isDataSaverOn()) return undefined;
    let cancelled = false;

    async function run() {
      // La imagen actual va primero (y su descarga es la misma que ya pidió el escenario).
      if (surface) await preloadImage(surface.image, STAGE_RESERVED_VERTICAL_REM);
      const queue = surface ? preloadOrder(render, surface) : uniqueImages(allSurfaces(render).map((candidate) => candidate.image));
      for (const image of queue) {
        await waitForIdle();
        if (cancelled) return;
        await preloadImage(image, STAGE_RESERVED_VERTICAL_REM, 'low');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [render, surface]);
}
