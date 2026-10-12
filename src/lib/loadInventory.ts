import type { InventorySnapshot } from './inventoryCache';
import type { Unit } from '../types';

export interface InventoryResult {
  developmentId: string;
  units: Unit[];
  /** `cache`: el último guardado en el dispositivo; `network`: recién bajado. */
  source: 'network' | 'cache';
  /** Cuándo se sincronizó con el servidor, en milisegundos. */
  syncedAt: number;
}

interface LoadInventoryOptions {
  fetchFresh: () => Promise<{ developmentId: string; units: Unit[] }>;
  cached: InventorySnapshot | null;
  /** Cuánto se espera a la red antes de mostrar lo guardado (mientras tanto sigue intentando). */
  graceMs: number;
  now: () => number;
  /** Puede llamarse dos veces: primero con lo guardado y luego, si llega, con lo fresco. */
  onResult: (result: InventoryResult) => void;
  /** Solo cuando la red falló y no hay nada guardado que mostrar. */
  onError: (error: unknown) => void;
  sleep?: (milliseconds: number) => Promise<void>;
}

/**
 * Carga el inventario sin que una mala red deje la pantalla vacía: con la red a tiempo se usa lo fresco; si tarda más de
 * `graceMs` o falla, se muestra lo último guardado (`source: 'cache'`) y, si la petición todavía llega, se reemplaza por lo
 * fresco. Sin nada guardado, se espera a la red y un fallo es un error.
 */
export async function loadInventory(options: LoadInventoryOptions): Promise<void> {
  const { cached, onResult, onError } = options;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  type Settled = { ok: true; value: { developmentId: string; units: Unit[] } } | { ok: false; error: unknown };
  const fresh: Promise<Settled> = options.fetchFresh().then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
  const network = (value: { developmentId: string; units: Unit[] }): InventoryResult => ({ ...value, source: 'network', syncedAt: options.now() });

  if (!cached) {
    const result = await fresh;
    if (result.ok) onResult(network(result.value));
    else onError(result.error);
    return;
  }

  const fromCache = (): InventoryResult => ({ developmentId: cached.developmentId, units: cached.units, source: 'cache', syncedAt: cached.savedAt });
  const first = await Promise.race([fresh, sleep(options.graceMs).then(() => 'timeout' as const)]);
  if (first === 'timeout') {
    onResult(fromCache());
    const late = await fresh;
    if (late.ok) onResult(network(late.value));
    return;
  }
  onResult(first.ok ? network(first.value) : fromCache());
}
