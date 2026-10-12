import { calculatePaymentPlan } from '../lib/pricing';
import { useI18n } from '../i18n/useI18n';
import type { PaymentPlanConfig } from '../types';

interface PaymentScheduleProps {
  price: number;
  plan: PaymentPlanConfig;
  /** Enganche elegido (%): lo controla quien muestra el esquema, porque la cotización en PDF debe usar el mismo. */
  downPaymentPercent: number;
  onDownPaymentChange: (percent: number) => void;
}

/**
 * Esquema de pagos de la unidad: enganche (ajustable con un control), mensualidades durante
 * la obra y saldo contra entrega. Todos los parámetros vienen de `plan` (config del
 * cliente) — nada de porcentajes ni meses fijos aquí.
 */
export function PaymentSchedule({ price, plan, downPaymentPercent, onDownPaymentChange }: PaymentScheduleProps) {
  const { t, money, monthYear } = useI18n();
  const schedule = calculatePaymentPlan(price, downPaymentPercent, plan.balanceAtDeliveryPercent, plan.constructionMonths);

  return (
    <div className="mt-4 rounded-lg bg-neutral-50 p-4">
      <p className="text-sm font-medium text-neutral-700">{t('payment.title')}</p>

      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <label htmlFor="down-payment-percent" className="text-neutral-500">
            {t('payment.downPayment', { percent: downPaymentPercent })}
          </label>
          <span className="font-medium text-neutral-900">{money(schedule.downPayment)}</span>
        </div>
        <input
          id="down-payment-percent"
          type="range"
          min={plan.minDownPaymentPercent}
          max={plan.maxDownPaymentPercent}
          value={downPaymentPercent}
          onChange={(event) => onDownPaymentChange(Number(event.target.value))}
          className="mt-1 h-6 w-full accent-[var(--brand-accent)]"
        />
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t('payment.monthly', { count: schedule.monthsCount })}</dt>
          <dd className="font-medium text-neutral-900">{t('payment.each', { amount: money(schedule.monthlyPayment) })}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t('payment.balance')}</dt>
          <dd className="font-medium text-neutral-900">{money(schedule.balanceAtDelivery)}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-neutral-400">{t('payment.delivery', { date: monthYear(plan.deliveryDate) })}</p>
    </div>
  );
}
