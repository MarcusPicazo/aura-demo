import { useEffect, useState } from 'react';
import { ageOf } from '../lib/inventoryCache';
import { useI18n } from '../i18n/useI18n';
import { usePwaStore } from '../store/pwaStore';

/** La hora actual, refrescada cada `everyMs`: para que "hace 3 min" siga siendo cierto con la pantalla quieta. */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * Aviso discreto de que el inventario que se ve no es el más reciente: "Sin conexión · datos de hace 3 h". Aparece solo si lo que
 * se muestra salió del último guardado en el dispositivo (o no hay red); con datos frescos y red no pinta nada. Vive junto al
 * contador de unidades, que es lo que depende de esos datos.
 */
export function OfflineNotice({ className = 'mt-1 text-[11px] text-amber-700' }: { className?: string }) {
  const { t } = useI18n();
  const online = usePwaStore((state) => state.online);
  const { source, syncedAt } = usePwaStore((state) => state.inventory);
  const now = useNow(30_000);
  if (syncedAt === null || (source === 'network' && online)) return null;

  const age = ageOf(syncedAt, now);
  const ageText =
    age.unit === 'moment'
      ? t('offline.ageMoment')
      : age.unit === 'minutes'
        ? t('offline.ageMinutes', { count: age.count })
        : age.unit === 'hours'
          ? t('offline.ageHours', { count: age.count })
          : t('offline.ageDays', { count: age.count });
  return (
    <p role="status" className={className}>
      {online ? t('offline.reconnecting', { age: ageText }) : t('offline.notice', { age: ageText })}
    </p>
  );
}
