import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';

export interface Crumb {
  label: string;
  /** Sin destino = el lugar donde estás (no es un enlace). */
  to?: string;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/**
 * Migas de pan del conjunto: Masterplan › Edificio › Unidad. La primera es el botón para volver
 * al masterplan (con flecha) mientras estás dentro de un edificio; las demás suben un nivel.
 * La última es donde estás y no es un enlace.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('breadcrumbs.aria')}
      className="fixed left-1/2 top-[4.25rem] z-10 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-x-auto rounded-full bg-[var(--brand-background)]/95 p-1 text-xs shadow-lg backdrop-blur [scrollbar-width:none]"
    >
      <ol className="flex items-center gap-1 whitespace-nowrap">
        {crumbs.map((crumb, index) => {
          const isCurrent = crumb.to === undefined;
          const isBack = index === 0 && !isCurrent;
          return (
            <li key={`${index}-${crumb.label}`} className="flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true" className="text-neutral-400">
                  ›
                </span>
              )}
              {isCurrent ? (
                <span aria-current="page" className="rounded-full px-2 py-1 font-medium text-neutral-900">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to!}
                  className={
                    isBack
                      ? 'flex items-center gap-1 rounded-full bg-[var(--brand-primary)] py-1 pl-2 pr-3 font-medium text-white'
                      : 'rounded-full px-2 py-1 text-neutral-600 hover:bg-neutral-100'
                  }
                >
                  {isBack && <BackIcon />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
