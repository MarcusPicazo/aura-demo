type StorageKind = 'local' | 'session';

/**
 * Lectura y escritura de JSON en el navegador sin que un almacenamiento bloqueado rompa la app: en modo privado,
 * con los datos del sitio bloqueados o con la cuota llena, el acceso lanza; aquí se traga y la función sigue
 * trabajando en memoria.
 */
function storageOf(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson(kind: StorageKind, key: string): unknown {
  try {
    const raw = storageOf(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJson(kind: StorageKind, key: string, value: unknown): void {
  try {
    storageOf(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento la lista vive solo mientras la pestaña esté abierta.
  }
}
