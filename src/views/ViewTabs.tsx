import { Link } from 'react-router-dom';
import { useModeLinks } from './useModeLinks';
import { useI18n } from '../i18n/useI18n';
import type { Unit } from '../types';

interface ViewTabsProps {
  units: Unit[];
}

/**
 * Pestañas de la interfaz: Torre 3D y Render son los dos modos del mismo inventario, y
 * pasar de uno a otro conserva lo que el usuario traía (la unidad abierta, o el piso que
 * estaba mirando) en vez de empezar de cero. Cada modo solo aparece si el desarrollo lo
 * tiene en su config; Proyecto va siempre.
 */
export function ViewTabs({ units }: ViewTabsProps) {
  const { modes, isTower, isRender, isProject, towerTo, renderTo, onGoToTower } = useModeLinks(units);
  const { t } = useI18n();

  function tabClass(active: boolean): string {
    // `whitespace-nowrap`: la barra está centrada con `left-1/2`, así que su ancho disponible es
    // la mitad de la pantalla y "Torre 3D" se partía en dos renglones en celular.
    return `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-[var(--brand-primary)] text-white' : 'text-neutral-600 hover:bg-neutral-100'
    }`;
  }

  return (
    <nav
      aria-label={t('tabs.label')}
      className="fixed left-1/2 top-4 z-20 flex -translate-x-1/2 gap-1 rounded-full bg-[var(--brand-background)]/95 p-1 shadow-lg backdrop-blur"
    >
      {modes.tower3d && (
        <Link to={towerTo} onClick={onGoToTower} aria-current={isTower ? 'page' : undefined} className={tabClass(isTower)}>
          {t('tabs.tower3d')}
        </Link>
      )}
      {modes.render && (
        <Link to={renderTo} aria-current={isRender ? 'page' : undefined} className={tabClass(isRender)}>
          {t('tabs.render')}
        </Link>
      )}
      <Link to="/aura/proyecto" aria-current={isProject ? 'page' : undefined} className={tabClass(isProject)}>
        {t('tabs.project')}
      </Link>
    </nav>
  );
}
