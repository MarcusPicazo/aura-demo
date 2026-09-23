import { useEffect, useRef, useState } from 'react';

/**
 * Anima la entrada/salida de paneles que dependen de datos (ficha de unidad, piso
 * enfocado en fachada) sin librería nueva: la transición en sí la hace CSS
 * (transform/opacity, ver los componentes que usan este hook), este hook solo decide
 * CUÁNDO montar y cuándo soltar el nodo.
 *
 * Un `{valor && <Panel/>}` normal desmonta en el mismo tick en que `valor` pasa a null,
 * sin darle tiempo a la transición de salida a jugar. Este hook retiene el último valor
 * no nulo mientras el panel se anima hacia afuera, y solo lo suelta pasado `durationMs`.
 * Bajo `prefers-reduced-motion` la salida es instantánea (sin retención) y `visible`
 * pasa a `true` en el mismo tick del montaje, sin esperar el frame de la transición.
 */
export function usePresence<T>(value: T | null, durationMs = 300): { rendered: T | null; visible: boolean } {
  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const [rendered, setRendered] = useState<T | null>(value);
  const [visible, setVisible] = useState(reduceMotion.current && value !== null);
  const unmountTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (value !== null) {
      clearTimeout(unmountTimeout.current);
      setRendered(value);
      if (reduceMotion.current) {
        setVisible(true);
        return undefined;
      }
      // Un frame después de montar, no en el mismo tick: así el navegador alcanza a
      // pintar el estado "oculto" antes de animar hacia "visible".
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    setVisible(false);
    if (reduceMotion.current) {
      setRendered(null);
      return undefined;
    }
    unmountTimeout.current = setTimeout(() => setRendered(null), durationMs);
    return () => clearTimeout(unmountTimeout.current);
  }, [value, durationMs]);

  return { rendered, visible };
}
