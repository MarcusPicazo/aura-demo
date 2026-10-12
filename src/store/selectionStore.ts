import { create } from 'zustand';

interface SelectionState {
  /**
   * La unidad seleccionada, en la forma en que viaja por la URL (`UnitIdentity.param`): su código
   * en un desarrollo de una torre, o `edificio:código` en un conjunto, donde dos torres pueden
   * repetir el 101. Para llegar a la unidad: `unitIdentity.find(units, selectedUnitKey)`.
   */
  selectedUnitKey: string | null;
  selectUnit: (key: string | null) => void;
  /** SPEC §4.2: clic en un piso de la fachada "enfoca" ese piso en el selector 3D. */
  focusedFloor: number | null;
  setFocusedFloor: (floor: number | null) => void;
}

/** Selección global de unidad: la lee el visor 3D, el panel de unidad, la URL, etc. */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedUnitKey: null,
  selectUnit: (key) => set({ selectedUnitKey: key }),
  focusedFloor: null,
  setFocusedFloor: (floor) => set({ focusedFloor: floor }),
}));
