import { create } from 'zustand';
import { activeConfig } from '../config/active';
import { readJson, writeJson } from '../lib/storage';

interface KioskState {
  /** Modo showroom: interfaz grande para pantalla táctil, sin salidas accidentales y con reposo que arranca el recorrido. */
  kiosk: boolean;
  enter: () => void;
  exit: () => void;
}

const STORAGE_KEY = `kiosk:${activeConfig.slug}`;
const KIOSK_PARAM = 'modo';
const KIOSK_VALUE = 'showroom';

/** Se entra con `?modo=showroom` (para dejar una pantalla de sala de ventas con esa dirección) y se recuerda en la pestaña. */
function initialKiosk(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get(KIOSK_PARAM) === KIOSK_VALUE) return true;
  return readJson('session', STORAGE_KEY) === true;
}

function apply(kiosk: boolean) {
  if (typeof document === 'undefined') return;
  if (kiosk) document.documentElement.dataset.kiosk = '1';
  else delete document.documentElement.dataset.kiosk;
}

const startsInKiosk = initialKiosk();
apply(startsInKiosk);
if (startsInKiosk) writeJson('session', STORAGE_KEY, true);

export const useKioskStore = create<KioskState>((set) => ({
  kiosk: startsInKiosk,
  enter: () => {
    apply(true);
    writeJson('session', STORAGE_KEY, true);
    set({ kiosk: true });
  },
  exit: () => {
    apply(false);
    writeJson('session', STORAGE_KEY, false);
    set({ kiosk: false });
  },
}));
