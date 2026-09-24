import { useEffect, useState, type SVGProps } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AmenityIcon } from './AmenityIcons';
import { useEscapeKey } from '../lib/useEscapeKey';
import { usePresence } from '../lib/usePresence';
import { trackEvent } from '../lib/analytics';
import type { AuraOutletContext } from './AuraLayout';
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

function RecenterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  );
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

/**
 * Vista en grande de una amenidad: misma animación de dos tiempos que la ficha de unidad
 * — primero se acomoda el marco (deslizar + desvanecer), y la información de adentro
 * aparece un poco después con su propio desvanecido (`delay-100`), en vez de saltar junto
 * con el marco. Altura de imagen fija (`h-56`/`h-72`, no `max-h`+`object-cover` variable):
 * así la tarjeta no cambia de tamaño al pasar de una amenidad a otra con foto más alta o
 * más ancha. Escape cierra, igual que el resto de los paneles.
 */
function AmenityLightbox({ amenity, visible, hasPrev, hasNext, onPrev, onNext, onClose }: AmenityLightboxProps) {
  useEscapeKey(onClose, visible);

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center bg-black/50 transition-opacity duration-300 ease-elegant motion-reduce:transition-none sm:items-center ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl transition-[opacity,transform] duration-[350ms] ease-elegant motion-reduce:transition-none sm:rounded-2xl ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 sm:translate-y-4'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          <img src={amenity.image} alt={amenity.label} className="block h-56 w-full object-cover sm:h-72 sm:rounded-t-2xl" />
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
        <div
          className={`p-5 transition-opacity duration-[350ms] ease-elegant delay-100 motion-reduce:transition-none motion-reduce:delay-0 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
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
  const { developmentId } = useOutletContext<AuraOutletContext>();

  // Analítica (se vende como reporte mensual, ver /admin → Analítica): una vista por
  // carga de esta pestaña. `developmentId` solo llega una vez el fetch inicial de
  // AuraLayout.tsx resuelve, así que puede tardar un instante en dispararse si se entra
  // directo a /aura/proyecto antes de que cargue.
  useEffect(() => {
    if (!developmentId) return;
    trackEvent({ developmentId, type: 'project_view' });
  }, [developmentId]);

  // Solo las amenidades con imagen abren la vista en grande y se navegan entre sí — una
  // sin imagen (`amenity.image` ausente) se queda como tarjeta de solo ícono, sin romperse.
  const amenitiesWithImage = amenities.filter((amenity) => amenity.image);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { rendered: presentIndex, visible: lightboxVisible } = usePresence(openIndex, 350);
  const presentAmenity = presentIndex !== null ? amenitiesWithImage[presentIndex] : null;

  const [mapResetToken, setMapResetToken] = useState(0);

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
            {/* `flex flex-wrap justify-center` en vez de `grid`: con un número de amenidades
                que no es múltiplo exacto de columnas, un grid deja la última fila incompleta
                pegada a la izquierda (se siente desbalanceada) — flex-wrap centra esa última
                fila sola. El ancho de cada tarjeta replica a mano el ancho que tendría en un
                grid de 2/3 columnas con el mismo gap, así se ve idéntico cuando sí completa. */}
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {amenities.map((amenity) => {
                const imageIndex = amenitiesWithImage.indexOf(amenity);
                const openable = imageIndex !== -1;
                return (
                  <button
                    key={amenity.label}
                    type="button"
                    disabled={!openable}
                    onClick={() => setOpenIndex(imageIndex)}
                    className={`w-[calc(50%-0.375rem)] overflow-hidden rounded-xl bg-white text-left shadow-sm sm:w-[calc(33.333%-0.5rem)] ${openable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
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
          <div className="relative mt-2 overflow-hidden rounded-xl bg-white shadow-sm">
            {/* El embed de OpenStreetMap deja arrastrar y hacer zoom adentro del iframe —
                si el usuario se aleja del pin no hay forma de volver salvo recargarlo. `key`
                fuerza un remount (el iframe vuelve a pedir la misma URL desde cero, de
                regreso al recorte centrado en el pin) cada vez que se toca el botón. */}
            <iframe
              key={mapResetToken}
              title={`Ubicación de ${name}`}
              src={buildOsmEmbedUrl(location.lat, location.lng)}
              loading="lazy"
              className="h-64 w-full border-0 sm:h-80"
            />
            <button
              type="button"
              onClick={() => setMapResetToken((token) => token + 1)}
              aria-label="Volver a centrar el mapa en la ubicación"
              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-700 shadow-md hover:text-neutral-900"
            >
              <RecenterIcon className="h-4 w-4" />
            </button>
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
