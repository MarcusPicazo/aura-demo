import { createElement } from 'react';
import { FloorPlanDetailed } from './FloorPlanDetailed';
import type { I18n } from '../i18n/useI18n';
import type { FloorPlanConfig, Point } from '../types';

export interface RasterImage {
  /** `data:image/png;base64,…`, listo para `jsPDF.addImage`. */
  dataUrl: string;
  width: number;
  height: number;
}

/** Ancho máximo, en píxeles, de lo que se rasteriza: nítido en un PDF a tamaño carta sin inflar el archivo. */
const MAX_WIDTH = 1400;
const PLAN_BACKGROUND = '#fafafa';
/** Proporción de respaldo (ancho:alto) de una imagen que el navegador no sabe medir (un SVG sin width/height). */
const FALLBACK_RATIO = 4;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar la imagen ${src}`));
    image.src = src;
  });
}

/** Dibuja una imagen sobre un lienzo (con fondo opcional) y la devuelve como PNG, a lo más de `MAX_WIDTH` de ancho. */
export function rasterize(image: HTMLImageElement, background?: string): RasterImage {
  const naturalWidth = image.naturalWidth || 1;
  const naturalHeight = image.naturalHeight || Math.round(naturalWidth / FALLBACK_RATIO);
  const scale = naturalWidth > MAX_WIDTH ? MAX_WIDTH / naturalWidth : naturalWidth < MAX_WIDTH / 2 ? 2 : 1;
  const width = Math.round(naturalWidth * scale);
  const height = Math.round(naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el lienzo para la imagen.');
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

/**
 * El plano de una unidad como imagen para el PDF. Un plano en imagen se rasteriza tal cual; uno dibujado
 * se genera con el mismo componente que la ficha (`FloorPlanDetailed`), se convierte a SVG independiente y se
 * rasteriza — así el PDF muestra exactamente el plano que el usuario vio en pantalla. `null` si no hay plano
 * (o no se pudo dibujar): la cotización sale igual, sin esa sección.
 */
export async function renderPlanImage(outline: Point[] | undefined, plan: FloorPlanConfig | undefined, i18n: I18n): Promise<RasterImage | null> {
  if (!plan) return null;
  try {
    if (plan.kind === 'image') return rasterize(await loadImage(plan.src), '#ffffff');
    if (!outline) return null;

    // `react-dom/server` solo se baja al pedir una cotización.
    const { renderToStaticMarkup } = await import('react-dom/server');
    const markup = renderToStaticMarkup(createElement(FloorPlanDetailed, { outline, plan, i18n }));
    const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup);
    if (!viewBox) return null;
    const ratio = Number(viewBox[1]) / Number(viewBox[2]);
    const width = MAX_WIDTH;
    const height = Math.round(width / ratio);
    // Un SVG usado como imagen no puede leer el CSS de la página ni necesita sus clases: se declara el espacio de
    // nombres y el tamaño, y todo lo demás (colores, trazos) ya viaja como atributos del propio SVG.
    const svg = markup.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `);
    const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    return rasterize(image, PLAN_BACKGROUND);
  } catch (error) {
    console.error('No se pudo preparar el plano para la cotización:', error);
    return null;
  }
}
