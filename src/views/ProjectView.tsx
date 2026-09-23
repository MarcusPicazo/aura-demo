import { AmenityIcon } from './AmenityIcons';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

/** Recorte alrededor del punto, en grados: suficiente para ver la colonia sin acercarse
 *  tanto que el mapa quede en blanco si el punto no es exacto. */
const MAP_BBOX_DELTA = 0.008;

function buildOsmEmbedUrl(lat: number, lng: number): string {
  const bbox = [lng - MAP_BBOX_DELTA, lat - MAP_BBOX_DELTA, lng + MAP_BBOX_DELTA, lat + MAP_BBOX_DELTA].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
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

  return (
    <div className="h-dvh w-screen overflow-y-auto bg-neutral-50 pt-20 pb-8">
      <div className="mx-auto w-full max-w-2xl px-4">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">{name}</p>
        <h1 className="font-serif text-2xl text-neutral-900">{tagline}</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700">{description}</p>

        {amenities.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-neutral-500">Amenidades</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {amenities.map((amenity) => (
                <div key={amenity.label} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
                  <AmenityIcon name={amenity.icon} className="h-6 w-6 shrink-0 text-neutral-700" />
                  <span className="text-sm text-neutral-800">{amenity.label}</span>
                </div>
              ))}
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
    </div>
  );
}
