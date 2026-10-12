import { esText } from '../i18n/localized';
import { useState, type MouseEvent } from 'react';
import { buildImageSources, isImageBacked, planFloors, resolveSurface } from '../lib/render';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig, Point, RenderConfig, RenderHotspot, RenderHotspotTarget } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;
const DRAFT_KEY = 'aura-render-editor-draft';

/** Hash corto (djb2) de la config que originó el borrador: si la config cambió, el borrador viejo se ignora. */
function signature(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return String(hash);
}

interface Draft {
  source: string;
  render: RenderConfig;
}

function loadInitialRender(base: RenderConfig): RenderConfig {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      const draft = JSON.parse(saved) as Draft;
      if (draft.source === signature(JSON.stringify(base))) return draft.render;
    }
  } catch {
    // localStorage puede fallar (modo privado, etc.); seguimos con la config.
  }
  return base;
}

function saveDraft(base: RenderConfig, render: RenderConfig): void {
  try {
    const draft: Draft = { source: signature(JSON.stringify(base)), render };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // No es crítico: en el peor caso, un refresh pierde el borrador.
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Idem.
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function describeTarget(target: RenderHotspotTarget): string {
  if (target.type === 'unit') return `unidad ${target.code}`;
  return target.floor === undefined ? `vista ${target.viewId}` : `vista ${target.viewId}, piso ${target.floor}`;
}

type TargetType = RenderHotspotTarget['type'];

function RenderEditorBody({ base }: { base: RenderConfig }) {
  const [render, setRender] = useState<RenderConfig>(() => loadInitialRender(base));
  const [viewId, setViewId] = useState(base.defaultViewId);
  const [floor, setFloor] = useState<number | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [label, setLabel] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('unit');
  const [targetViewId, setTargetViewId] = useState(base.defaultViewId);
  const [targetFloor, setTargetFloor] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  // La planta generada por el motor no tiene imagen en la que dibujar zonas: no se edita aquí.
  const editableViews = render.views.filter(isImageBacked);
  const view = editableViews.find((candidate) => candidate.id === viewId) ?? editableViews[0];
  const surface = resolveSurface(view, floor);
  const { src, srcSet } = buildImageSources(surface.image);

  function updateRender(next: RenderConfig) {
    setRender(next);
    saveDraft(base, next);
  }

  function setSurfaceHotspots(hotspots: RenderHotspot[]) {
    updateRender({
      ...render,
      views: render.views.map((candidate) => {
        if (candidate.kind === 'generatedPlan' || candidate.id !== view.id) return candidate;
        if (candidate.kind === 'plan') {
          return {
            ...candidate,
            levels: candidate.levels.map((level) => (level.floor === surface.floor ? { ...level, hotspots } : level)),
          };
        }
        return { ...candidate, hotspots };
      }),
    });
  }

  function handleSelectView(nextViewId: string) {
    setViewId(nextViewId);
    setFloor(null);
    setPoints([]);
    setImageFailed(false);
  }

  function handleSelectFloor(nextFloor: number) {
    setFloor(nextFloor);
    setPoints([]);
    setImageFailed(false);
  }

  function handleImageClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    setPoints((current) => [...current, [x, y]]);
  }

  function buildTarget(): RenderHotspotTarget | null {
    if (targetType === 'unit') return unitCode.trim() === '' ? null : { type: 'unit', code: unitCode.trim() };
    const parsedFloor = targetFloor.trim() === '' ? undefined : Number(targetFloor);
    if (parsedFloor !== undefined && !Number.isFinite(parsedFloor)) return null;
    return parsedFloor === undefined ? { type: 'view', viewId: targetViewId } : { type: 'view', viewId: targetViewId, floor: parsedFloor };
  }

  const target = buildTarget();
  const canFinish = points.length >= 3 && label.trim() !== '' && target !== null;

  function handleFinishHotspot() {
    if (!canFinish || target === null) return;
    const taken = new Set(surface.hotspots.map((hotspot) => hotspot.id));
    const stem = target.type === 'unit' ? `u${target.code}` : `v-${target.viewId}${target.floor === undefined ? '' : `-${target.floor}`}`;
    let id = stem;
    for (let suffix = 2; taken.has(id); suffix += 1) id = `${stem}-${suffix}`;
    setSurfaceHotspots([...surface.hotspots, { id, label: label.trim(), polygon: points, target }]);
    setPoints([]);
    setLabel('');
    setUnitCode('');
  }

  function handleDeleteHotspot(id: string) {
    setSurfaceHotspots(surface.hotspots.filter((hotspot) => hotspot.id !== id));
  }

  function handleDiscardDraft() {
    clearDraft();
    setRender(base);
    setPoints([]);
  }

  const exportJson = JSON.stringify(render, null, 2);

  async function handleCopy() {
    await navigator.clipboard.writeText(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputClass = 'rounded border border-neutral-300 px-2 py-1 text-sm';
  const buttonClass = 'rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-40';

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <label className="flex items-center gap-2">
            Vista
            <select value={view.id} onChange={(event) => handleSelectView(event.target.value)} className={inputClass}>
              {editableViews.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {esText(candidate.label)}
                </option>
              ))}
            </select>
          </label>
          {view.kind === 'plan' && surface.floor !== undefined && (
            <label className="flex items-center gap-2">
              Piso
              <select value={surface.floor} onChange={(event) => handleSelectFloor(Number(event.target.value))} className={inputClass}>
                {planFloors(view).map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <p className="mb-2 text-sm text-neutral-600">
          Haz clic sobre la imagen para agregar vértices de la zona nueva (mínimo 3); luego dale nombre y destino.
        </p>

        <div className="relative overflow-hidden rounded-xl bg-neutral-200" onClick={handleImageClick}>
          {!imageFailed ? (
            <img
              src={src}
              srcSet={srcSet}
              sizes="(min-width: 1024px) 60vw, 100vw"
              alt={esText(surface.image.alt)}
              className="block w-full select-none"
              draggable={false}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-400 p-6 text-center">
              <p className="text-sm font-medium text-neutral-600">Todavía no hay imagen para esta vista</p>
              <p className="text-xs text-neutral-500">
                Genera los archivos con <code>scripts/build-render-images.ts</code> en <code>public{surface.image.base}</code>.
              </p>
            </div>
          )}

          <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
            {surface.hotspots.map((hotspot) => (
              <polygon
                key={hotspot.id}
                points={hotspot.polygon.map(([x, y]) => `${x},${y}`).join(' ')}
                className="fill-emerald-500/25 stroke-emerald-600"
                strokeWidth={0.003}
              />
            ))}
            {points.length > 0 && (
              <polyline
                points={points.map(([x, y]) => `${x},${y}`).join(' ')}
                className="fill-amber-400/25 stroke-amber-500"
                strokeWidth={0.003}
              />
            )}
            {points.map(([x, y], index) => (
              <circle key={index} cx={x} cy={y} r={0.006} className="fill-amber-500" />
            ))}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            Nombre de la zona
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Piso 8, 101…" className={`${inputClass} w-36`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            Lleva a
            <select value={targetType} onChange={(event) => setTargetType(event.target.value as TargetType)} className={inputClass}>
              <option value="unit">Ficha de unidad</option>
              <option value="view">Otra vista</option>
            </select>
          </label>
          {targetType === 'unit' ? (
            <label className="flex flex-col gap-1 text-xs text-neutral-600">
              Código de unidad
              <input value={unitCode} onChange={(event) => setUnitCode(event.target.value)} placeholder="804" className={`${inputClass} w-24`} />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-neutral-600">
                Vista destino
                <select value={targetViewId} onChange={(event) => setTargetViewId(event.target.value)} className={inputClass}>
                  {render.views.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {esText(candidate.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-neutral-600">
                Piso (opcional)
                <input value={targetFloor} onChange={(event) => setTargetFloor(event.target.value)} placeholder="8" className={`${inputClass} w-20`} />
              </label>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setPoints((current) => current.slice(0, -1))} disabled={points.length === 0} className={buttonClass}>
            Deshacer punto
          </button>
          <button type="button" onClick={() => setPoints([])} disabled={points.length === 0} className={buttonClass}>
            Cancelar zona
          </button>
          <button
            type="button"
            onClick={handleFinishHotspot}
            disabled={!canFinish}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Agregar zona
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Zonas de esta imagen</h2>
        {surface.hotspots.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">Ninguna todavía.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {surface.hotspots.map((hotspot) => (
              <li key={hotspot.id} className="flex items-center justify-between gap-2 rounded border border-neutral-200 px-3 py-1.5 text-sm">
                <span>
                  {esText(hotspot.label)} <span className="text-neutral-400">→ {describeTarget(hotspot.target)}</span>
                </span>
                <button type="button" onClick={() => handleDeleteHotspot(hotspot.id)} className="shrink-0 text-xs text-red-600 underline">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-neutral-500">Exportar</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Pega esto como el valor de <code>render</code> en <code>src/config/aura.json</code>. Incluye todas las vistas, no solo la actual.
        </p>
        <textarea readOnly value={exportJson} rows={12} className="mt-2 w-full rounded-lg border border-neutral-300 p-2 font-mono text-xs" />
        <button type="button" onClick={handleCopy} className="mt-2 w-full rounded-full border border-neutral-900 py-2 text-sm font-medium text-neutral-900">
          {copied ? '¡Copiado!' : 'Copiar JSON'}
        </button>
        <button type="button" onClick={handleDiscardDraft} className="mt-2 w-full text-xs text-neutral-500 underline">
          Descartar borrador y volver a la config
        </button>
      </div>
    </div>
  );
}

/**
 * Herramienta de admin (no es parte del selector público): dibuja con clics las zonas
 * clicables de cada vista del modo render (aérea, fachadas, plantas por nivel), les da un
 * destino (otra vista o una unidad) y exporta el JSON de `config.render` para pegar en
 * `src/config/aura.json`. Un navegador no puede escribir el archivo del proyecto, así que el
 * resultado es texto para copiar, no un guardado automático; el borrador sí vive en el navegador.
 */
export function RenderEditor() {
  if (!auraConfig.render || !auraConfig.render.views.some(isImageBacked)) {
    return (
      <p className="p-6 text-sm text-neutral-500">
        Este desarrollo todavía no tiene vistas con imagen en <code>render</code>: agrega sus vistas e imágenes primero (la planta generada por el motor no se edita aquí).
      </p>
    );
  }
  return <RenderEditorBody base={auraConfig.render} />;
}
