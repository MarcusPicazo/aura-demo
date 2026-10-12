import { create } from 'zustand';

interface LookState {
  /** Hacia dónde mira la cámara dentro de una unidad (giro en Y, radianes). Aparte de la escena para que mirar alrededor repinte solo la brújula. */
  yaw: number;
  setYaw: (yaw: number) => void;
}

export const useLookStore = create<LookState>((set) => ({
  yaw: 0,
  setYaw: (yaw) => set({ yaw }),
}));
