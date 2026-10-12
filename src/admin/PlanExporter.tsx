import { esText } from '../i18n/localized';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { FloorPlan, PlanCamera } from '../engine/FloorPlan';
import { PlanCapture, type PlanCaptureApi } from '../engine/PlanCapture';
import { buildLevelPlan, exportedLevels, frameImageSize, levelHotspots, levelLayouts, planFrame } from '../lib/levelPlan';
import { hasTower3D } from '../lib/modes';
import { buildPlanStyle } from '../lib/planStyle';
import { RENDER_WIDTHS } from '../lib/renderWidths';
import { scalePolygon } from '../lib/geometry';
import { activeConfig as auraConfig, buildings, unitIdentity } from '../config/active';
import type { RenderHotspot, TowerDevelopmentConfig, UnitStatus } from '../types';

/** Torres con unidades a la venta: las que tienen plantas que exportar. */
const towers = buildings.filter((building) => building.sellable);

/** Nombre base de la imagen de una planta; en un conjunto lleva el edificio (cada torre tiene las suyas). */
const imageStem = (buildingId: string, layoutId: string) => (unitIdentity.multi ? `planta-${buildingId}-${layoutId}` : `planta-${layoutId}`);

/** Cómo se llama el PNG de cada planta (debe coincidir con `base` en `exportedLevels`). */
const fileName = (buildingId: string, layoutId: string) => `${imageStem(buildingId, layoutId)}.png`;

interface ExportPreview {
  url: string;
  width: number;
  height: number;
  fileName: string;
  /** Las zonas que se pegarán en el config, calculadas con el mismo recuadro con que se exportó. */
  hotspots: RenderHotspot[];
}

function PlanExporterBody({ config }: { config: TowerDevelopmentConfig }) {
  const [buildingId, setBuildingId] = useState(towers[0].id);
  const building = towers.find((candidate) => candidate.id === buildingId) ?? towers[0];
  const layouts = useMemo(() => levelLayouts(building.geometry), [building.geometry]);
  const [layoutId, setLayoutId] = useState(layouts[0].id);
  const layout = layouts.find((candidate) => candidate.id === layoutId) ?? layouts[0];
  const [floor, setFloor] = useState(layout.floors[0]);
  const [widthPx, setWidthPx] = useState(RENDER_WIDTHS[RENDER_WIDTHS.length - 1]);
  const [showCodes, setShowCodes] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExportPreview | null>(null);

  const [copied, setCopied] = useState(false);
  const captureRef = useRef<PlanCaptureApi | null>(null);

  // Al cambiar de tipo de planta, el piso mostrado debe ser uno de ese tipo.
  const activeFloor = layout.floors.includes(floor) ? floor : layout.floors[0];
  const plan = useMemo(
    () => buildLevelPlan({ buildingId: building.id, geometry: building.geometry, floorPlans: config.floorPlans }, activeFloor),
    [building, config.floorPlans, activeFloor],
  );
  const frame = useMemo(() => planFrame(plan.bounds), [plan.bounds]);
  const style = useMemo(() => buildPlanStyle(config.brand.accent, config.brand.background), [config.brand]);
  // Aquí no hay inventario real: con «Color por estado» todas se ven como disponibles, solo para ver cómo queda el color.
  const statuses = useMemo(() => new Map<string, UnitStatus>(plan.units.map((unit) => [unit.code, 'available'])), [plan]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function handleDownload() {
    const api = captureRef.current;
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await api.capture(widthPx);
      const url = URL.createObjectURL(blob);
      const size = frameImageSize(frame, widthPx);
      setPreview({
        url,
        width: size.width,
        height: size.height,
        fileName: fileName(building.id, layout.id),
        hotspots: levelHotspots(plan, frame, unitIdentity.multi),
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName(building.id, layout.id);
      link.click();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo exportar la planta.');
    } finally {
      setBusy(false);
    }
  }

  const levelsJson = useMemo(
    () =>
      JSON.stringify(
        exportedLevels(
          { buildingId: building.id, geometry: building.geometry, floorPlans: config.floorPlans, name: esText(building.name), scopeToBuilding: unitIdentity.multi },
          config.slug,
          widthPx,
          (id) => imageStem(building.id, id),
        ),
        null,
        2,
      ),
    [building, config.floorPlans, config.slug, widthPx],
  );

  async function handleCopy() {
    await navigator.clipboard.writeText(levelsJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputClass = 'rounded border border-neutral-300 px-2 py-1 text-sm';

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-3 flex flex-wrap items-end gap-3 text-sm text-neutral-600">
          {towers.length > 1 && (
            <label className="flex flex-col gap-1 text-xs">
              Edificio
              <select
                value={building.id}
                onChange={(event) => {
                  const next = towers.find((candidate) => candidate.id === event.target.value) ?? towers[0];
                  setBuildingId(next.id);
                  const nextLayouts = levelLayouts(next.geometry);
                  setLayoutId(nextLayouts[0].id);
                  setFloor(nextLayouts[0].floors[0]);
                  setPreview(null);
                }}
                className={inputClass}
              >
                {towers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {esText(candidate.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs">
            Planta
            <select value={layout.id} onChange={(event) => setLayoutId(event.target.value as typeof layoutId)} className={inputClass}>
              {layouts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.id === 'tipo' ? 'Tipo' : 'Penthouse'} ({candidate.floors.length === 1 ? `piso ${candidate.floors[0]}` : `pisos ${candidate.floors[0]}–${candidate.floors[candidate.floors.length - 1]}`})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Piso que se muestra
            <select value={activeFloor} onChange={(event) => setFloor(Number(event.target.value))} className={inputClass}>
              {layout.floors.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Ancho del PNG
            <select value={widthPx} onChange={(event) => setWidthPx(Number(event.target.value))} className={inputClass}>
              {RENDER_WIDTHS.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate} px
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showCodes} onChange={(event) => setShowCodes(event.target.checked)} />
            Códigos de unidad
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={showStatus} onChange={(event) => setShowStatus(event.target.checked)} />
            Color por estado
          </label>
        </div>

        <p className="mb-2 text-xs text-neutral-500">
          Lo que ves es lo que se exporta. Para usar la imagen en el modo render déjala <strong>sin</strong> códigos ni color por estado:
          el modo render los dibuja en vivo con el inventario real.
        </p>

        <div className="overflow-hidden rounded-xl border border-neutral-200" style={{ aspectRatio: `${frame.width} / ${frame.depth}` }}>
          <Canvas orthographic flat frameloop="demand" dpr={[1, 2]} gl={{ antialias: true }} camera={{ near: 1, far: 100, position: [0, 50, 0], zoom: 1 }}>
            <PlanCamera frame={frame} />
            <FloorPlan
              plan={plan}
              statuses={statuses}
              style={style}
              showStatus={showStatus}
              showCodes={showCodes}
              selectedUnitCode={null}
              onSelectUnit={() => undefined}
            />
            <PlanCapture frame={frame} apiRef={captureRef} />
          </Canvas>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Exportando…' : `Descargar ${fileName(building.id, layout.id)}`}
          </button>
          <span className="text-xs text-neutral-500">
            {frameImageSize(frame, widthPx).width}×{frameImageSize(frame, widthPx).height} px
          </span>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>

        {preview && (
          <div className="mt-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Última exportación</h2>
            <p className="mb-2 text-xs text-neutral-500">
              {preview.fileName} — {preview.width}×{preview.height} px. Los recuadros verdes son las zonas clicables que se
              pegarán en el config, sobre la imagen exportada.
            </p>
            <div className="relative overflow-hidden rounded-xl border border-neutral-200" data-testid="export-preview">
              <img src={preview.url} alt="Planta exportada" className="block w-full" />
              <svg viewBox={`0 0 ${preview.width} ${preview.height}`} className="pointer-events-none absolute inset-0 h-full w-full">
                {preview.hotspots.map((hotspot) => (
                  <polygon
                    key={hotspot.id}
                    points={scalePolygon(hotspot.polygon, preview.width, preview.height).map(([x, y]) => `${x},${y}`).join(' ')}
                    className="fill-emerald-500/10 stroke-emerald-600"
                    strokeWidth={Math.max(2, preview.width / 400)}
                    data-hotspot={hotspot.id}
                  />
                ))}
              </svg>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Usarla en el modo render</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-neutral-600">
          <li>
            Descarga <code>{fileName(building.id, 'tipo')}</code> y <code>{fileName(building.id, 'penthouse')}</code> (una por tipo de planta).
          </li>
          <li>
            Guárdalas en <code>render-src/{config.slug}/</code> y corre <code>npx tsx scripts/build-render-images.ts {config.slug}</code>.
          </li>
          <li>
            Copia el JSON de abajo como <code>levels</code> de una vista <code>{`{ "kind": "plan" }`}</code> en <code>render.views</code> de{' '}
            <code>src/config/{config.slug}.json</code>.
          </li>
        </ol>
        <textarea readOnly value={levelsJson} rows={14} className="mt-3 w-full rounded-lg border border-neutral-300 p-2 font-mono text-xs" />
        <button type="button" onClick={handleCopy} className="mt-2 w-full rounded-full border border-neutral-900 py-2 text-sm font-medium text-neutral-900">
          {copied ? '¡Copiado!' : 'Copiar JSON de levels'}
        </button>
      </div>
    </div>
  );
}

/**
 * Herramienta de admin: exporta como PNG la planta que dibuja el motor (la misma del modo
 * render generado) y arma el JSON de `levels` —imagen y zonas clicables por unidad— para usarla
 * como una vista de planta con imágenes (`kind: "plan"`). Así una planta que se quiera usar
 * como imagen fija sigue saliendo del motor y de la geometría, no de un dibujo aparte.
 */
export function PlanExporter() {
  if (!hasTower3D(auraConfig) || towers.length === 0) {
    return <p className="p-6 text-sm text-neutral-500">Las plantas se generan desde la geometría 3D; este desarrollo no la tiene.</p>;
  }
  return <PlanExporterBody config={auraConfig} />;
}
