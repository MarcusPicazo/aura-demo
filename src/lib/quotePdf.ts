import type { jsPDF } from 'jspdf';
import { activeConfig } from '../config/active';
import { calculatePaymentPlan } from './pricing';
import type { I18n } from '../i18n/useI18n';
import { loadImage, rasterize, renderPlanImage, type RasterImage } from '../views/planImage';
import type { FloorPlanConfig, Point, Unit } from '../types';

/**
 * Cotización en PDF, armada en el navegador: marca del desarrollo, datos de la unidad, su plano, el esquema de
 * pagos y los datos del asesor. Una página tamaño carta con las fuentes estándar del PDF (Times para títulos y
 * Helvetica para datos, como la interfaz: serif para títulos, sans para datos). Todo sale de la config del
 * desarrollo y de la unidad; jsPDF se descarga solo al pedir la cotización.
 */

export interface QuoteInput {
  /** Idioma y moneda con que sale el documento (los del momento de pedirlo). */
  i18n: I18n;
  unit: Unit;
  /** Nombre del edificio; solo en un conjunto. */
  buildingName?: string;
  /** Cómo se nombra el desarrollo en los mensajes ("Torre Jacaranda, Torre Aura Del Valle"). */
  developmentName: string;
  /** Enganche con que se calculan las mensualidades: el que el usuario dejó en el control de la ficha. */
  downPaymentPercent: number;
  polygon: Point[] | undefined;
  floorPlan: FloorPlanConfig | undefined;
}

export interface QuoteDocument {
  blob: Blob;
  filename: string;
}

// ─── Medidas (milímetros, carta vertical) ────────────────────────────────────────────

const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 7.5;
/** Alto de la caja del plano y separación entre secciones: lo que hace que todo quepa en una carta con el pie de página. */
const PLAN_BOX_HEIGHT = 62;
const SECTION_GAP = 9;

const INK: RGB = [38, 38, 38];
const MUTED: RGB = [115, 115, 115];
const RULE: RGB = [225, 222, 216];

type RGB = [number, number, number];

function hexToRgb(hex: string, fallback: RGB): RGB {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return fallback;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Mezcla un color con blanco: `amount` 0 = el color, 1 = blanco. */
function tint([r, g, b]: RGB, amount: number): RGB {
  return [Math.round(r + (255 - r) * amount), Math.round(g + (255 - g) * amount), Math.round(b + (255 - b) * amount)];
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

async function loadLogo(src: string): Promise<RasterImage | null> {
  try {
    return rasterize(await loadImage(src));
  } catch {
    return null;
  }
}

// ─── Secciones ───────────────────────────────────────────────────────────────────────

interface Palette {
  primary: RGB;
  accent: RGB;
  background: RGB;
}

function drawHeader(doc: jsPDF, palette: Palette, logo: RasterImage | null, name: string, issuedOn: string, quoteLabel: string) {
  doc.setFillColor(...palette.background);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, 'F');
  doc.setFillColor(...palette.accent);
  doc.rect(0, HEADER_HEIGHT, PAGE_WIDTH, 0.9, 'F');

  if (logo) {
    const ratio = logo.width / logo.height;
    const width = Math.min(60, 12 * ratio);
    const height = width / ratio;
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, (HEADER_HEIGHT - height) / 2, width, height);
  } else {
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...palette.primary);
    doc.text(name, MARGIN, HEADER_HEIGHT / 2 + 2);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...palette.primary);
  doc.text(quoteLabel, PAGE_WIDTH - MARGIN, HEADER_HEIGHT / 2 - 1, { align: 'right', charSpace: 1 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(issuedOn, PAGE_WIDTH - MARGIN, HEADER_HEIGHT / 2 + 4.5, { align: 'right' });
}

function drawSectionTitle(doc: jsPDF, palette: Palette, title: string, x: number, y: number, width: number) {
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...palette.primary);
  doc.text(title, x, y);
  doc.setDrawColor(...palette.accent);
  doc.setLineWidth(0.5);
  doc.line(x, y + 2, x + width, y + 2);
}

/** Filas "etiqueta … valor": devuelve la `y` donde termina la tabla. */
function drawRows(doc: jsPDF, rows: [string, string][], x: number, y: number, width: number, rowHeight: number, shade?: RGB): number {
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

// ─── Documento ───────────────────────────────────────────────────────────────────────

/** Arma la cotización de una unidad. Lanza si no puede construir el PDF (la interfaz muestra el error). */
export async function buildQuotePdf(input: QuoteInput): Promise<QuoteDocument> {
  const { i18n, unit, buildingName, developmentName, downPaymentPercent, polygon, floorPlan } = input;
  const { t, money, text } = i18n;
  const { brand, advisor, paymentPlan, seo } = activeConfig;
  const palette: Palette = {
    primary: hexToRgb(brand.primary, INK),
    accent: hexToRgb(brand.accent, [200, 162, 122]),
    background: hexToRgb(brand.background, [244, 239, 232]),
  };

  // jsPDF y el plano rasterizado (que también arrastra `react-dom/server`) solo se bajan ahora.
  const [{ jsPDF }, logo, plan] = await Promise.all([import('jspdf'), loadLogo(brand.logo), renderPlanImage(polygon, floorPlan, i18n)]);
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const issuedOn = i18n.dateLong(new Date());
  const schedule = calculatePaymentPlan(unit.price, downPaymentPercent, paymentPlan.balanceAtDeliveryPercent, paymentPlan.constructionMonths);
  const pricePerM2 = unit.m2 > 0 ? Math.round(unit.price / unit.m2) : 0;

  doc.setProperties({
    title: t('pdf.title', { code: unit.code, development: developmentName }),
    subject: t('pdf.subject', { code: unit.code }),
    author: developmentName,
    creator: developmentName,
  });

  drawHeader(doc, palette, logo, activeConfig.name, issuedOn, t('pdf.quote'));

  // Título de la unidad y precio.
  let y = HEADER_HEIGHT + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(developmentName.toUpperCase(), MARGIN, y, { charSpace: 0.6 });
  y += 9;
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...palette.primary);
  doc.text(t('pdf.apartment', { code: unit.code }), MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text([t('pdf.typeLine', { type: unit.type }), t('pdf.floorLine', { floor: unit.floor }), ...(buildingName ? [buildingName] : [])].join('  ·  '), MARGIN, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(...INK);
  doc.text(money(unit.price), PAGE_WIDTH - MARGIN, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(t('pdf.listPrice', { currency: i18n.currency, status: i18n.status(unit.status) }), PAGE_WIDTH - MARGIN, y + 6, { align: 'right' });
  // En dólares el precio es referencial: se imprime también el oficial, en pesos.
  if (i18n.isReferential) doc.text(t('pdf.officialPrice', { amount: i18n.moneyMxn(unit.price) }), PAGE_WIDTH - MARGIN, y + 10.5, { align: 'right' });

  // Características y plano, lado a lado.
  y += 18;
  const columnGap = 8;
  const hasPlan = plan !== null;
  const detailsWidth = hasPlan ? 78 : CONTENT_WIDTH;
  const planX = MARGIN + detailsWidth + columnGap;
  const planWidth = CONTENT_WIDTH - detailsWidth - columnGap;

  drawSectionTitle(doc, palette, t('pdf.features'), MARGIN, y, detailsWidth);
  const detailsEnd = drawRows(
    doc,
    [
      [t('pdf.area'), `${unit.m2} m²`],
      [t('pdf.bedrooms'), String(unit.bedrooms)],
      [t('pdf.bathrooms'), String(unit.bathrooms)],
      [t('pdf.floor'), String(unit.floor)],
      [t('pdf.orientation'), i18n.orientation(unit.orientation)],
      [t('pdf.pricePerM2'), money(pricePerM2)],
    ],
    MARGIN,
    y + 5,
    detailsWidth,
    ROW_HEIGHT,
    tint(palette.background, 0.4),
  );

  let sectionEnd = detailsEnd;
  if (plan) {
    drawSectionTitle(doc, palette, t('pdf.planTitle'), planX, y, planWidth);
    // Con la nota del tipo de cambio hay un renglón más abajo: la caja del plano cede ese espacio.
    const boxHeight = i18n.isReferential ? PLAN_BOX_HEIGHT - 6 : PLAN_BOX_HEIGHT;
    const ratio = plan.width / plan.height;
    const drawWidth = Math.min(planWidth, boxHeight * ratio);
    const drawHeight = drawWidth / ratio;
    const planY = y + 6;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.rect(planX, planY, planWidth, Math.max(boxHeight, drawHeight));
    doc.addImage(plan.dataUrl, 'PNG', planX + (planWidth - drawWidth) / 2, planY + (Math.max(boxHeight, drawHeight) - drawHeight) / 2, drawWidth, drawHeight, undefined, 'FAST');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(t('pdf.planNote'), planX, planY + Math.max(boxHeight, drawHeight) + 4);
    sectionEnd = Math.max(sectionEnd, planY + Math.max(boxHeight, drawHeight) + 5);
  }

  // Esquema de pagos.
  y = sectionEnd + SECTION_GAP;
  drawSectionTitle(doc, palette, t('pdf.payments'), MARGIN, y, CONTENT_WIDTH);
  const paymentsEnd = drawRows(
    doc,
    [
      [t('pdf.priceRow'), money(unit.price)],
      [t('pdf.downPayment', { percent: downPaymentPercent }), money(schedule.downPayment)],
      [t('pdf.monthly', { count: schedule.monthsCount }), t('pdf.each', { amount: money(schedule.monthlyPayment) })],
      [t('pdf.balance', { percent: paymentPlan.balanceAtDeliveryPercent }), money(schedule.balanceAtDelivery)],
      [t('pdf.delivery'), i18n.monthYear(paymentPlan.deliveryDate)],
    ],
    MARGIN,
    y + 5,
    CONTENT_WIDTH,
    ROW_HEIGHT,
    tint(palette.background, 0.4),
  );

  // En dólares, una nota debajo del esquema dice que es referencial y con qué tipo de cambio.
  let afterPayments = paymentsEnd;
  if (i18n.isReferential) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const note = doc.splitTextToSize(t('currency.note', { rate: i18n.rateText, date: i18n.rateDateText }), CONTENT_WIDTH) as string[];
    doc.text(note, MARGIN, paymentsEnd + 4);
    afterPayments = paymentsEnd + 1 + note.length * 3.2;
  }

  // Asesor.
  y = afterPayments + SECTION_GAP;
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

  // Pie de página: aviso y dirección del sitio.
  const footerTop = PAGE_HEIGHT - 22;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerTop, PAGE_WIDTH - MARGIN, footerTop);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const disclaimer = doc.splitTextToSize(
    t('pdf.disclaimer', { date: issuedOn }),
    CONTENT_WIDTH,
  ) as string[];
  doc.text(disclaimer, MARGIN, footerTop + 4.5);
  if (seo.siteUrl) doc.textWithLink(seo.siteUrl, MARGIN, footerTop + 4.5 + disclaimer.length * 3.4 + 1.5, { url: seo.siteUrl });

  const filename = `${t('pdf.filePrefix')}-${slug(developmentName)}-${slug(unit.code)}.pdf`;
  return { blob: doc.output('blob'), filename };
}
