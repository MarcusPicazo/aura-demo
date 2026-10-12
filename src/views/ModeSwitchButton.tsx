import type { SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { useModeLinks } from './useModeLinks';
import { useI18n } from '../i18n/useI18n';
import type { Unit } from '../types';

function CubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 5-4.5 3.5 3L16 12l4 4.5" />
    </svg>
  );
}

interface ModeSwitchButtonProps {
  units: Unit[];
}

/**
 * Botón para pasar del modo 3D al modo render y de vuelta, llevándose la unidad abierta (o
 * el piso). Solo existe si el desarrollo tiene los dos modos; en Proyecto no aplica. En
 * celular se queda en el ícono para no apretar la barra de pestañas.
 */
export function ModeSwitchButton({ units }: ModeSwitchButtonProps) {
  const { modes, isTower, isRender, towerTo, renderTo, onGoToTower } = useModeLinks(units);
  const { t } = useI18n();
  if (!modes.tower3d || !modes.render || (!isTower && !isRender)) return null;

  const label = isRender ? t('mode.viewIn3d') : t('mode.viewInRender');
  const Icon = isRender ? CubeIcon : ImageIcon;

  return (
    <Link
      to={isRender ? towerTo : renderTo}
      onClick={isRender ? onGoToTower : undefined}
      aria-label={label}
      title={label}
      className="fixed right-4 top-4 z-20 flex h-9 w-9 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-primary)] text-sm font-medium text-white shadow-lg transition-opacity hover:opacity-90 sm:w-auto sm:px-4"
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </Link>
  );
}
