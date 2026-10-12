import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { brandStyle } from '../config/active';
import { useDragToDismiss } from '../lib/useDragToDismiss';
import { useEscapeKey } from '../lib/useEscapeKey';
import { usePresence } from '../lib/usePresence';
import { useI18n } from '../i18n/useI18n';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `md`: una columna angosta (lista, cotización). `lg`: ancha, para tablas. */
  size?: 'md' | 'lg';
  children: ReactNode;
}

const SIZE_CLASS = { md: 'sm:w-[26rem]', lg: 'sm:w-[52rem]' } as const;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja modal de la interfaz: sube desde abajo en móvil (con su pestaña de arrastre, igual que la ficha de unidad) y es
 * un cuadro centrado en escritorio. Se monta en `document.body` —no dentro del panel que la abre, cuyas transformaciones
 * la recortarían—, con la paleta del cliente. Cierra con Escape, con la pestaña, con × y tocando fuera.
 */
export function Sheet({ open, onClose, title, size = 'md', children }: SheetProps) {
  const { rendered, visible } = usePresence(open ? true : null, 300);
  useEscapeKey(onClose, visible);
  const { dragging, dragY, handlePointerDown, handlePointerMove, handlePointerUp } = useDragToDismiss(onClose, visible);
  const titleId = useId();
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Foco: al abrir pasa al diálogo, Tab/Shift+Tab se quedan dentro mientras esté abierto (es modal: lo de atrás no se puede usar)
  // y al cerrar regresa a lo que lo abrió. Sin esto el teclado seguía recorriendo la página detrás de la hoja.
  useEffect(() => {
    if (!visible) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.focus();
    function trapTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active) || (event.shiftKey && (active === first || active === dialog)) || (!event.shiftKey && active === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener('keydown', trapTab);
    return () => {
      document.removeEventListener('keydown', trapTab);
      opener?.focus();
    };
  }, [visible]);

  if (!rendered) return null;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      style={brandStyle}
      className="fixed inset-0 z-40 flex items-end justify-center outline-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-neutral-900/40 transition-opacity duration-300 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`relative flex max-h-[88dvh] w-full select-none flex-col overflow-hidden rounded-t-2xl border-t-4 border-[var(--brand-accent)] bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-elegant motion-reduce:transition-none sm:max-h-[85dvh] sm:max-w-[calc(100vw-2rem)] sm:select-auto sm:rounded-2xl sm:border-t-0 sm:border-l-4 ${SIZE_CLASS[size]} ${
          visible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'
        }`}
        style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex shrink-0 touch-none cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing sm:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden="true" />
          <span className="sr-only">{t('common.dragToClose')}</span>
        </div>

        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-2 pt-1 sm:pt-5">
          <h2 id={titleId} className="font-serif text-xl text-neutral-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-2xl leading-none text-neutral-500 hover:text-neutral-800 sm:-mt-2">
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
