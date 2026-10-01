const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatRelativeExpiry(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'Vencido';
  const hours = Math.round(diffMs / 3600_000);
  if (hours < 24) return `${hours} h restantes`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'día' : 'días'} restantes`;
}
