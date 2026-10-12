import { useState } from 'react';

/**
 * `true` desde la primera vez que `value` es verdadero y para siempre después. Sirve para montar algo pesado (una hoja
 * cargada con `lazy`) solo cuando se necesita por primera vez y dejarlo montado, para que juegue su animación de cierre.
 */
export function useLatch(value: boolean): boolean {
  const [latched, setLatched] = useState(value);
  // Ajustar el estado durante el render (no en un efecto) evita un cuadro con la hoja aún sin montar.
  if (value && !latched) setLatched(true);
  return latched || value;
}
