import type { I18n } from '../i18n/useI18n';
import type { Unit } from '../types';

/** El precio de la unidad para un mensaje: en dólares va acompañado del precio oficial en pesos, que es el que cuenta. */
export function messagePrice(i18n: I18n, price: number): string {
  return i18n.isReferential
    ? i18n.t('whatsapp.priceReferential', { amount: i18n.money(price), mxn: i18n.moneyMxn(price) })
    : i18n.money(price);
}

/** SPEC §2: "Hola, me interesa el departamento 804 (Tipo A, 85 m², $6,450,000) de Torre Aura Del Valle." */
export function buildInterestMessage(i18n: I18n, unit: Unit, developmentName: string): string {
  return i18n.t('whatsapp.interest', {
    code: unit.code,
    type: unit.type,
    m2: unit.m2,
    price: messagePrice(i18n, unit.price),
    development: developmentName,
  });
}

function unitReference(i18n: I18n, unit: Unit): string {
  return i18n.t('whatsapp.unitRef', { code: unit.code, type: unit.type, m2: unit.m2, price: messagePrice(i18n, unit.price) });
}

/** Mensaje de la ficha de contacto: incluye la unidad seleccionada si hay una, para que el
 *  asesor no tenga que preguntar de cuál departamento se trata. */
export function buildAdvisorMessage(i18n: I18n, developmentName: string, unit: Unit | null): string {
  return unit
    ? i18n.t('whatsapp.advisorUnit', { unit: unitReference(i18n, unit), development: developmentName })
    : i18n.t('whatsapp.advisorGeneral', { development: developmentName });
}

/** No hay agenda/CRM real conectado (fuera de alcance, SPEC §4.4) — "agendar visita" abre
 *  el mismo canal de WhatsApp que el resto de la demo, con un mensaje distinto. */
export function buildScheduleVisitMessage(i18n: I18n, developmentName: string, unit: Unit | null): string {
  return unit
    ? i18n.t('whatsapp.visitUnit', { unit: unitReference(i18n, unit), development: developmentName })
    : i18n.t('whatsapp.visitGeneral', { development: developmentName });
}

/** `phone` en formato E.164 sin "+" (como se guarda en `config.whatsapp`, ej. 5215500000000). */
export function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
