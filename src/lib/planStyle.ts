import { STATUS_COLORS } from './status';
import type { FloorPlanStyle } from '../types';

/**
 * Paleta de la planta generada: los colores de estado son los de la leyenda (los mismos del
 * modelo 3D y del modo render con imágenes), el resto es la paleta neutra de los planos SVG
 * de la ficha de unidad. El fondo y el acento (unidad seleccionada) son los de marca del
 * desarrollo: con el fondo de la interfaz, el lienzo se funde con la página en vez de verse
 * como un recuadro aparte.
 */
export function buildPlanStyle(accent: string, background: string): FloorPlanStyle {
  return {
    paper: background,
    slab: '#ece6da',
    unitFill: '#ffffff',
    statusFill: STATUS_COLORS,
    core: '#cfc7b6',
    outline: '#b8b2a6',
    wall: '#4a473f',
    window: '#a9c6d8',
    door: '#4a473f',
    furniture: '#8a8478',
    codeText: '#2b2b2b',
    codeHalo: '#ffffffd9',
    selected: accent,
  };
}
