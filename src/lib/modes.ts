import { resolveBuildings } from './buildings';
import { usableRender } from './render';
import type { DevelopmentConfig, RenderConfig, Tower3DConfig, TowerDevelopmentConfig } from '../types';

const TOWER_3D_KEYS: (keyof Tower3DConfig)[] = [
  'materials',
  'carpentry',
  'balcony',
  'lobby',
  'roof',
  'context',
  'camera',
  'sky',
];

/** Cliente con modelo 3D: están todas las secciones compartidas que el selector 3D necesita y
 *  al menos un edificio con geometría (la de nivel superior o los de `buildings`). Una sola
 *  sección que falte lo descartaría (la escena no puede dibujarse a medias), no solo "empeora". */
export function hasTower3D(config: DevelopmentConfig): config is TowerDevelopmentConfig {
  return TOWER_3D_KEYS.every((key) => config[key] !== undefined) && resolveBuildings(config).length > 0;
}

/**
 * La config del modo render con solo las vistas que este desarrollo puede mostrar (la planta
 * generada por el motor necesita el modelo 3D), o null si no queda ninguna. Todo lo que
 * navega el modo render debe leer la config por aquí y no de `config.render` directamente.
 */
export function usableRenderOf(config: DevelopmentConfig): RenderConfig | null {
  if (!config.render) return null;
  const usable = usableRender(config.render, hasTower3D(config));
  return usable.views.length > 0 ? usable : null;
}

export interface AvailableModes {
  tower3d: boolean;
  render: boolean;
}

/** Qué modos de navegación ofrece este desarrollo: depende solo de lo que trae su config. */
export function availableModes(config: DevelopmentConfig): AvailableModes {
  return { tower3d: hasTower3D(config), render: usableRenderOf(config) !== null };
}
