import type { CSSProperties } from 'react';
import auraConfigJson from './aura.json';
import { createUnitIdentity, resolveBuildings } from '../lib/buildings';
import type { I18n } from '../i18n/useI18n';
import type { DevelopmentConfig } from '../types';

/**
 * La config del desarrollo activo y lo que se deduce de ella una sola vez: sus edificios y
 * cómo se identifica una unidad entre ellos. Las vistas importan esto en vez de volver a
 * castear el JSON y recalcular lo mismo en cada archivo.
 */
export const activeConfig = auraConfigJson as unknown as DevelopmentConfig;
export const buildings = resolveBuildings(activeConfig);
export const unitIdentity = createUnitIdentity(buildings);

/**
 * SPEC §3: la paleta del cliente como variables CSS (`var(--brand-*)`). Se aplica una vez en la raíz de la interfaz
 * y en lo que se pinta fuera de ella (las hojas que se montan en `document.body`), así ningún componente
 * escribe un color de marca.
 */
export const brandStyle = {
  '--brand-primary': activeConfig.brand.primary,
  '--brand-accent': activeConfig.brand.accent,
  '--brand-background': activeConfig.brand.background,
} as CSSProperties;

/**
 * Cómo nombrar el desarrollo en los mensajes de WhatsApp: en un conjunto, el edificio de la unidad
 * ("Torre Jacaranda, Torre Aura Del Valle"); con un solo edificio, el nombre del desarrollo tal cual
 * (SPEC §2: "…de Torre Aura Del Valle.").
 */
export function messageDevelopmentName(i18n: I18n, buildingId: string | undefined): string {
  const building = unitIdentity.multi ? buildings.find((candidate) => candidate.id === buildingId) : undefined;
  return building ? `${i18n.text(building.name)}, ${activeConfig.name}` : activeConfig.name;
}
