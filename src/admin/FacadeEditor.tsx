import { useState, type MouseEvent } from 'react';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig, FacadeFloorConfig, Point } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;
const DRAFT_KEY = 'aura-facade-editor-draft';

function loadInitialFloors(): FacadeFloorConfig[] {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) return JSON.parse(saved) as FacadeFloorConfig[];
  } catch {
    // localStorage puede fallar (modo privado, etc.); seguimos con la config.
  }
  return auraConfig.facade.floors;
}

function saveDraft(floors: FacadeFloorConfig[]): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(floors));
  } catch {
    // No es crítico: en el peor caso, un refresh pierde el borrador.
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function nextFloorNumber(floors: FacadeFloorConfig[]): number {
  return floors.reduce((max, f) => Math.max(max, f.floor), 0) + 1;
}

/**
 * Herramienta de admin (no es parte del selector público): dibuja con clics el polígono
 * de cada piso sobre la imagen de fachada y exporta el JSON de `config.facade.floors`
 * para pegar en `src/config/aura.json`. Un navegador no puede escribir el archivo del
 * proyecto directamente, así que el resultado es texto para copiar, no un guardado automático.
 */
export function FacadeEditor() {
  const [floors, setFloors] = useState<FacadeFloorConfig[]>(loadInitialFloors);
  const [currentFloor, setCurrentFloor] = useState(() => nextFloorNumber(loadInitialFloors()));
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  function updateFloors(next: FacadeFloorConfig[]) {
    setFloors(next);
    saveDraft(next);
  }

  function handleImageClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    setCurrentPoints((points) => [...points, [x, y]]);
  }

  function handleUndoPoint() {
    setCurrentPoints((points) => points.slice(0, -1));
  }

  function handleCancelFloor() {
    setCurrentPoints([]);
  }

  function handleFinishFloor() {
    if (currentPoints.length < 3) return;
    const next = [...floors.filter((f) => f.floor !== currentFloor), { floor: currentFloor, polygon: currentPoints }];
    updateFloors(next);
    setCurrentPoints([]);
    setCurrentFloor(nextFloorNumber(next));
  }

  function handleDeleteFloor(floor: number) {
    updateFloors(floors.filter((f) => f.floor !== floor));
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sortedFloors = [...floors].sort((a, b) => a.floor - b.floor);
  const exportJson = JSON.stringify(sortedFloors, null, 2);

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
      <div>
        <p className="mb-2 text-sm text-neutral-600">
          Piso actual: <strong>{currentFloor}</strong> — haz clic sobre la imagen para agregar vértices del polígono
          (mínimo 3).
        </p>

        <div className="relative overflow-hidden rounded-xl bg-neutral-200" onClick={handleImageClick}>
          {!imageFailed ? (
            <img
              src={auraConfig.facade.image}
              alt="Fachada"
              className="block w-full select-none"
              draggable={false}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-400 p-6 text-center">
              <p className="text-sm font-medium text-neutral-600">Todavía no hay imagen de fachada</p>
              <p className="text-xs text-neutral-500">
                Agrega tu archivo en <code>public{auraConfig.facade.image}</code>. Puedes seguir probando la
                herramienta sobre este marcador mientras tanto.
              </p>
            </div>
          )}

          <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            {sortedFloors.map((floorConfig) => (
              <polygon
                key={floorConfig.floor}
                points={floorConfig.polygon.map(([x, y]) => `${x},${y}`).join(' ')}
                className="fill-emerald-500/25 stroke-emerald-600"
                strokeWidth={0.003}
              />
            ))}

            {currentPoints.length > 0 && (
              <polyline
                points={currentPoints.map(([x, y]) => `${x},${y}`).join(' ')}
                className="fill-amber-400/25 stroke-amber-500"
                strokeWidth={0.003}
              />
            )}
            {currentPoints.map(([x, y], index) => (
              <circle key={index} cx={x} cy={y} r={0.006} className="fill-amber-500" />
            ))}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleUndoPoint}
            disabled={currentPoints.length === 0}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-40"
          >
            Deshacer punto
          </button>
          <button
            type="button"
            onClick={handleCancelFloor}
            disabled={currentPoints.length === 0}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-40"
          >
            Cancelar piso actual
          </button>
          <button
            type="button"
            onClick={handleFinishFloor}
            disabled={currentPoints.length < 3}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Cerrar piso {currentFloor}
          </button>
          <label className="ml-auto flex items-center gap-2 text-xs text-neutral-600">
            Número de piso
            <input
              type="number"
              value={currentFloor}
              onChange={(event) => setCurrentFloor(Number(event.target.value))}
              className="w-16 rounded border border-neutral-300 px-2 py-1"
            />
          </label>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Pisos definidos</h2>
        {sortedFloors.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Ninguno todavía.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {sortedFloors.map((floorConfig) => (
              <li key={floorConfig.floor} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-1.5 text-sm">
                <span>
                  Piso {floorConfig.floor} — {floorConfig.polygon.length} vértices
                </span>
                <button type="button" onClick={() => handleDeleteFloor(floorConfig.floor)} className="text-xs text-red-600 underline">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-neutral-500">Exportar</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Pega esto como el valor de <code>facade.floors</code> en <code>src/config/aura.json</code>.
        </p>
        <textarea readOnly value={exportJson} rows={12} className="mt-2 w-full rounded-lg border border-neutral-300 p-2 font-mono text-xs" />
        <button
          type="button"
          onClick={handleCopy}
          disabled={sortedFloors.length === 0}
          className="mt-2 w-full rounded-full border border-neutral-900 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          {copied ? '¡Copiado!' : 'Copiar JSON'}
        </button>
      </div>
    </div>
  );
}
