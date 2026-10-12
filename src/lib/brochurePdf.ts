import type { jsPDF } from 'jspdf';
import { activeConfig } from '../config/active';
import { imageUrlForWidth } from './render';
import { describeUnit } from './unitDetails';
import {
  CONTENT_WIDTH,
  INK,
  MARGIN,
  MUTED,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  ROW_HEIGHT,
  RULE,
  SECTION_GAP,
  brandPalette,
  drawAdvisor,
  drawRows,
  drawSectionTitle,
  loadLogo,
  slug,
  tint,
  type Palette,
} from './pdfKit';
import type { QuoteDocument } from './quotePdf';
import type { I18n } from '../i18n/useI18n';
import { loadPhoto, renderPlanImage, type RasterImage } from '../views/planImage';
import type { Unit } from '../types';

/**
 * Brochure del desarrollo en PDF, armado en el navegador (nada se envía a ningún servidor): portada con la fachada, el proyecto, cada
 * tipología con su plano y su precio "desde", las amenidades con su foto, el esquema de pagos y los datos del asesor. Tamaño carta
 * vertical, con las mismas fuentes y la misma marca que la cotización (`pdfKit`). Todo sale de la config del cliente y del
 * inventario: las tipologías, superficies, precios y planos son los de las unidades reales, no una lista aparte que se desfase.
 */

export interface BrochureInput {
  /** Idioma y moneda con que sale el documento (los del momento de pedirlo). */
  i18n: I18n;
  /** Inventario actual: de aquí salen las tipologías. Sin inventario se usan las tipologías de la config. */
  units: Unit[];
}

// ─── Tipologías ──────────────────────────────────────────────────────────────────────

export interface Typology {
  type: string;
  bedrooms: number;
  bathrooms: number;
  minM2: number;
  maxM2: number;
  /** El precio más bajo entre las unidades disponibles; `null` si no queda ninguna. */
  fromPrice: number | null;
  /** La unidad cuyo plano se dibuja: la disponible más barata o, si no hay, la primera. */
  sample: Unit | null;
}

/** Agrupa el inventario por tipo (A, B, C, D, PH…): superficie, recámaras, baños y "desde" de cada uno. */
export function typologiesOf(units: Unit[]): Typology[] {
  const groups = new Map<string, Unit[]>();
  for (const unit of units) groups.set(unit.type, [...(groups.get(unit.type) ?? []), unit]);
  return [...groups.entries()]
    .map(([type, group]) => {
      const available = group.filter((unit) => unit.status === 'available').sort((a, b) => a.price - b.price);
      const sample = available[0] ?? group[0];
      return {
        type,
        bedrooms: sample.bedrooms,
        bathrooms: sample.bathrooms,
        minM2: Math.min(...group.map((unit) => unit.m2)),
        maxM2: Math.max(...group.map((unit) => unit.m2)),
        fromPrice: available[0]?.price ?? null,
        sample,
      };
    })
    .sort((a, b) => a.type.localeCompare(b.type));
}

/** Sin inventario (sin red y sin copia guardada), las tipologías de la config: sin planos, con el precio base. */
export function typologiesFromConfig(): Typology[] {
  const { unitTypes, penthouseUnitTypes } = activeConfig;
  const standard = Object.entries(unitTypes).map(([type, spec]) => ({
    type,
    bedrooms: spec.bedrooms,
    bathrooms: spec.bathrooms,
    minM2: spec.m2,
    maxM2: spec.m2,
    fromPrice: spec.priceBase,
    sample: null,
  }));
  const penthouses = Object.values(penthouseUnitTypes);
  if (penthouses.length === 0) return standard;
  return [
    ...standard,
    {
      type: 'PH',
      bedrooms: penthouses[0].bedrooms,
      bathrooms: penthouses[0].bathrooms,
      minM2: Math.min(...penthouses.map((spec) => spec.m2)),
      maxM2: Math.max(...penthouses.map((spec) => spec.m2)),
      fromPrice: Math.min(...penthouses.map((spec) => spec.priceBase)),
      sample: null,
    },
  ];
}

// ─── Medidas propias del brochure (milímetros) ───────────────────────────────────────

const COVER_PHOTO_HEIGHT = 232;
const PAGE_HEADER_HEIGHT = 16;
/** Hasta dónde llega el contenido: debajo va el pie de página. */
const CONTENT_BOTTOM = PAGE_HEIGHT - 18;
const BANNER_HEIGHT = 70;
const TYPOLOGY_CARD_HEIGHT = 38;
const TYPOLOGY_CARD_HEIGHT_NO_PLAN = 24;
const PLAN_BOX_WIDTH = 46;
const AMENITY_COLUMNS = 3;
const AMENITY_GAP = 5;
const AMENITY_IMAGE_HEIGHT = 32;
const AMENITY_ROW_HEIGHT = 58;

/** Tamaños y calidad de las fotos incrustadas: nítidas a tamaño carta sin inflar el archivo. */
const COVER_PHOTO = { maxWidth: 1400, quality: 0.8 };
const BANNER_PHOTO = { maxWidth: 1400, quality: 0.78 };
const AMENITY_PHOTO = { maxWidth: 640, quality: 0.78 };
const PLAN_MAX_WIDTH = 700;

interface Layout {
  doc: jsPDF;
  palette: Palette;
  logo: RasterImage | null;
  i18n: I18n;
  name: string;
  /** Dónde va el siguiente bloque en la página actual. */
  y: number;
}

// ─── Páginas ─────────────────────────────────────────────────────────────────────────

function drawCover(layout: Layout, photo: RasterImage | null, issuedOn: string) {
  const { doc, palette, logo, i18n, name } = layout;
  const { t, text } = i18n;

  if (photo) {
    doc.addImage(photo.dataUrl, 'JPEG', 0, 0, PAGE_WIDTH, COVER_PHOTO_HEIGHT, undefined, 'FAST');
  } else {
    doc.setFillColor(...palette.primary);
    doc.rect(0, 0, PAGE_WIDTH, COVER_PHOTO_HEIGHT, 'F');
  }

  const bandTop = COVER_PHOTO_HEIGHT;
  doc.setFillColor(...palette.background);
  doc.rect(0, bandTop, PAGE_WIDTH, PAGE_HEIGHT - bandTop, 'F');
  doc.setFillColor(...palette.accent);
  doc.rect(0, bandTop, PAGE_WIDTH, 1.2, 'F');

  let textY = bandTop + 17;
  if (logo) {
    const ratio = logo.width / logo.height;
    const width = Math.min(52, 11 * ratio);
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, bandTop + 8, width, width / ratio);
    textY = bandTop + 8 + width / ratio + 11;
  }
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...palette.primary);
  doc.text(name, MARGIN, textY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11.5);
  doc.setTextColor(...MUTED);
  doc.text(text(activeConfig.tagline), MARGIN, textY + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...palette.primary);
  doc.text(t('brochure.label'), PAGE_WIDTH - MARGIN, bandTop + 14, { align: 'right', charSpace: 1 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(issuedOn, PAGE_WIDTH - MARGIN, bandTop + 19.5, { align: 'right' });
}

/** Encabezado de las páginas interiores: logotipo (o nombre) a la izquierda y el rótulo del documento a la derecha. */
function drawPageHeader(layout: Layout) {
  const { doc, palette, logo, i18n, name } = layout;
  doc.setFillColor(...palette.background);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEADER_HEIGHT, 'F');
  doc.setFillColor(...palette.accent);
  doc.rect(0, PAGE_HEADER_HEIGHT, PAGE_WIDTH, 0.7, 'F');
  if (logo) {
    const ratio = logo.width / logo.height;
    const width = Math.min(40, 7.5 * ratio);
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, (PAGE_HEADER_HEIGHT - width / ratio) / 2, width, width / ratio);
  } else {
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...palette.primary);
    doc.text(name, MARGIN, PAGE_HEADER_HEIGHT / 2 + 1.5);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...palette.primary);
  doc.text(i18n.t('brochure.label'), PAGE_WIDTH - MARGIN, PAGE_HEADER_HEIGHT / 2 + 1.2, { align: 'right', charSpace: 1 });
  layout.y = PAGE_HEADER_HEIGHT + 14;
}

/** Pasa a una página nueva si lo que sigue no cabe en la actual. */
function ensureSpace(layout: Layout, height: number) {
  if (layout.y + height <= CONTENT_BOTTOM) return;
  layout.doc.addPage();
  drawPageHeader(layout);
}

function drawParagraph(layout: Layout, content: string, fontSize: number, lineHeight: number) {
  const { doc } = layout;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(content, CONTENT_WIDTH) as string[];
  for (const line of lines) {
    ensureSpace(layout, lineHeight);
    doc.text(line, MARGIN, layout.y);
    layout.y += lineHeight;
  }
}

function drawProject(layout: Layout, banner: RasterImage | null) {
  const { doc, palette, i18n } = layout;
  const { t, text } = i18n;
  drawSectionTitle(doc, palette, t('brochure.project'), MARGIN, layout.y, CONTENT_WIDTH);
  layout.y += 9;
  drawParagraph(layout, text(activeConfig.project.description), 10.5, 5.3);
  layout.y += 4;

  if (banner) {
    ensureSpace(layout, BANNER_HEIGHT + 6);
    doc.addImage(banner.dataUrl, 'JPEG', MARGIN, layout.y, CONTENT_WIDTH, BANNER_HEIGHT, undefined, 'FAST');
    layout.y += BANNER_HEIGHT + 3;
  }

  const address = activeConfig.project.location?.address;
  if (address) {
    ensureSpace(layout, ROW_HEIGHT + 2);
    layout.y = drawRows(doc, [[t('brochure.location'), text(address)]], MARGIN, layout.y, CONTENT_WIDTH, ROW_HEIGHT, tint(palette.background, 0.4));
  }
  layout.y += SECTION_GAP;
}

function specsLine(i18n: I18n, typology: Typology): string {
  const { t } = i18n;
  const area =
    typology.minM2 === typology.maxM2
      ? t('brochure.area', { m2: typology.minM2 })
      : t('brochure.areaRange', { min: typology.minM2, max: typology.maxM2 });
  return [t('brochure.bedrooms', { count: typology.bedrooms }), t('brochure.bathrooms', { count: typology.bathrooms }), area].join('  ·  ');
}

function drawTypologies(layout: Layout, typologies: Typology[], plans: (RasterImage | null)[]) {
  const { doc, palette, i18n } = layout;
  const { t, money } = i18n;
  ensureSpace(layout, 14 + TYPOLOGY_CARD_HEIGHT);
  drawSectionTitle(doc, palette, t('brochure.typologies'), MARGIN, layout.y, CONTENT_WIDTH);
  layout.y += 8;

  typologies.forEach((typology, index) => {
    const plan = plans[index];
    const cardHeight = plan ? TYPOLOGY_CARD_HEIGHT : TYPOLOGY_CARD_HEIGHT_NO_PLAN;
    ensureSpace(layout, cardHeight + 3);
    const top = layout.y;
    let textX = MARGIN;

    if (plan) {
      const boxHeight = cardHeight - 4;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.3);
      doc.rect(MARGIN, top, PLAN_BOX_WIDTH, boxHeight);
      const ratio = plan.width / plan.height;
      const drawWidth = Math.min(PLAN_BOX_WIDTH - 4, (boxHeight - 4) * ratio);
      const drawHeight = drawWidth / ratio;
      doc.addImage(plan.dataUrl, 'PNG', MARGIN + (PLAN_BOX_WIDTH - drawWidth) / 2, top + (boxHeight - drawHeight) / 2, drawWidth, drawHeight, undefined, 'FAST');
      textX = MARGIN + PLAN_BOX_WIDTH + 8;
    }

    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...palette.primary);
    doc.text(t('pdf.typeLine', { type: typology.type }), textX, top + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(specsLine(i18n, typology), textX, top + 15);
    if (typology.fromPrice !== null) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...INK);
      doc.text(t('brochure.fromPrice', { price: money(typology.fromPrice) }), textX, top + 23.5);
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text(t('brochure.noUnits'), textX, top + 23.5);
    }

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, top + cardHeight - 1, PAGE_WIDTH - MARGIN, top + cardHeight - 1);
    layout.y = top + cardHeight + 2;
  });

  // Notas debajo de las tipologías: planos ilustrativos y, en dólares, que el precio es referencial.
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const notes = [plans.some(Boolean) ? t('pdf.planNote') : '', i18n.isReferential ? t('currency.note', { rate: i18n.rateText, date: i18n.rateDateText }) : '']
    .filter(Boolean)
    .join(' ');
  if (notes) {
    const lines = doc.splitTextToSize(notes, CONTENT_WIDTH) as string[];
    ensureSpace(layout, lines.length * 3.2 + 2);
    doc.text(lines, MARGIN, layout.y + 1);
    layout.y += lines.length * 3.2 + 2;
  }
  layout.y += SECTION_GAP - 2;
}

function drawAmenities(layout: Layout, photos: (RasterImage | null)[]) {
  const { doc, palette, i18n } = layout;
  const { t, text } = i18n;
  const { amenities } = activeConfig.project;
  if (amenities.length === 0) return;

  ensureSpace(layout, 14 + AMENITY_ROW_HEIGHT);
  drawSectionTitle(doc, palette, t('brochure.amenities'), MARGIN, layout.y, CONTENT_WIDTH);
  layout.y += 8;

  const cellWidth = (CONTENT_WIDTH - AMENITY_GAP * (AMENITY_COLUMNS - 1)) / AMENITY_COLUMNS;
  amenities.forEach((amenity, index) => {
    const column = index % AMENITY_COLUMNS;
    if (column === 0) ensureSpace(layout, AMENITY_ROW_HEIGHT);
    const x = MARGIN + column * (cellWidth + AMENITY_GAP);
    const top = layout.y;
    const photo = photos[index];

    if (photo) {
      doc.addImage(photo.dataUrl, 'JPEG', x, top, cellWidth, AMENITY_IMAGE_HEIGHT, undefined, 'FAST');
    } else {
      doc.setFillColor(...tint(palette.background, 0.2));
      doc.rect(x, top, cellWidth, AMENITY_IMAGE_HEIGHT, 'F');
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...palette.primary);
    const labelLines = (doc.splitTextToSize(text(amenity.label), cellWidth) as string[]).slice(0, 2);
    doc.text(labelLines, x, top + AMENITY_IMAGE_HEIGHT + 5.5);
    if (amenity.description) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      const lines = (doc.splitTextToSize(text(amenity.description), cellWidth) as string[]).slice(0, 3);
      doc.text(lines, x, top + AMENITY_IMAGE_HEIGHT + 5.5 + (labelLines.length - 1) * 4.4 + 5);
    }

    const lastInRow = column === AMENITY_COLUMNS - 1 || index === amenities.length - 1;
    if (lastInRow) layout.y = top + AMENITY_ROW_HEIGHT;
  });
  layout.y += SECTION_GAP - 6;
}

function drawPaymentsAndContact(layout: Layout, issuedOn: string) {
  const { doc, palette, i18n } = layout;
  const { t } = i18n;
  const plan = activeConfig.paymentPlan;

  ensureSpace(layout, 14 + ROW_HEIGHT * 4);
  drawSectionTitle(doc, palette, t('pdf.payments'), MARGIN, layout.y, CONTENT_WIDTH);
  layout.y = drawRows(
    doc,
    [
      [t('brochure.downPayment'), t('brochure.downPaymentRange', { min: plan.minDownPaymentPercent, max: plan.maxDownPaymentPercent })],
      [t('brochure.months'), String(plan.constructionMonths)],
      [t('brochure.balance'), `${plan.balanceAtDeliveryPercent}%`],
      [t('pdf.delivery'), i18n.monthYear(plan.deliveryDate)],
    ],
    MARGIN,
    layout.y + 5,
    CONTENT_WIDTH,
    ROW_HEIGHT,
    tint(palette.background, 0.4),
  );
  layout.y += SECTION_GAP;

  ensureSpace(layout, 50);
  layout.y = drawAdvisor(doc, palette, layout.y, i18n) + SECTION_GAP - 2;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const disclaimer = doc.splitTextToSize(t('brochure.disclaimer', { date: issuedOn }), CONTENT_WIDTH) as string[];
  ensureSpace(layout, disclaimer.length * 3.4 + 8);
  doc.text(disclaimer, MARGIN, layout.y);
  const { siteUrl } = activeConfig.seo;
  if (siteUrl) doc.textWithLink(siteUrl, MARGIN, layout.y + disclaimer.length * 3.4 + 1.5, { url: siteUrl });
}

/** Pie de las páginas interiores: el nombre del desarrollo y "Página n de N". */
function drawFooters(layout: Layout) {
  const { doc, i18n, name } = layout;
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_HEIGHT - 14, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(name, MARGIN, PAGE_HEIGHT - 9);
    doc.text(i18n.t('brochure.page', { n: page, total }), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, { align: 'right' });
  }
}

// ─── Documento ───────────────────────────────────────────────────────────────────────

/** Arma el brochure del desarrollo. Lanza si no puede construir el PDF (la interfaz muestra el error). */
export async function buildBrochurePdf({ i18n, units }: BrochureInput): Promise<QuoteDocument> {
  const { t } = i18n;
  const { name, brand, seo, render, project } = activeConfig;
  const palette = brandPalette();
  const typologies = units.length > 0 ? typologiesOf(units) : typologiesFromConfig();

  // La fachada de portada y la aérea del proyecto salen de las vistas del modo render (la variante WebP que ya se guarda sin
  // conexión); sin vistas, la imagen de portada del sitio.
  const imageViews = (render?.views ?? []).filter((view) => view.kind === 'facade' || view.kind === 'aerial');
  const facade = imageViews.find((view) => view.kind === 'facade');
  const aerial = imageViews.find((view) => view.kind === 'aerial');
  const coverSource = facade && 'image' in facade ? imageUrlForWidth(facade.image, COVER_PHOTO.maxWidth) : seo.ogImage;
  const bannerSource = aerial && 'image' in aerial ? imageUrlForWidth(aerial.image, BANNER_PHOTO.maxWidth) : null;

  // jsPDF, las fotos y los planos (que arrastran `react-dom/server`) solo se bajan al pedir el brochure.
  const [{ jsPDF }, logo, cover, banner, plans, amenityPhotos] = await Promise.all([
    import('jspdf'),
    loadLogo(brand.logo),
    coverSource ? loadPhoto(coverSource, { ...COVER_PHOTO, aspect: PAGE_WIDTH / COVER_PHOTO_HEIGHT, anchorY: 0.15 }) : Promise.resolve(null),
    bannerSource ? loadPhoto(bannerSource, { ...BANNER_PHOTO, aspect: CONTENT_WIDTH / BANNER_HEIGHT, anchorY: 0.45 }) : Promise.resolve(null),
    Promise.all(
      typologies.map(async (typology) => {
        if (!typology.sample) return null;
        const details = describeUnit(i18n, typology.sample);
        return renderPlanImage(details.polygon, details.floorPlan, i18n, PLAN_MAX_WIDTH);
      }),
    ),
    Promise.all(project.amenities.map((amenity) => (amenity.image ? loadPhoto(amenity.image, { ...AMENITY_PHOTO, aspect: (CONTENT_WIDTH - AMENITY_GAP * 2) / AMENITY_COLUMNS / AMENITY_IMAGE_HEIGHT }) : Promise.resolve(null))),
    ),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const issuedOn = i18n.dateLong(new Date());
  doc.setProperties({ title: t('brochure.title', { development: name }), subject: t('brochure.subject', { development: name }), author: name, creator: name });

  const layout: Layout = { doc, palette, logo, i18n, name, y: 0 };
  drawCover(layout, cover, issuedOn);

  doc.addPage();
  drawPageHeader(layout);
  drawProject(layout, banner);
  drawTypologies(layout, typologies, plans);
  drawAmenities(layout, amenityPhotos);
  drawPaymentsAndContact(layout, issuedOn);
  drawFooters(layout);

  // La portada es la primera página que ve quien lo abre.
  doc.setPage(1);
  return { blob: doc.output('blob'), filename: `${t('brochure.filePrefix')}-${slug(name)}.pdf` };
}
