import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AuraOutletContext } from './AuraLayout';
import { polygonCentroid } from '../lib/geometry';
import { formatPrice } from '../lib/pricing';
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

  const activeUnits = activeFloor !== null ? units.filter((unit) => unit.floor === activeFloor) : [];
  const activeAvailableUnits = activeUnits.filter((unit) => unit.status === 'available');

  return (
    <div className="flex h-dvh w-screen items-start justify-center overflow-y-auto bg-neutral-900 pt-20 pb-8">
      <div className="relative w-full max-w-2xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-neutral-800 shadow-2xl">
          {!imageFailed ? (
            <img
              src={image}
              alt={`Fachada de ${auraConfig.name} (imagen conceptual)`}
              className="block w-full"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-600 p-6 text-center">
              <p className="text-sm font-medium text-neutral-300">Todavía no hay imagen de fachada</p>
              <p className="text-xs text-neutral-500">
                Agrega tu archivo en <code className="text-neutral-400">public{image}</code>
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
                      className={`cursor-pointer ${isActive ? 'fill-white/35 stroke-white' : 'fill-white/0 stroke-white/50 hover:fill-white/15'}`}
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

        {activeFloor !== null && (
          <div className="mt-4 rounded-xl bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="font-serif text-lg text-neutral-900">Piso {activeFloor}</p>
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
              onClick={() => handleViewInTower(activeFloor)}
              className="mt-3 w-full rounded-full bg-neutral-900 py-2 text-sm font-medium text-white"
            >
              Ver piso en la torre 3D
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
