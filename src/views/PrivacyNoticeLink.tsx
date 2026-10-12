import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/** Ruta de la página del aviso de privacidad (`App.tsx`). */
export const PRIVACY_PATH = '/aviso-de-privacidad';

interface PrivacyNoticeLinkProps {
  className?: string;
  children: ReactNode;
}

/**
 * Enlace al aviso de privacidad desde un formulario: lo abre en una pestaña aparte para no perder lo que la persona ya escribió. Hay
 * lugares donde una pestaña nueva no se abre (un panel integrado, una app instalada, un kiosco, un bloqueador de ventanas) y el enlace
 * parecía no hacer nada: ahí, sin popup, se abre la página en la misma ventana. Con teclas modificadoras (abrir en pestaña nueva, etc.)
 * o clic con otro botón se deja al navegador.
 */
export function PrivacyNoticeLink({ className, children }: PrivacyNoticeLinkProps) {
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const tab = window.open(PRIVACY_PATH, '_blank');
    if (tab) tab.opener = null;
    else navigate(PRIVACY_PATH);
  }

  return (
    <Link to={PRIVACY_PATH} target="_blank" rel="noreferrer" onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
