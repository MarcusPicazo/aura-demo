import type { jsPDF } from 'jspdf';
import { activeConfig } from '../config/active';
import { loadImage, rasterize, type RasterImage } from '../views/planImage';
import type { I18n } from '../i18n/useI18n';

/**
 * Piezas que comparten los PDF del sitio (la cotización de una unidad y el brochure del desarrollo): medidas de la carta
 * vertical, la paleta del cliente, títulos de sección, filas "etiqueta … valor" y el bloque del asesor. Nada de esto sabe
 * qué cliente es: la marca y los datos salen de la config. `jsPDF` solo se importa como tipo; quien arma el documento lo
 * descarga bajo demanda.
 */

// ─── Medidas (milímetros, carta vertical) ────────────────────────────────────────────

export const PAGE_WIDTH = 215.9;
export const PAGE_HEIGHT = 279.4;
export const MARGIN = 16;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
export const ROW_HEIGHT = 7.5;
export const SECTION_GAP = 9;

export type RGB = [number, number, number];

export const INK: RGB = [38, 38, 38];
export const MUTED: RGB = [115, 115, 115];
export const RULE: RGB = [225, 222, 216];

export interface Palette {
  primary: RGB;
  accent: RGB;
  background: RGB;
}

export function hexToRgb(hex: string, fallback: RGB): RGB {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return fallback;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Los tres colores de la marca del cliente, con respaldo si la config trae uno que no es hexadecimal. */
export function brandPalette(): Palette {
  const { brand } = activeConfig;
  return {
    primary: hexToRgb(brand.primary, INK),
    accent: hexToRgb(brand.accent, [200, 162, 122]),
    background: hexToRgb(brand.background, [244, 239, 232]),
  };
}

/** Mezcla un color con blanco: `amount` 0 = el color, 1 = blanco. */
export function tint([r, g, b]: RGB, amount: number): RGB {
  return [Math.round(r + (255 - r) * amount), Math.round(g + (255 - g) * amount), Math.round(b + (255 - b) * amount)];
}

export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** El logotipo del cliente como imagen para el PDF; `null` si no carga (el encabezado usa el nombre). */
export async function loadLogo(src: string): Promise<RasterImage | null> {
  try {
    return rasterize(await loadImage(src));
  } catch {
    return null;
  }
}

// ─── Secciones ───────────────────────────────────────────────────────────────────────

export function drawSectionTitle(doc: jsPDF, palette: Palette, title: string, x: number, y: number, width: number) {
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...palette.primary);
  doc.text(title, x, y);
  doc.setDrawColor(...palette.accent);
  doc.setLineWidth(0.5);
  doc.line(x, y + 2, x + width, y + 2);
}

/** Filas "etiqueta … valor": devuelve la `y` donde termina la tabla. */
export function drawRows(doc: jsPDF, rows: [string, string][], x: number, y: number, width: number, rowHeight: number, shade?: RGB): number {
  rows.forEach(([label, value], index) => {
    const top = y + index * rowHeight;
    if (shade && index % 2 === 0) {
      doc.setFillColor(...shade);
      doc.rect(x, top, width, rowHeight, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 2, top + rowHeight / 2 + 1.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(value, x + width - 2, top + rowHeight / 2 + 1.2, { align: 'right' });
  });
  return y + rows.length * rowHeight;
}

/** "Tu asesor": sección con iniciales, nombre, cargo, WhatsApp, correo, horario y sala de ventas. Devuelve la `y` donde termina. */
export function drawAdvisor(doc: jsPDF, palette: Palette, y: number, i18n: I18n): number {
  const { t, text } = i18n;
  const { advisor } = activeConfig;
  drawSectionTitle(doc, palette, t('pdf.advisor'), MARGIN, y, CONTENT_WIDTH);
  const advisorTop = y + 7;
  doc.setFillColor(...palette.primary);
  doc.circle(MARGIN + 7, advisorTop + 7, 7, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(initials(advisor.name), MARGIN + 7, advisorTop + 8.6, { align: 'center' });

  const textX = MARGIN + 20;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(advisor.name, textX, advisorTop + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(text(advisor.role), textX, advisorTop + 8.5);

  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const contactLines: { text: string; url?: string }[] = [
    { text: t('pdf.whatsappPhone', { phone: advisor.phone }), url: `https://wa.me/${advisor.phone}` },
    { text: advisor.email, url: `mailto:${advisor.email}` },
    { text: text(advisor.hours) },
  ];
  let lineY = advisorTop + 15;
  for (const line of contactLines) {
    if (line.url) doc.textWithLink(line.text, textX, lineY, { url: line.url });
    else doc.text(line.text, textX, lineY);
    lineY += 5.2;
  }
  const addressLines = doc.splitTextToSize(t('pdf.salesOffice', { address: text(advisor.salesOffice.address) }), CONTENT_WIDTH - 20) as string[];
  doc.text(addressLines, textX, lineY);
  return lineY + addressLines.length * 4;
}
