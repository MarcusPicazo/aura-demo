import { create } from 'zustand';

export interface PrecacheProgress {
  done: number;
  total: number;
  failed: number;
  completed: boolean;
}

interface PwaState {
  /** Hay red (según el navegador). */
  online: boolean;
  /**
   * De dónde sale el inventario que se ve: de la red, o del último guardado en este dispositivo (`syncedAt`: cuándo se sincronizó
   * por última vez, en milisegundos; `null` mientras no se sabe).
   */
  inventory: { source: 'network' | 'cache'; syncedAt: number | null };
  /** Avance de la precarga de imágenes y archivos para usar sin conexión; `null` si no hay service worker. */
  precache: PrecacheProgress | null;
  /** Se acaba de terminar de guardar todo: se muestra un aviso breve. */
  readyFlash: boolean;
  /** Hay una versión nueva esperando a que se acepte la actualización. */
  updateReady: boolean;
  /** El navegador ofrece instalar la app. */
  installable: boolean;
  setOnline: (online: boolean) => void;
  setInventory: (inventory: PwaState['inventory']) => void;
  setPrecache: (precache: PrecacheProgress | null) => void;
  setReadyFlash: (readyFlash: boolean) => void;
  setUpdateReady: (updateReady: boolean) => void;
  setInstallable: (installable: boolean) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  inventory: { source: 'network', syncedAt: null },
  precache: null,
  readyFlash: false,
  updateReady: false,
  installable: false,
  setOnline: (online) => set({ online }),
  setInventory: (inventory) => set({ inventory }),
  setPrecache: (precache) => set({ precache }),
  setReadyFlash: (readyFlash) => set({ readyFlash }),
  setUpdateReady: (updateReady) => set({ updateReady }),
  setInstallable: (installable) => set({ installable }),
}));
