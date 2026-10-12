import { useI18n } from '../i18n/useI18n';

/**
 * `inline` (rutas anidadas) ocupa solo el lugar del contenido y deja a la vista el encabezado y la navegación; sin él cubre la pantalla.
 * Lo que se ve mientras baja el código de una pantalla (se carga bajo demanda) o se revisa la sesión del admin/portal. Antes eso
 * era `null`: una pantalla en blanco sin ninguna señal de que algo estuviera pasando. Neutral a propósito (no depende de la marca):
 * lo usan también el panel de administración y el portal.
 */
export function RouteFallback({ inline = false }: { inline?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 text-neutral-500 ${inline ? 'min-h-[40dvh] py-16' : 'fixed inset-0 z-[5] bg-neutral-50'}`}
    >
      <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 motion-reduce:animate-none" />
      <span className="text-sm">{t('common.loading')}</span>
    </div>
  );
}
