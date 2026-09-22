import { create } from 'zustand';

interface SelectionState {
  selectedUnitCode: string | null;
  selectUnit: (code: string | null) => void;
  /** SPEC §4.2: clic en un piso de la fachada "enfoca" ese piso en el selector 3D. */
  focusedFloor: number | null;
  setFocusedFloor: (floor: number | null) => void;
}

/** Selección global de unidad: la lee el visor 3D, el panel de unidad, la URL, etc. */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedUnitCode: null,
  selectUnit: (code) => set({ selectedUnitCode: code }),
  focusedFloor: null,
  setFocusedFloor: (floor) => set({ focusedFloor: floor }),
}));
