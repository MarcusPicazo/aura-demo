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
      className={`pointer-events-auto rounded-xl px-3 py-2 text-sm font-medium shadow-lg backdrop-blur ${
        showAvailability ? 'bg-neutral-900 text-white' : 'bg-white/95 text-neutral-900'
      }`}
    >
      Ver disponibilidad
    </button>
  );
}
