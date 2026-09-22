import type { UnitStatus } from '../types';

/**
 * SPEC §4.1: verde = disponible, ámbar = apartado, gris = vendido. Es convención
 * genérica del selector (no de marca), así que la usan tanto el motor (colores de
 * material) como las vistas (leyenda, ficha de unidad).
 */
export const STATUS_COLORS: Record<UnitStatus, string> = {
  available: '#4caf6a',
  reserved: '#e0a53e',
  sold: '#9a958c',
};

export const STATUS_LABELS: Record<UnitStatus, string> = {
  available: 'Disponible',
  reserved: 'Apartado',
  sold: 'Vendido',
};
