import { useState } from 'react';
import { AmenityIcon } from './AmenityIcons';
import { usePresence } from '../lib/usePresence';
import auraConfigJson from '../config/aura.json';
import type { AmenityConfig, DevelopmentConfig } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

/** Recorte alrededor del punto, en grados: suficiente para ver la colonia sin acercarse
 *  tanto que el mapa quede en blanco si el punto no es exacto. */
const MAP_BBOX_DELTA = 0.008;

function buildOsmEmbedUrl(lat: number, lng: number): string {
  const bbox = [lng - MAP_BBOX_DELTA, lat - MAP_BBOX_DELTA, lng + MAP_BBOX_DELTA, lat + MAP_BBOX_DELTA].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

interface AmenityLightboxProps {
  amenity: AmenityConfig;
  visible: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/** Vista en grande de una amenidad: misma animación (deslizar + desvanecer) que la ficha
 *  de unidad y la ficha de piso en fachada — desde abajo en móvil, con un fundido más
 *  sutil en escritorio. */
function AmenityLightbox({ amenity, visible, hasPrev, hasNext, onPrev, onNext, onClose }: AmenityLightboxProps) {
  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none sm:items-center ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:rounded-2xl ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 sm:translate-y-4'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          <img src={amenity.image} alt={amenity.label} className="block max-h-[50dvh] w-full object-cover sm:rounded-t-2xl" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xl leading-none text-neutral-600 shadow hover:text-neutral-900"
          >
            &times;
          </button>
          {hasPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Amenidad anterior"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl leading-none text-neutral-700 shadow hover:text-neutral-900"
            >
              &lsaquo;
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Siguiente amenidad"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl leading-none text-neutral-700 shadow hover:text-neutral-900"
            >
              &rsaquo;
            </button>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2">
            <AmenityIcon name={amenity.icon} className="h-5 w-5 shrink-0 text-[var(--brand-primary)]" />
            <p className="font-serif text-lg text-neutral-900">{amenity.label}</p>
          </div>
          {amenity.description && <p className="mt-2 text-sm leading-relaxed text-neutral-600">{amenity.description}</p>}
          <p className="mt-4 text-xs text-neutral-400">Imágenes conceptuales ilustrativas</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Sección de proyecto: descripción corta, amenidades con ícono y un mapa embebido con la
 * ubicación y puntos de interés cercanos — todo `config.project` (config del cliente).
 * Accesible desde la pestaña "Proyecto" de `ViewTabs`; la ruta que monta esta vista ya
 * está cargada de forma diferida (`lazy()` en App.tsx), igual que la vista de fachada.
 */
export function ProjectView() {
  const { name, tagline, project } = auraConfig;
  const { description, amenities, location, pointsOfInterest } = project;

  // Solo las amenidades con imagen abren la vista en grande y se navegan entre sí — una
  // sin imagen (`amenity.image` ausente) se queda como tarjeta de solo ícono, sin romperse.
  const amenitiesWithImage = amenities.filter((amenity) => amenity.image);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { rendered: presentIndex, visible: lightboxVisible } = usePresence(openIndex, 300);
  const presentAmenity = presentIndex !== null ? amenitiesWithImage[presentIndex] : null;

  return (
    <div className="h-dvh w-screen overflow-y-auto bg-neutral-50 pt-20 pb-8">
      <div className="animate-panel-enter mx-auto w-full max-w-2xl px-4">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">{name}</p>
        <h1 className="font-serif text-2xl text-neutral-900">{tagline}</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700">{description}</p>

        {amenities.length > 0 && (
          <div className="mt-6">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-neutral-500">Amenidades</p>
              <p className="text-xs text-neutral-400">Imágenes conceptuales ilustrativas</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {amenities.map((amenity) => {
                const imageIndex = amenitiesWithImage.indexOf(amenity);
                const openable = imageIndex !== -1;
                return (
                  <button
                    key={amenity.label}
                    type="button"
                    disabled={!openable}
                    onClick={() => setOpenIndex(imageIndex)}
                    className={`overflow-hidden rounded-xl bg-white text-left shadow-sm ${openable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
                  >
                    {amenity.image && (
                      <img
                        src={amenity.image}
                        alt=""
                        loading="lazy"
                        className="h-24 w-full object-cover sm:h-28"
                      />
                    )}
                    <div className="flex items-center gap-2 p-3">
                      <AmenityIcon name={amenity.icon} className="h-5 w-5 shrink-0 text-neutral-700" />
                      <span className="text-sm text-neutral-800">{amenity.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-500">Ubicación</p>
          <div className="mt-2 overflow-hidden rounded-xl bg-white shadow-sm">
            <iframe
              title={`Ubicación de ${name}`}
              src={buildOsmEmbedUrl(location.lat, location.lng)}
              loading="lazy"
              className="h-64 w-full border-0 sm:h-80"
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">{location.address}</p>
        </div>

        {pointsOfInterest.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-neutral-500">Puntos de interés cercanos</p>
            <ul className="mt-2 divide-y divide-neutral-200 rounded-xl bg-white shadow-sm">
              {pointsOfInterest.map((poi) => (
                <li key={poi.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-neutral-800">{poi.name}</span>
                  {poi.distanceMinutes !== undefined && (
                    <span className="text-neutral-500">{poi.distanceMinutes} min caminando</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {presentAmenity && (
        <AmenityLightbox
          amenity={presentAmenity}
          visible={lightboxVisible}
          hasPrev={amenitiesWithImage.length > 1}
          hasNext={amenitiesWithImage.length > 1}
          onPrev={() => setOpenIndex((current) => (current === null ? null : (current - 1 + amenitiesWithImage.length) % amenitiesWithImage.length))}
          onNext={() => setOpenIndex((current) => (current === null ? null : (current + 1) % amenitiesWithImage.length))}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}
