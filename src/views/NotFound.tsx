import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import { homePath } from '../lib/unitDetails';

/** Cualquier dirección que no existe. Sin esto React Router no pintaba nada: pantalla en blanco. */
export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-neutral-50 p-6 text-center">
      <h1 className="font-serif text-xl text-neutral-900">{t('errors.notFoundTitle')}</h1>
      <p className="max-w-sm text-sm text-neutral-600">{t('errors.notFoundBody')}</p>
      <Link to={homePath()} className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white">
        {t('errors.notFoundHome')}
      </Link>
    </div>
  );
}
