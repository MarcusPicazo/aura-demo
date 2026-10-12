import { useI18n } from '../../i18n/useI18n';
import type { RenderViewConfig } from '../../types';

interface ViewSwitcherProps {
  views: RenderViewConfig[];
  activeViewId: string;
  onSelect: (viewId: string) => void;
}

/** Aérea / fachadas / plantas: las vistas que define la config del desarrollo, en su orden. */
export function ViewSwitcher({ views, activeViewId, onSelect }: ViewSwitcherProps) {
  const { t, text } = useI18n();
  if (views.length < 2) return null;

  return (
    <nav
      aria-label={t('renderNav.views')}
      className="fixed left-1/2 top-[4.25rem] z-10 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full bg-[var(--brand-background)]/95 p-1 shadow-lg backdrop-blur [scrollbar-width:none]"
    >
      {views.map((view) => {
        const active = view.id === activeViewId;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onSelect(view.id)}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active ? 'bg-[var(--brand-primary)] text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {text(view.label)}
          </button>
        );
      })}
    </nav>
  );
}
