import { useFiltersStore } from '../store/filtersStore';

/**
 * Por default la torre se ve como el edificio real (materiales de `config.materials`);
 * este botón activa el tinte por estado (verde/ámbar/gris) en la torre. Cualquier filtro
 * activo lo activa también — eso se resuelve en `Selector3D` (`availabilityMode`), aquí solo
 * se lee/escribe el toggle manual.
 */
export function AvailabilityToggle() {
  const showAvailability = useFiltersStore((state) => state.showAvailability);
  const toggleShowAvailability = useFiltersStore((state) => state.toggleShowAvailability);

  return (
    <button
      type="button"
      onClick={toggleShowAvailability}
      aria-pressed={showAvailability}
      className={`pointer-events-auto rounded-xl px-2.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur sm:px-3 sm:py-2 sm:text-sm ${
        showAvailability ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--brand-background)]/95 text-neutral-900'
      }`}
    >
      Ver disponibilidad
    </button>
  );
}
