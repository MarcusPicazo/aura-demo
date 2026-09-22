/**
 * Precio de una unidad según SPEC §3: precio base × (1 + 0.015 × (piso − 1)),
 * redondeado a miles.
 */
export function calculatePrice(priceBase: number, floor: number): number {
  const raw = priceBase * (1 + 0.015 * (floor - 1));
  return Math.round(raw / 1000) * 1000;
}

const priceFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `$6,450,000` — mismo formato que usa el mensaje de WhatsApp de SPEC §2. */
export function formatPrice(price: number): string {
  return priceFormatter.format(price);
}
