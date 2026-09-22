import { formatPrice } from './pricing';
import type { Unit } from '../types';

/** SPEC §2: "Hola, me interesa el departamento 804 (Tipo A, 85 m², $6,450,000) de Torre Aura Del Valle." */
export function buildInterestMessage(unit: Unit, developmentName: string): string {
  return `Hola, me interesa el departamento ${unit.code} (Tipo ${unit.type}, ${unit.m2} m², ${formatPrice(unit.price)}) de ${developmentName}.`;
}

/** `phone` en formato E.164 sin "+" (como se guarda en `config.whatsapp`, ej. 5215500000000). */
export function buildWhatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
