import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { activeConfig } from '../config/active';
import { useI18n } from '../i18n/useI18n';
import { availableModes } from '../lib/modes';
import { RENDER_BASE_PATH } from '../lib/render';
import { webglSupported } from '../lib/webgl';

const rendersAvailable = availableModes(activeConfig).render;

/**
 * Deja pasar al selector 3D solo si el navegador tiene WebGL. Si no: los renders (que dan lo mismo en imágenes) cuando el
 * desarrollo los tiene, o una explicación clara. Antes el Canvas fallaba al montarse y quedaba el aviso genérico de error.
 */
export function WebGLGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  if (webglSupported()) return <>{children}</>;
  if (rendersAvailable) return <Navigate to={RENDER_BASE_PATH} replace />;
  return (
    <div role="alert" className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center">
      <h1 className="font-serif text-xl text-neutral-900">{t('errors.noWebglTitle')}</h1>
      <p className="max-w-sm text-sm text-neutral-600">{t('errors.noWebglBody')}</p>
    </div>
  );
}
