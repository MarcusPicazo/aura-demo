import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { polygonLabelPoint, scalePolygon } from '../../lib/geometry';
import { preloadImage } from '../../lib/imagePreload';
import { useI18n } from '../../i18n/useI18n';
import { buildImageSources, hotspotCaption, hotspotStatus, imageSizes, matchesUnitRef, type RenderSurface } from '../../lib/render';
import { STATUS_COLORS } from '../../lib/status';
import { HotspotTooltip, type TooltipState } from './HotspotTooltip';
import { STAGE_BOTTOM_REM, STAGE_FADE_MS, STAGE_PANEL_PADDING, STAGE_RESERVED_VERTICAL_REM, STAGE_TOP_REM } from './layout';
import type { RenderHotspot, Unit, UnitStatus } from '../../types';

/** Tamaño del rótulo de cada zona EN PANTALLA (px): constante sin importar cuánto se reduzca la
 *  imagen, para que un código de unidad se lea igual en un celular que en un monitor. */
const LABEL_SCREEN_PX = 14;
/** Hasta que se mide el recuadro (primer cuadro), el rótulo se calcula como fracción del alto de la imagen. */
const LABEL_FALLBACK_RATIO = 0.03;

type LayerPhase = 'entering' | 'visible' | 'leaving';

interface Layer {
  id: number;
  surface: RenderSurface;
  phase: LayerPhase;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface Paint {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
}

/** Color por estado (mismos colores que la leyenda y el modelo 3D); sin estado, una zona neutra que solo navega. */
function hotspotPaint(status: UnitStatus | null, hovered: boolean, selected: boolean): Paint {
  if (status === null) {
    return {
      fill: '#ffffff',
      fillOpacity: selected ? 0.35 : hovered ? 0.3 : 0.04,
      stroke: selected ? 'var(--brand-accent)' : 'rgba(255, 255, 255, 0.85)',
      strokeWidth: selected ? 3.5 : hovered ? 3 : 1.5,
    };
  }
  const idleOpacity = status === 'sold' ? 0.2 : 0.34;
  return {
    fill: STATUS_COLORS[status],
    fillOpacity: selected ? 0.62 : hovered ? idleOpacity + 0.26 : idleOpacity,
    stroke: selected ? 'var(--brand-accent)' : STATUS_COLORS[status],
    strokeWidth: selected ? 3.5 : hovered ? 3 : 1.5,
  };
}

interface StageLayerProps {
  surface: RenderSurface;
  phase: LayerPhase;
  /** Solo la capa actual recibe clics; la que se está desvaneciendo no. */
  interactive: boolean;
  units: Unit[];
  selectedUnit: Pick<Unit, 'code' | 'buildingId'> | null;
  onActivate: (hotspot: RenderHotspot) => void;
  onTooltip: (tooltip: TooltipState | null) => void;
}

function StageLayer({ surface, phase, interactive, units, selectedUnit, onActivate, onTooltip }: StageLayerProps) {
  const { image, hotspots } = surface;
  const i18n = useI18n();
  const [failed, setFailed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [displayScale, setDisplayScale] = useState<number | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const { src, srcSet } = useMemo(() => buildImageSources(image), [image]);

  // Cuánto se está reduciendo la imagen en pantalla (la imagen se ajusta al recuadro): con eso
  // los rótulos del SVG, que viven en unidades de la imagen, se dibujan a un tamaño fijo en px.
  useEffect(() => {
    const element = layerRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDisplayScale(Math.min(width / image.width, height / image.height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [image.width, image.height]);

  const labelSize = displayScale ? LABEL_SCREEN_PX / displayScale : image.height * LABEL_FALLBACK_RATIO;

  function showTooltip(hotspot: RenderHotspot, x: number, y: number) {
    const caption = hotspotCaption(i18n, hotspot, units);
    onTooltip({ x, y, title: caption.title, detail: caption.detail });
  }

  function handlePointer(event: PointerEvent<SVGPolygonElement>, hotspot: RenderHotspot) {
    // En táctil no hay "pasar el cursor": el toque ya ejecuta la acción, un tooltip sería ruido.
    if (event.pointerType === 'touch') return;
    setHoveredId(hotspot.id);
    showTooltip(hotspot, event.clientX, event.clientY);
  }

  function handleFocus(hotspot: RenderHotspot, element: SVGPolygonElement) {
    const rect = element.getBoundingClientRect();
    setHoveredId(hotspot.id);
    showTooltip(hotspot, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function clearHover() {
    setHoveredId(null);
    onTooltip(null);
  }

  function handleKeyDown(event: KeyboardEvent<SVGPolygonElement>, hotspot: RenderHotspot) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate(hotspot);
  }

  return (
    <div
      ref={layerRef}
      aria-hidden={!interactive}
      style={{ transitionDuration: `${STAGE_FADE_MS}ms` }}
      className={`absolute inset-0 transition-opacity ease-elegant motion-reduce:transition-none ${
        phase === 'visible' ? 'opacity-100' : 'opacity-0'
      } ${interactive ? '' : 'pointer-events-none'}`}
    >
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-neutral-600">{i18n.t('render.imageError')}</p>
          <p className="text-xs text-neutral-500">
            <code>{image.base}</code>
          </p>
        </div>
      ) : (
        <>
          {/* `object-contain` y `preserveAspectRatio="meet"` ajustan igual la imagen y su capa
              de zonas dentro del mismo recuadro: quedan alineadas sin medir nada en JS. */}
          <img
            src={src}
            srcSet={srcSet}
            sizes={imageSizes(image, STAGE_RESERVED_VERTICAL_REM)}
            alt={i18n.text(image.alt)}
            width={image.width}
            height={image.height}
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full select-none object-contain"
          />
          <svg
            viewBox={`0 0 ${image.width} ${image.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
          >
            {hotspots.map((hotspot) => {
              const status = hotspotStatus(hotspot, units);
              const selected = hotspot.target.type === 'unit' && selectedUnit !== null && matchesUnitRef(selectedUnit, hotspot.target);
              const paint = hotspotPaint(status, hoveredId === hotspot.id, selected);
              const points = scalePolygon(hotspot.polygon, image.width, image.height);
              const [labelX, labelY] = polygonLabelPoint(points);
              const caption = hotspotCaption(i18n, hotspot, units);
              return (
                <g key={hotspot.id}>
                  <polygon
                    points={points.map(([x, y]) => `${x},${y}`).join(' ')}
                    role="button"
                    tabIndex={interactive ? 0 : -1}
                    aria-label={caption.detail ? `${caption.title}. ${caption.detail}` : caption.title}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    className="cursor-pointer outline-none transition-[fill-opacity,stroke-width] duration-150"
                    style={{
                      fill: paint.fill,
                      fillOpacity: paint.fillOpacity,
                      stroke: paint.stroke,
                      strokeWidth: paint.strokeWidth,
                    }}
                    onPointerEnter={(event) => handlePointer(event, hotspot)}
                    onPointerMove={(event) => handlePointer(event, hotspot)}
                    onPointerLeave={clearHover}
                    onFocus={(event) => handleFocus(hotspot, event.currentTarget)}
                    onBlur={clearHover}
                    onKeyDown={(event) => handleKeyDown(event, hotspot)}
                    onClick={() => {
                      clearHover();
                      onActivate(hotspot);
                    }}
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={labelSize}
                    className="pointer-events-none select-none"
                    style={{
                      fill: '#ffffff',
                      stroke: 'rgba(0, 0, 0, 0.7)',
                      strokeWidth: labelSize * 0.2,
                      strokeLinejoin: 'round',
                      fontWeight: 600,
                      paintOrder: 'stroke',
                    }}
                  >
                    {i18n.text(hotspot.label)}
                  </text>
                </g>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}

interface RenderStageProps {
  surface: RenderSurface;
  units: Unit[];
  selectedUnit: Pick<Unit, 'code' | 'buildingId'> | null;
  onActivate: (hotspot: RenderHotspot) => void;
  /** Deja libre el costado izquierdo para el selector de piso (vistas de planta). */
  reserveSide?: boolean;
  /** Hay una ficha de unidad abierta: en escritorio se le deja su espacio a la derecha. */
  panelOpen?: boolean;
}

/**
 * Imagen con sus zonas clicables. Al cambiar de superficie espera a que la nueva imagen esté
 * descargada y decodificada y entonces hace un fundido cruzado con la anterior: nunca se ve
 * una imagen a medias ni un hueco. Las zonas se colorean con el inventario que recibe por
 * props, así que un cambio de estado en Supabase (Realtime) las recolorea sin recargar.
 */
export function RenderStage({ surface, units, selectedUnit, onActivate, reserveSide = false, panelOpen = false }: RenderStageProps) {
  const [layers, setLayers] = useState<Layer[]>([]);
  // Clave de la última superficie ya pintada: "cargando" es simplemente que la pedida aún no es esa.
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const nextLayerId = useRef(0);
  const loading = shownKey !== surface.key;

  useEffect(() => {
    let cancelled = false;
    void preloadImage(surface.image, STAGE_RESERVED_VERTICAL_REM).then(() => {
      if (cancelled) return;
      setShownKey(surface.key);
      setTooltip(null);
      setLayers((current) => {
        const showing = current.filter((layer) => layer.phase !== 'leaving').at(-1);
        if (showing?.surface.key === surface.key) {
          return current.map((layer) => (layer === showing ? { ...layer, surface } : layer));
        }
        nextLayerId.current += 1;
        return [
          ...current.map((layer): Layer => ({ ...layer, phase: 'leaving' })),
          { id: nextLayerId.current, surface, phase: prefersReducedMotion() ? 'visible' : 'entering' },
        ];
      });
    });
    return () => {
      cancelled = true;
    };
  }, [surface]);

  // Dos cuadros de por medio: la capa nueva debe pintarse una vez en opacidad 0 antes de
  // animarse a 1, o el navegador se salta la transición y aparece de golpe.
  useEffect(() => {
    if (!layers.some((layer) => layer.phase === 'entering')) return undefined;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setLayers((current) => current.map((layer) => (layer.phase === 'entering' ? { ...layer, phase: 'visible' } : layer)));
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [layers]);

  useEffect(() => {
    if (!layers.some((layer) => layer.phase === 'leaving')) return undefined;
    const timeout = setTimeout(() => {
      setLayers((current) => current.filter((layer) => layer.phase !== 'leaving'));
    }, STAGE_FADE_MS + 60);
    return () => clearTimeout(timeout);
  }, [layers]);

  const currentLayerId = layers.filter((layer) => layer.phase !== 'leaving').at(-1)?.id;

  return (
    <div
      className={`absolute inset-x-0 transition-[padding] duration-300 ease-elegant motion-reduce:transition-none ${
        reserveSide ? 'pl-16 pr-4 sm:pl-16 sm:pr-16' : 'px-4'
      } ${panelOpen ? STAGE_PANEL_PADDING : ''}`}
      style={{ top: `${STAGE_TOP_REM}rem`, bottom: `${STAGE_BOTTOM_REM}rem` }}
    >
      <div className="relative h-full w-full">
        {layers.map((layer) => (
          <StageLayer
            key={layer.id}
            surface={layer.surface}
            phase={layer.phase}
            interactive={layer.id === currentLayerId}
            units={units}
            selectedUnit={selectedUnit}
            onActivate={onActivate}
            onTooltip={setTooltip}
          />
        ))}

        {layers.length === 0 && <div className="absolute inset-0 animate-pulse rounded-2xl bg-neutral-200/60" />}
      </div>

      {loading && layers.length > 0 && (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-0.5 animate-pulse rounded-full bg-[var(--brand-accent)]" />
      )}

      {tooltip && <HotspotTooltip tooltip={tooltip} />}
    </div>
  );
}
