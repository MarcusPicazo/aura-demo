import { formatPrice } from './pricing';
import type { Unit } from '../types';

/** SPEC §2: "Hola, me interesa el departamento 804 (Tipo A, 85 m², $6,450,000) de Torre Aura Del Valle." */
export function buildInterestMessage(unit: Unit, developmentName: string): string {
  return `Hola, me interesa el departamento ${unit.code} (Tipo ${unit.type}, ${unit.m2} m², ${formatPrice(unit.price)}) de ${developmentName}.`;
}

function unitReference(unit: Unit): string {
  return `el departamento ${unit.code} (Tipo ${unit.type}, ${unit.m2} m², ${formatPrice(unit.price)})`;
}

/** Mensaje de la ficha de contacto: incluye la unidad seleccionada si hay una, para que el
 *  asesor no tenga que preguntar de cuál departamento se trata. */
export function buildAdvisorMessage(developmentName: string, unit: Unit | null): string {
  return unit
    ? `Hola, quiero más información sobre ${unitReference(unit)} de ${developmentName}.`
    : `Hola, quiero más información sobre ${developmentName}.`;
}

/** No hay agenda/CRM real conectado (fuera de alcance, SPEC §4.4) — "agendar visita" abre
 *  el mismo canal de WhatsApp que el resto de la demo, con un mensaje distinto. */
export function buildScheduleVisitMessage(developmentName: string, unit: Unit | null): string {
  return unit
    ? `Hola, quiero agendar una visita para ver ${unitReference(unit)} de ${developmentName}.`
    : `Hola, quiero agendar una visita a ${developmentName}.`;
}

/** `phone` en formato E.164 sin "+" (como se guarda en `config.whatsapp`, ej. 5215500000000). */
export function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
