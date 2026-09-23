import { useState } from 'react';
import { calculatePaymentPlan, formatPrice } from '../lib/pricing';
import type { PaymentPlanConfig } from '../types';

const deliveryDateFormatter = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

/** `new Date('2028-03-01')` se interpreta en UTC y puede correrse un día en México (UTC-6);
 *  se arma la fecha local a mano para que el mes mostrado sea siempre el de la config. */
function formatDeliveryDate(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  return deliveryDateFormatter.format(new Date(year, month - 1, 1));
}

interface PaymentScheduleProps {
  price: number;
  plan: PaymentPlanConfig;
}

/**
 * Esquema de pagos de la unidad: enganche (ajustable con un control), mensualidades durante
 * la obra y saldo contra entrega. Todos los parámetros vienen de `plan` (config del
 * cliente) — nada de porcentajes ni meses fijos aquí.
 */
export function PaymentSchedule({ price, plan }: PaymentScheduleProps) {
  const [downPaymentPercent, setDownPaymentPercent] = useState(plan.downPaymentPercent);
  const schedule = calculatePaymentPlan(price, downPaymentPercent, plan.balanceAtDeliveryPercent, plan.constructionMonths);

  return (
    <div className="mt-4 rounded-lg bg-neutral-50 p-4">
      <p className="text-sm font-medium text-neutral-700">Esquema de pagos</p>

      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <label htmlFor="down-payment-percent" className="text-neutral-500">
            Enganche ({downPaymentPercent}%)
          </label>
          <span className="font-medium text-neutral-900">{formatPrice(schedule.downPayment)}</span>
        </div>
        <input
          id="down-payment-percent"
          type="range"
          min={plan.minDownPaymentPercent}
          max={plan.maxDownPaymentPercent}
          value={downPaymentPercent}
          onChange={(event) => setDownPaymentPercent(Number(event.target.value))}
          className="mt-1.5 w-full accent-[var(--brand-accent)]"
        />
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">{schedule.monthsCount} mensualidades</dt>
          <dd className="font-medium text-neutral-900">{formatPrice(schedule.monthlyPayment)} c/u</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Saldo contra entrega</dt>
          <dd className="font-medium text-neutral-900">{formatPrice(schedule.balanceAtDelivery)}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-neutral-400">Entrega estimada: {formatDeliveryDate(plan.deliveryDate)}</p>
    </div>
  );
}
