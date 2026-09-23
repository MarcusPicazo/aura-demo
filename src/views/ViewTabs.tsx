import { Link, useLocation } from 'react-router-dom';

/** SPEC §4.2: la vista de fachada es "una segunda pestaña" junto al selector 3D; la
 *  sección de proyecto (descripción, amenidades, ubicación) es la tercera. */
export function ViewTabs() {
  const location = useLocation();
  const isFacade = location.pathname.startsWith('/aura/fachada');
  const isProject = location.pathname.startsWith('/aura/proyecto');
  const isTower = !isFacade && !isProject;

  function tabClass(active: boolean): string {
    return `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-[var(--brand-primary)] text-white' : 'text-neutral-600 hover:bg-neutral-100'
    }`;
  }

  return (
    <nav className="fixed left-1/2 top-4 z-20 flex -translate-x-1/2 gap-1 rounded-full bg-[var(--brand-background)]/95 p-1 shadow-lg backdrop-blur">
      <Link to="/aura" className={tabClass(isTower)}>
        Torre 3D
      </Link>
      <Link to="/aura/fachada" className={tabClass(isFacade)}>
        Fachada
      </Link>
      <Link to="/aura/proyecto" className={tabClass(isProject)}>
        Proyecto
      </Link>
    </nav>
  );
}
