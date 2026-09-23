import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AuraOutletContext } from './AuraLayout';
import { polygonCentroid } from '../lib/geometry';
import { formatPrice } from '../lib/pricing';
import { useEscapeKey } from '../lib/useEscapeKey';
import { usePresence } from '../lib/usePresence';
import { useSelectionStore } from '../store/selectionStore';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

/**
 * SPEC §4.2: imagen conceptual de la fachada con un polígono SVG por piso (definidos
 * en `config.facade.floors`, en fracciones 0–1 de la imagen). Clic/tap muestra las
 * unidades disponibles de ese piso; un botón dentro de esa ficha lleva al selector 3D
 * con el piso enfocado. Deliberadamente sin preview por hover: un hover que autocierra
 * al salir el mouse entra en conflicto con un clic explícito (el mouse casi siempre
 * termina saliendo del polígono después de clicar), y en touch no hay hover de todos
 * modos — clic/tap corriendo la misma acción en los dos es más simple y no tiene ese bug.
 */
export function FacadeView() {
  const { units } = useOutletContext<AuraOutletContext>();
  const navigate = useNavigate();
  const setFocusedFloor = useSelectionStore((state) => state.setFocusedFloor);

  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const { image, floors } = auraConfig.facade;

  function handleViewInTower(floor: number) {
    setFocusedFloor(floor);
    navigate('/aura');
  }

  // Retiene el piso mostrado mientras la ficha se anima hacia afuera, en vez de vaciarse
  // de golpe apenas se cierra (ver `usePresence`).
  const { rendered: presentFloor, visible: floorCardVisible } = usePresence(activeFloor, 300);
  const activeUnits = presentFloor !== null ? units.filter((unit) => unit.floor === presentFloor) : [];
  const activeAvailableUnits = activeUnits.filter((unit) => unit.status === 'available');
  useEscapeKey(() => setActiveFloor(null), activeFloor !== null);

  return (
    <div className="flex h-dvh w-screen items-start justify-center overflow-y-auto bg-[var(--brand-background)] pt-20 pb-8">
      <div className="relative w-full max-w-2xl px-4">
        {/* Antes: fondo casi negro (`bg-neutral-900`/`bg-neutral-800`) alrededor de la
            imagen — como la foto casi nunca comparte el aspect ratio del viewport, ese
            fondo se veía como barras negras a los lados o arriba/abajo. Con el color de
            marca en vez de negro, esas mismas barras se sienten intencionales. */}
        <div className="relative overflow-hidden rounded-2xl bg-[var(--brand-background)] shadow-2xl">
          {!imageFailed ? (
            <img
              src={image}
              alt={`Fachada de ${auraConfig.name} (imagen conceptual)`}
              className="block w-full"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-300 p-6 text-center">
              <p className="text-sm font-medium text-neutral-600">Todavía no hay imagen de fachada</p>
              <p className="text-xs text-neutral-500">
                Agrega tu archivo en <code className="text-neutral-600">public{image}</code>
              </p>
            </div>
          )}

          {floors.length > 0 && (
            <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              {floors.map((floorConfig) => {
                const isActive = activeFloor === floorConfig.floor;
                const [labelX, labelY] = polygonCentroid(floorConfig.polygon);
                return (
                  <g key={floorConfig.floor}>
                    <polygon
                      points={floorConfig.polygon.map(([x, y]) => `${x},${y}`).join(' ')}
                      onClick={() => setActiveFloor(isActive ? null : floorConfig.floor)}
                      className={`cursor-pointer ${
                        isActive
                          ? 'fill-[var(--brand-accent)]/35 stroke-[var(--brand-accent)]'
                          : 'fill-white/0 stroke-white/50 hover:fill-white/15'
                      }`}
                      strokeWidth={0.0025}
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      className="pointer-events-none select-none fill-white text-[0.02px] font-medium"
                    >
                      {floorConfig.floor}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          <p className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
            Imágenes conceptuales ilustrativas
          </p>
        </div>

        {presentFloor !== null && (
          <div
            className={`mt-4 rounded-xl bg-white p-4 shadow-lg transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
              floorCardVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            {/* Igual que la ficha de unidad: el marco de la tarjeta se acomoda primero,
                la información espera 100ms más y solo se desvanece — se siente en dos
                tiempos suaves, no todo junto de golpe. */}
            <div
              className={`transition-opacity duration-300 ease-out delay-100 motion-reduce:transition-none motion-reduce:delay-0 ${
                floorCardVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-serif text-lg text-neutral-900">Piso {presentFloor}</p>
                <button
                  type="button"
                  onClick={() => setActiveFloor(null)}
                  aria-label="Cerrar"
                  className="text-xl leading-none text-neutral-400 hover:text-neutral-700"
                >
                  &times;
                </button>
              </div>

              {activeAvailableUnits.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                  {activeAvailableUnits.map((unit) => (
                    <li key={unit.code} className="flex justify-between">
                      <span>Unidad {unit.code}</span>
                      <span>{formatPrice(unit.price)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">Sin unidades disponibles en este piso.</p>
              )}

              <button
                type="button"
                onClick={() => handleViewInTower(presentFloor)}
                className="mt-3 w-full rounded-full bg-[var(--brand-primary)] py-2 text-sm font-medium text-white"
              >
                Ver piso en la torre 3D
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
