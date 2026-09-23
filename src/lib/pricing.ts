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

export interface PaymentPlan {
  downPayment: number;
  monthlyPayment: number;
  monthsCount: number;
  balanceAtDelivery: number;
}

/**
 * Enganche + saldo contra entrega (fijo, normalmente crédito) + mensualidades durante la
 * obra, que cubren lo que sobra del precio después de esos dos — por eso mover el enganche
 * cambia la mensualidad, nunca el saldo contra entrega.
 */
export function calculatePaymentPlan(
  price: number,
  downPaymentPercent: number,
  balanceAtDeliveryPercent: number,
  constructionMonths: number,
): PaymentPlan {
  const downPayment = Math.round((price * downPaymentPercent) / 100);
  const balanceAtDelivery = Math.round((price * balanceAtDeliveryPercent) / 100);
  const monthlyTotal = Math.max(0, price - downPayment - balanceAtDelivery);
  const monthlyPayment = constructionMonths > 0 ? Math.round(monthlyTotal / constructionMonths) : 0;
  return { downPayment, monthlyPayment, monthsCount: constructionMonths, balanceAtDelivery };
}
