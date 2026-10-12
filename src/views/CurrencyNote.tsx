import { useI18n } from '../i18n/useI18n';

/**
 * Aviso de que los precios que se ven están en dólares y son referenciales (tipo de cambio de `config.currency`).
 * No pinta nada cuando se ven en pesos, que es el precio oficial.
 */
export function CurrencyNote({ className = 'mt-1 text-xs text-neutral-500' }: { className?: string }) {
  const { t, isReferential, rateText, rateDateText } = useI18n();
  if (!isReferential) return null;
  return <p className={className}>{t('currency.note', { rate: rateText, date: rateDateText })}</p>;
}
