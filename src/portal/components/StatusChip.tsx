import type { UnitStatus } from '../types';
import { Icon } from './Icon';

const STATUS_META: Record<UnitStatus, { label: string; icon: string; className: string }> = {
  available: { label: 'Disponible', icon: 'check_circle', className: 'bg-surface-container-high text-secondary' },
  reserved: { label: 'Apartado', icon: 'schedule', className: 'bg-secondary-container text-on-secondary-container' },
  sold: { label: 'Vendido', icon: 'lock', className: 'bg-primary-container text-on-primary' },
  blocked: { label: 'Bloqueado', icon: 'do_not_disturb_on', className: 'bg-error-container text-on-error-container' },
};

interface StatusChipProps {
  status: UnitStatus;
  /** Reemplaza la etiqueta por defecto (p. ej. "Apartado (#AP-1094)"). */
  label?: string;
}

export function StatusChip({ status, label }: StatusChipProps) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-sm font-ui font-semibold ${meta.className}`}>
      <Icon name={meta.icon} className="text-[13px]" />
      <span>{label ?? meta.label}</span>
    </span>
  );
}
