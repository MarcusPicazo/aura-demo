import { create } from 'zustand';
import type { TourCaptionId } from '../lib/tour';

interface TourState {
  /** Alguien pidió el recorrido (botón o reposo del showroom): la escena lo arranca en cuanto puede. */
  requested: boolean;
  /** El recorrido está corriendo: la interfaz se esconde y la cámara la lleva el director. */
  active: boolean;
  /** Mientras no haya interacción, al terminar vuelve a empezar (pantalla corriendo sola). */
  loop: boolean;
  /** El rótulo en pantalla. */
  caption: TourCaptionId | null;
  /** Progreso 0–1, para la barra fina de abajo. */
  progress: number;
  /** El edificio y la unidad que visita el recorrido, y si la cámara está dentro de ella. */
  buildingId: string | null;
  unitCode: string | null;
  insideUnit: boolean;
  request: () => void;
  begin: (buildingId: string | null, unitCode: string | null) => void;
  end: () => void;
  setCaption: (caption: TourCaptionId | null) => void;
  setProgress: (progress: number) => void;
  setInsideUnit: (inside: boolean) => void;
}

export const useTourStore = create<TourState>((set) => ({
  requested: false,
  active: false,
  loop: true,
  caption: null,
  progress: 0,
  buildingId: null,
  unitCode: null,
  insideUnit: false,
  request: () => set({ requested: true }),
  begin: (buildingId, unitCode) => set({ requested: false, active: true, caption: null, progress: 0, buildingId, unitCode, insideUnit: false }),
  end: () => set({ requested: false, active: false, caption: null, progress: 0, buildingId: null, unitCode: null, insideUnit: false }),
  setCaption: (caption) => set({ caption }),
  setProgress: (progress) => set({ progress }),
  setInsideUnit: (insideUnit) => set({ insideUnit }),
}));
