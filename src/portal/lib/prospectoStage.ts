import type { ProspectoStage } from '../types';

export const STAGE_META: Record<ProspectoStage, { label: string; icon?: string; className: string }> = {
  nuevo: { label: 'Nuevo', icon: undefined, className: 'bg-secondary text-on-secondary' },
  contactado: { label: 'Contactado', icon: 'phone_in_talk', className: 'bg-surface-container text-on-surface-variant' },
  cita: { label: 'Cita programada', icon: 'event', className: 'bg-surface-container-high text-on-surface' },
  seguimiento: { label: 'En seguimiento', icon: undefined, className: 'bg-secondary-container text-on-secondary-container' },
  cerrado: { label: 'Cerrado', icon: undefined, className: 'bg-primary-fixed text-on-primary-fixed' },
  perdido: { label: 'Perdido', icon: undefined, className: 'bg-surface-container text-on-surface-variant' },
};

export const STAGE_ORDER: ProspectoStage[] = ['nuevo', 'contactado', 'cita', 'seguimiento', 'cerrado', 'perdido'];
