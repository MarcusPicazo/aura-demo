import type { I18n } from '../i18n/useI18n';
import type {
  RenderConfig,
  RenderHotspot,
  RenderHotspotTarget,
  RenderImage,
  RenderImageBackedViewConfig,
  RenderPlanViewConfig,
  RenderViewConfig,
  Unit,
  UnitStatus,
} from '../types';

/** Ruta base del modo render; la vista va como segmento (`/aura/render/<id>`). */
export const RENDER_BASE_PATH = '/aura/render';
/** Parámetros de URL del modo render (en español, igual que `/aura/unidad/:code`). */
export const FLOOR_PARAM = 'piso';
export const UNIT_PARAM = 'unidad';

/** Lo que se muestra de una vez: una imagen con sus zonas. En plantas, una por nivel. */
export interface RenderSurface {
  /** Identidad estable (vista, o vista+piso en plantas): cambia exactamente cuando hay que hacer transición. */
  key: string;
  image: RenderImage;
  hotspots: RenderHotspot[];
  /** Piso que muestra, solo en vistas de planta. */
  floor?: number;
}

/** La vista se muestra con una imagen propia (y por tanto tiene zonas que editar); la planta generada no. */
export function isImageBacked(view: RenderViewConfig): view is RenderImageBackedViewConfig {
  return view.kind !== 'generatedPlan';
}

export function findView(render: RenderConfig, viewId: string | null | undefined): RenderViewConfig | undefined {
  return render.views.find((view) => view.id === viewId);
}

/** La vista pedida, o la predeterminada si el id no existe (links viejos o mal escritos no rompen la pantalla). */
export function resolveView(render: RenderConfig, viewId: string | null | undefined): RenderViewConfig {
  return findView(render, viewId) ?? findView(render, render.defaultViewId) ?? render.views[0];
}

export function planFloors(view: RenderPlanViewConfig): number[] {
  return view.levels.map((level) => level.floor).sort((a, b) => a - b);
}

/** Superficie de una vista. En plantas, el nivel pedido o el primero si no existe. */
export function resolveSurface(view: RenderImageBackedViewConfig, floor: number | null | undefined): RenderSurface {
  if (view.kind !== 'plan') return { key: view.id, image: view.image, hotspots: view.hotspots };
  const level = view.levels.find((candidate) => candidate.floor === floor) ?? view.levels[0];
  return { key: `${view.id}:${level.floor}`, image: level.image, hotspots: level.hotspots, floor: level.floor };
}

/** Superficie a la que lleva una zona, o null si la zona abre una ficha de unidad. */
export function surfaceForTarget(render: RenderConfig, target: RenderHotspotTarget): RenderSurface | null {
  if (target.type !== 'view') return null;
  const view = findView(render, target.viewId);
  // La planta generada no tiene imagen que precargar: la dibuja el motor.
  return view && view.kind !== 'generatedPlan' ? resolveSurface(view, target.floor) : null;
}

export function allSurfaces(render: RenderConfig): RenderSurface[] {
  return render.views.flatMap((view) => {
    if (view.kind === 'generatedPlan') return [];
    return view.kind === 'plan' ? view.levels.map((level) => resolveSurface(view, level.floor)) : [resolveSurface(view, null)];
  });
}

/** ¿Esta unidad es a la que apunta la zona? `buildingId` solo se compara si la zona lo declara (conjuntos con códigos repetidos). */
export function matchesUnitRef(unit: Pick<Unit, 'code' | 'buildingId'>, ref: { code: string; buildingId?: string }): boolean {
  return unit.code === ref.code && (ref.buildingId === undefined || unit.buildingId === ref.buildingId);
}

// ─── Estado de disponibilidad ────────────────────────────────────────────────────────

/** Estado agregado de un piso: lo más "vendible" que haya (disponible > apartado > vendido). */
export function floorStatus(units: Unit[], floor: number): UnitStatus | null {
  const onFloor = units.filter((unit) => unit.floor === floor);
  if (onFloor.length === 0) return null;
  if (onFloor.some((unit) => unit.status === 'available')) return 'available';
  if (onFloor.some((unit) => unit.status === 'reserved')) return 'reserved';
  return 'sold';
}

/** Estado que colorea una zona: el de su unidad, el agregado de su piso, o null (zona neutra: solo navega). */
export function hotspotStatus(hotspot: RenderHotspot, units: Unit[]): UnitStatus | null {
  const { target } = hotspot;
  if (target.type === 'unit') return units.find((unit) => matchesUnitRef(unit, target))?.status ?? null;
  return target.floor === undefined ? null : floorStatus(units, target.floor);
}

export interface HotspotCaption {
  title: string;
  detail: string | null;
}

/** Dato que explica el color de una unidad: tipo, superficie, precio y estado. */
export function unitDetail(i18n: I18n, unit: Pick<Unit, 'type' | 'm2' | 'price' | 'status'>): string {
  return `${i18n.t('unit.type', { type: unit.type })} · ${unit.m2} m² · ${i18n.money(unit.price)} · ${i18n.status(unit.status)}`;
}

/** Texto del tooltip y del `aria-label`: nombre de la zona más el dato que explica su color. */
export function hotspotCaption(i18n: I18n, hotspot: RenderHotspot, units: Unit[]): HotspotCaption {
  const { target } = hotspot;
  const label = i18n.text(hotspot.label);
  if (target.type === 'unit') {
    const unit = units.find((candidate) => matchesUnitRef(candidate, target));
    return { title: label, detail: unit ? unitDetail(i18n, unit) : null };
  }
  if (target.floor === undefined) return { title: label, detail: null };
  const onFloor = units.filter((unit) => unit.floor === target.floor);
  if (onFloor.length === 0) return { title: label, detail: null };
  const available = onFloor.filter((unit) => unit.status === 'available').length;
  return { title: label, detail: i18n.t('legend.count', { available, total: onFloor.length }) };
}

// ─── Imágenes ────────────────────────────────────────────────────────────────────────

export interface ImageSources {
  /** Respaldo (JPG de mayor tamaño) para navegadores sin `srcset`. */
  src: string;
  srcSet: string;
}

export function buildImageSources(image: RenderImage): ImageSources {
  return {
    src: `${image.base}.jpg`,
    srcSet: image.widths.map((width) => `${image.base}-${width}.webp ${width}w`).join(', '),
  };
}

/**
 * Ancho que ocupa la imagen en pantalla, para que el navegador elija la variante correcta
 * del `srcset` sin descargar de más: la imagen se ajusta (contain) al área libre, así que
 * mide lo que quepa a lo ancho o lo que dé la altura disponible multiplicada por su proporción.
 */
export function imageSizes(image: RenderImage, reservedVerticalRem: number): string {
  const ratio = (image.width / image.height).toFixed(4);
  return `min(100vw, calc((100vh - ${reservedVerticalRem}rem) * ${ratio}))`;
}

/** Sin repetir: varias plantas comparten el mismo archivo (planta tipo) y se descarga una vez. */
export function uniqueImages(images: RenderImage[]): RenderImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (seen.has(image.base)) return false;
    seen.add(image.base);
    return true;
  });
}

/**
 * Orden de precarga mientras el usuario mira `current`: primero lo que sus zonas pueden
 * abrir (el siguiente clic), después el resto de la config.
 */
export function preloadOrder(render: RenderConfig, current: RenderSurface): RenderImage[] {
  const next = current.hotspots.flatMap((hotspot) => {
    const surface = surfaceForTarget(render, hotspot.target);
    return surface ? [surface.image] : [];
  });
  return uniqueImages([...next, ...allSurfaces(render).map((surface) => surface.image)]).filter(
    (image) => image.base !== current.image.base,
  );
}

// ─── Navegación ──────────────────────────────────────────────────────────────────────

export interface RenderLocation {
  viewId: string;
  floor?: number | null;
  /** La unidad abierta, tal como viaja en la URL (`UnitIdentity.param`): el código, o `edificio:código` en un conjunto. */
  unitParam?: string | null;
}

/** Lee un número de un parámetro de URL; ausente, vacío o no numérico cuenta como "sin valor". */
export function parseNumberParam(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `/aura/render/<vista>?piso=<n>&unidad=<código>`: lo que se comparte y lo que sobrevive a recargar. */
export function renderPath({ viewId, floor, unitParam }: RenderLocation): string {
  const params = new URLSearchParams();
  if (floor !== null && floor !== undefined) params.set(FLOOR_PARAM, String(floor));
  if (unitParam) params.set(UNIT_PARAM, unitParam);
  const query = params.toString();
  return `${RENDER_BASE_PATH}/${viewId}${query ? `?${query}` : ''}`;
}

/** Dónde se ve mejor una unidad: una planta que tiene una zona para ella (la generada las tiene todas),
 *  o la de su piso, o una vista que la mencione. Gana la primera en el orden de la config. */
export function locateUnit(render: RenderConfig, unit: Pick<Unit, 'code' | 'floor' | 'buildingId'>, unitParam: string): RenderLocation {
  const withZone = (hotspots: RenderHotspot[]) =>
    hotspots.some((hotspot) => hotspot.target.type === 'unit' && matchesUnitRef(unit, hotspot.target));

  for (const view of render.views) {
    if (view.kind === 'generatedPlan') {
      // Una planta generada es de un edificio: sirve a su unidad solo si es el suyo (sin `buildingId`, a cualquiera).
      if (view.buildingId === undefined || view.buildingId === unit.buildingId) return { viewId: view.id, floor: unit.floor, unitParam };
      continue;
    }
    if (view.kind !== 'plan') continue;
    const level = view.levels.find((candidate) => withZone(candidate.hotspots));
    if (level) return { viewId: view.id, floor: level.floor, unitParam };
  }
  for (const view of render.views) {
    if (view.kind !== 'plan') continue;
    const level = view.levels.find((candidate) => candidate.floor === unit.floor);
    if (level) return { viewId: view.id, floor: level.floor, unitParam };
  }
  const imageView = render.views.find((view) => view.kind !== 'plan' && view.kind !== 'generatedPlan' && withZone(view.hotspots));
  return { viewId: imageView?.id ?? render.defaultViewId, unitParam };
}

/**
 * Planta de un piso, para llegar a render desde "piso enfocado" del 3D. La generada muestra cualquier piso;
 * en un conjunto, `buildingId` la limita a la planta de ese edificio.
 */
export function locateFloor(render: RenderConfig, floor: number, buildingId?: string): RenderLocation | null {
  for (const view of render.views) {
    if (view.kind === 'generatedPlan') {
      if (buildingId !== undefined && view.buildingId !== undefined && view.buildingId !== buildingId) continue;
      return { viewId: view.id, floor };
    }
    if (view.kind === 'plan' && view.levels.some((level) => level.floor === floor)) return { viewId: view.id, floor };
  }
  return null;
}

/**
 * Las vistas que este desarrollo puede mostrar de verdad: la planta generada necesita el
 * modelo 3D (`geometry`), así que sin él se descarta, y si era la vista predeterminada el
 * render abre en la primera que quede.
 */
export function usableRender(render: RenderConfig, hasGeometry: boolean): RenderConfig {
  const views = hasGeometry ? render.views : render.views.filter((view) => view.kind !== 'generatedPlan');
  if (views.length === render.views.length) return render;
  const defaultViewId = views.some((view) => view.id === render.defaultViewId) ? render.defaultViewId : (views[0]?.id ?? render.defaultViewId);
  return { defaultViewId, views };
}

// ─── Ficha de unidad sin depender del modelo 3D ──────────────────────────────────────

/**
 * Clave del plano/renders interiores de una unidad: su código (penthouses, que son únicos)
 * o su tipo (las demás comparten distribución). Mismo criterio que `floorPlanKey` de
 * `geometry.ts`, pero deducido de lo que haya en la config en vez de necesitar
 * `geometry.levels` — así funciona igual cuando el cliente no tiene modelo 3D.
 */
export function unitMediaKey(
  unit: Pick<Unit, 'code' | 'type'> & { buildingId?: string },
  mediaKeys: Record<string, unknown>,
): string | undefined {
  // En un conjunto, una clave puede llevar el prefijo del edificio (`torre-b/A`, `torre-b/701`): gana sobre la
  // general, para que dos torres con un tipo "A" distinto no se pisen. Sin prefijo vale para todos los edificios.
  const candidates = [
    ...(unit.buildingId ? [`${unit.buildingId}/${unit.code}`] : []),
    unit.code,
    ...(unit.buildingId ? [`${unit.buildingId}/${unit.type}`] : []),
    unit.type,
  ];
  return candidates.find((key) => key in mediaKeys);
}
