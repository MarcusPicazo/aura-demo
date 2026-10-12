import { buildWhatsappLink } from './whatsapp';
import { messagePrice } from './whatsapp';
import type { I18n } from '../i18n/useI18n';
import type { QuoteDocument } from './quotePdf';
import type { Unit } from '../types';

/** Descarga el archivo en el dispositivo (un enlace temporal al blob, el mismo gesto que un clic en un `<a download>`). */
export function downloadQuote({ blob, filename }: QuoteDocument): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // El navegador necesita un instante para empezar la descarga antes de soltar el blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Lo que se escribe al mandar la cotización: dice de qué unidad es, para que quien la reciba no tenga que preguntar. */
export function buildQuoteMessage(i18n: I18n, unit: Unit, developmentName: string): string {
  return i18n.t('whatsapp.quote', { code: unit.code, type: unit.type, m2: unit.m2, price: messagePrice(i18n, unit.price), development: developmentName });
}

export type QuoteShareOutcome =
  /** Se abrió el menú de compartir del dispositivo con el PDF adjunto (el usuario eligió WhatsApp u otra app). */
  | 'shared'
  /** El usuario cerró el menú de compartir sin elegir nada. */
  | 'cancelled'
  /** El dispositivo no puede compartir archivos: se descargó el PDF y se abrió el chat del asesor con el mensaje listo. */
  | 'fallback';

/**
 * Envía la cotización por WhatsApp. Un enlace de WhatsApp no puede adjuntar archivos, así que primero se intenta el
 * menú de compartir del sistema (adjunta el PDF y deja elegir WhatsApp y el chat); si el dispositivo no lo permite,
 * se descarga el PDF y se abre el chat del asesor con el mensaje prellenado para que lo adjunte.
 *
 * Debe llamarse directo desde el clic del usuario, con el PDF ya listo: el menú de compartir y la apertura de
 * ventanas exigen un gesto reciente, y esperar a generar el archivo después del clic los haría fallar.
 */
export async function shareQuoteViaWhatsapp(i18n: I18n, quote: QuoteDocument, message: string, advisorPhone: string): Promise<QuoteShareOutcome> {
  const file = new File([quote.blob], quote.filename, { type: 'application/pdf' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message, title: quote.filename });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Cualquier otro fallo (sin permiso, sin app que reciba el archivo): se sigue con el plan B.
    }
  }
  downloadQuote(quote);
  window.open(buildWhatsappLink(advisorPhone, `${message}\n\n${i18n.t('whatsapp.quoteAttach')}`), '_blank', 'noopener,noreferrer');
  return 'fallback';
}
