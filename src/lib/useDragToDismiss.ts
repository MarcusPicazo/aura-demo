import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Debajo de esto, un arrastre en la pestaña móvil se trata como tap (cierra igual que el
 *  botón ×) en vez de como "no llegó a nada" (regresaría al panel abierto sin razón). */
const TAP_MAX_PX = 6;
/** Arriba de esto, soltar cierra el panel; en medio, regresa a abierto. */
const CLOSE_THRESHOLD_PX = 80;

interface DragToDismiss {
  /** Mientras es `true`, aplica `style={{ transform: 'translateY(${dragY}px)', transition: 'none' }}`
   *  en el panel — reemplaza a mano la transform de las clases de Tailwind para que el
   *  panel siga al dedo 1 a 1 en vez de animarse detrás de él. */
  dragging: boolean;
  dragY: number;
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: () => void;
}

/**
 * Gesto de "pestaña de arrastre" para paneles tipo hoja inferior en móvil (ficha de unidad,
 * ficha de contacto...): tocar la pestaña o deslizarla hacia abajo más de
 * `CLOSE_THRESHOLD_PX` cierra el panel (llama `onClose`); un arrastre a medias regresa al
 * panel abierto. Genérico — no sabe nada del panel que lo usa, solo del gesto.
 */
export function useDragToDismiss(onClose: () => void, visible: boolean): DragToDismiss {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartClientY = useRef(0);

  // Si el panel se vuelve a abrir (misma selección otra vez, o una nueva sin cerrar antes)
  // con un arrastre a medias pendiente de antes, no debe reaparecer ya empujado.
  useEffect(() => {
    if (visible) setDragY(0);
  }, [visible]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartClientY.current = event.clientY;
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragY(Math.max(0, event.clientY - dragStartClientY.current));
  }

  function handlePointerUp() {
    if (dragY <= TAP_MAX_PX || dragY > CLOSE_THRESHOLD_PX) {
      onClose();
      // Suelta el control manual de la posición un instante después, no de inmediato: si
      // se soltara ya, el panel brincaría un frame de vuelta a "abierto" (el `visible` del
      // padre todavía no baja) antes de que la transición normal de cierre tomara el
      // relevo — con este respiro, para cuando se suelta ya está cerrando de verdad.
      window.setTimeout(() => setDragging(false), 50);
    } else {
      setDragging(false);
      setDragY(0);
    }
  }

  return { dragging, dragY, handlePointerDown, handlePointerMove, handlePointerUp };
}
