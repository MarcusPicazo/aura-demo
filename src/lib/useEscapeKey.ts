import { useEffect } from 'react';

/** Cierra con la tecla Escape mientras `active` — mismo atajo en todos los paneles/overlays. */
export function useEscapeKey(onEscape: () => void, active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);
}
