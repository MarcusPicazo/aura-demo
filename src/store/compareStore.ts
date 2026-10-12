import { create } from 'zustand';
import { activeConfig } from '../config/active';
import { MAX_COMPARE, sanitizeKeys, toggleKey, type ToggleResult } from '../lib/collections';
import { readJson, writeJson } from '../lib/storage';

interface CompareState {
  /** Unidades marcadas para comparar (hasta `MAX_COMPARE`), en el orden en que se marcaron. Duran lo que la pestaña. */
  keys: string[];
  /** Marca o desmarca; avisa si la lista ya estaba llena y no se pudo agregar. */
  toggle: (key: string) => ToggleResult;
  remove: (key: string) => void;
  clear: () => void;
  open: boolean;
  openCompare: () => void;
  closeCompare: () => void;
}

const STORAGE_KEY = `compare:${activeConfig.slug}`;

function persist(keys: string[]) {
  writeJson('session', STORAGE_KEY, keys);
}

export const useCompareStore = create<CompareState>((set, get) => ({
  keys: sanitizeKeys(readJson('session', STORAGE_KEY), MAX_COMPARE),
  toggle: (key) => {
    const { keys, result } = toggleKey(get().keys, key, MAX_COMPARE);
    if (result !== 'full') {
      persist(keys);
      set({ keys });
    }
    return result;
  },
  remove: (key) =>
    set((state) => {
      const keys = state.keys.filter((candidate) => candidate !== key);
      persist(keys);
      return { keys, open: state.open && keys.length > 0 };
    }),
  clear: () => {
    persist([]);
    set({ keys: [], open: false });
  },
  open: false,
  openCompare: () => set({ open: true }),
  closeCompare: () => set({ open: false }),
}));
