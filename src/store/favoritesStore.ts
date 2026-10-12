import { create } from 'zustand';
import { activeConfig } from '../config/active';
import { MAX_FAVORITES, mergeKeys, sanitizeKeys, toggleKey } from '../lib/collections';
import { readJson, writeJson } from '../lib/storage';

interface FavoritesState {
  /** Unidades guardadas (claves de `UnitIdentity.param`), en el orden en que se guardaron. Viven en `localStorage`. */
  keys: string[];
  toggle: (key: string) => void;
  remove: (key: string) => void;
  /** Suma una lista (la de un link compartido) a los favoritos propios. */
  addMany: (keys: string[]) => void;
  clear: () => void;

  /** El panel de favoritos está abierto. */
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  /** Lista que llegó por link y se está viendo sin haberla guardado; `null` si no hay ninguna. */
  sharedKeys: string[] | null;
  receiveShared: (keys: string[]) => void;
  dismissShared: () => void;
}

/** Por desarrollo: dos clientes servidos desde el mismo dominio no deben mezclar sus favoritos. */
const STORAGE_KEY = `favorites:${activeConfig.slug}`;

function persist(keys: string[]) {
  writeJson('local', STORAGE_KEY, keys);
}

/** Favoritos de la persona que usa el navegador: no hay cuenta ni servidor, todo queda en este dispositivo. */
export const useFavoritesStore = create<FavoritesState>((set) => ({
  keys: sanitizeKeys(readJson('local', STORAGE_KEY), MAX_FAVORITES),
  toggle: (key) =>
    set((state) => {
      const { keys } = toggleKey(state.keys, key, MAX_FAVORITES);
      persist(keys);
      return { keys };
    }),
  remove: (key) =>
    set((state) => {
      const keys = state.keys.filter((candidate) => candidate !== key);
      persist(keys);
      return { keys };
    }),
  addMany: (incoming) =>
    set((state) => {
      const keys = mergeKeys(state.keys, incoming, MAX_FAVORITES);
      persist(keys);
      return { keys };
    }),
  clear: () => {
    persist([]);
    set({ keys: [] });
  },

  panelOpen: false,
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  sharedKeys: null,
  receiveShared: (keys) => set({ sharedKeys: keys, panelOpen: true }),
  dismissShared: () => set({ sharedKeys: null }),
}));

// Otra pestaña del mismo navegador cambió la lista: esta se actualiza sola.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    useFavoritesStore.setState({ keys: sanitizeKeys(readJson('local', STORAGE_KEY), MAX_FAVORITES) });
  });
}
