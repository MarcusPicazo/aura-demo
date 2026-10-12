import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Context } from '../engine/Context';
import { CameraRig } from '../engine/CameraRig';
import { CameraFocus } from '../engine/CameraFocus';
import { CameraCollision } from '../engine/CameraCollision';
import { LookAround } from '../engine/LookAround';
import { CameraProbe, type CameraPose } from '../engine/CameraProbe';
import { TourDirector, type CameraTrack } from '../engine/TourDirector';
import { ContactShadow } from '../engine/ContactShadow';
import { PrecompileScene } from '../engine/PrecompileScene';
import { BuildingPlacement } from '../engine/BuildingPlacement';
import { Massing, type MassingItem } from '../engine/Massing';
import { WebGLRecovery } from '../engine/WebGLRecovery';
import { AdaptivePerformance } from '../engine/AdaptivePerformance';
import { UnitPanel } from './UnitPanel';
import { SunLighting, type SkyParams } from './SunLighting';
import { SunControl } from './SunControl';
import type { UnitSunInfo } from './SunHoursIndicator';
import { UnitViewBackButton, UnitViewStatus } from './UnitViewHud';
import { TourOverlay, type TourCaptionText } from './TourOverlay';
import { Filters } from './Filters';
import { Legend } from './Legend';
import { AvailabilityToggle } from './AvailabilityToggle';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import { BuildingInfoCard } from './BuildingInfoCard';
import { BuildingLabels, type BuildingLabelItem } from './BuildingLabels';
import { LoadingScreen } from './LoadingScreen';
import type { AuraOutletContext } from './AuraLayout';
import {
  MASTERPLAN_PATH,
  availabilityStatus,
  buildingAvailability,
  buildingHeight,
  buildingPath,
  buildingPlacement,
  ensembleBounds,
  ensembleHeight,
  massingBands,
  worldBounds,
} from '../lib/buildings';
import { computeCameraFraming, computeCameraLimits, findUnitPolygon, type CameraFraming } from '../lib/geometry';
import { hasActiveFilters } from '../lib/filters';
import { compassKey, formatMonthDay, formatMonthDayLong, parseMonthDay } from '../lib/solar';
import { buildTourPlan, type TourCaptionId, type TourPlan } from '../lib/tour';
import { createTourRunner } from '../lib/tourRunner';
import { pickFeaturedUnit, presentationSettings } from '../lib/presentation';
import { buildingSunSummaries, solarConfig, unitViewPoseFor } from '../lib/sunAnalysis';
import { afternoonTints } from '../lib/sunMap';
import { useEscapeKey } from '../lib/useEscapeKey';
import { unitMediaKey } from '../lib/render';
import { STATUS_COLORS } from '../lib/status';
import { trackEvent } from '../lib/analytics';
import { usePresence } from '../lib/usePresence';
import { useSelectionStore } from '../store/selectionStore';
import { useFiltersStore } from '../store/filtersStore';
import { useLookStore } from '../store/lookStore';
import { useSunStore } from '../store/sunStore';
import { useTourStore } from '../store/tourStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useCompareStore } from '../store/compareStore';
import { useI18n } from '../i18n/useI18n';
import { activeConfig, buildings, messageDevelopmentName, unitIdentity } from '../config/active';
import type { SunSummary } from '../lib/sunExposure';
import type { FloorPlanConfig, Point, TowerDevelopmentConfig, Unit } from '../types';

// Este selector solo se monta si el desarrollo tiene modelo 3D (ver `App.tsx` y `lib/modes.ts`),
// así que aquí sí están todas las secciones de `Tower3DConfig`.
const auraConfig = activeConfig as TowerDevelopmentConfig;

// El detalle de un edificio (`Tower`: balcones, canceles, lobby, azotea…) es lo más pesado de la
// escena y su código se baja aparte. Un desarrollo de una sola torre lo necesita de inmediato, así
// que empieza a bajarlo ya; un conjunto abre en el masterplan (puros volúmenes) y lo baja cuando
// se entra a un edificio, o en un momento libre después de pintar el masterplan.
const loadTower = () => import('../engine/Tower');
const Tower = lazy(() => loadTower().then((module) => ({ default: module.Tower })));
if (!unitIdentity.multi) void loadTower();

/** Caja, altura y centro del conjunto completo (con un solo edificio, coincide con su huella). */
const ENSEMBLE_BOUNDS = ensembleBounds(buildings);
const ENSEMBLE_HEIGHT = ensembleHeight(buildings);
const ENSEMBLE_CENTER_X = (ENSEMBLE_BOUNDS.minX + ENSEMBLE_BOUNDS.maxX) / 2;
const ENSEMBLE_CENTER_Z = (ENSEMBLE_BOUNDS.minZ + ENSEMBLE_BOUNDS.maxZ) / 2;
const ENSEMBLE_SPAN = Math.max(ENSEMBLE_BOUNDS.maxX - ENSEMBLE_BOUNDS.minX, ENSEMBLE_BOUNDS.maxZ - ENSEMBLE_BOUNDS.minZ);

/** Cuánto pesa el color de disponibilidad sobre el volumen de un edificio en el masterplan (0 = sin tinte, 1 = color pleno). */
const MASSING_STATUS_STRENGTH = 0.45;
/**
 * El masterplan se mira desde el aire: la cámara mira hacia abajo con un ángulo fijo de elevación y apunta casi
 * al piso, en vez del encuadre a media altura con que se ve una torre sola. Fijar el ángulo (no la altura) da la
 * misma vista de pájaro en escritorio y en un celular vertical, donde la cámara tiene que alejarse mucho más.
 */
const MASTERPLAN_VIEW = { elevationDeg: 38, targetHeightFraction: 0.1 };
/**
 * El sol de la escena es muy intenso (ver `intensity` más abajo) y el volumen del masterplan se ilumina
 * con material estándar, no con el vidrio físico de la torre: con los colores del edificio tal cual se
 * sobreexpone a casi blanco. Estos factores oscurecen cada franja para que se vea del tono que es.
 */
const MASSING_SHADE = { slab: 0.42, glass: 0.26, ground: 0.55 };
/** Piso mínimo bajo un conjunto: más que la distancia a la que la cámara deja de ver (`far`). */
const MASTERPLAN_GROUND_SIZE = 1400;
/** Cuánto sube el rótulo de un edificio por encima de su azotea, en metros. */
const LABEL_LIFT = 4;

/** Un color (hex) multiplicado por un factor: 1 lo deja igual, menos de 1 lo oscurece. */
function shade(hex: string, factor: number): string {
  const color = new THREE.Color(hex);
  color.multiplyScalar(factor);
  return `#${color.getHexString()}`;
}

/** Cuánto se espera, como máximo, a que cargue lo que la entrada va a mostrar antes de animarla de todos modos (una red que no responde no deja la pantalla de carga para siempre). */
const INTRO_GATE_MAX_MS = 8000;

/** Cuánto dura resaltado el piso al llegar "enfocado" desde la fachada (SPEC §4.2). */
const FOCUSED_FLOOR_DURATION_MS = 3500;

/**
 * SPEC §8: ≥50fps en Android de gama media. El techo por defecto de R3F es 2; en
 * pantallas de alto DPI eso duplica (o más) los píxeles a sombrear para el vidrio con
 * reflejos + ContactShadows. 1.5 ya se ve nítido en celular y baja bastante el costo de
 * fill-rate; 0.75 es el piso al que `AdaptivePerformance` puede bajar si el fps cae.
 */
const DPR_RANGE: [number, number] = [0.75, 1.5];

/** Dirección del sol (normalizada): sol de media tarde, alto pero claramente de un lado. */
const SUN_DIRECTION: [number, number, number] = [0.55, 0.72, 0.42];

/** Resolución del shadow map: acotada a propósito (SPEC: cuida el rendimiento en móvil). */
const SHADOW_MAP_SIZE: [number, number] = [1024, 1024];
/** Un conjunto reparte la misma textura de sombra sobre mucho más terreno: se le da más resolución (en escritorio). */
const SHADOW_MAP_SIZE_ENSEMBLE: [number, number] = [2048, 2048];
/** A dónde apunta el sol: el centro del conjunto, a media altura. */
const SUN_TARGET: [number, number, number] = [ENSEMBLE_CENTER_X, ENSEMBLE_HEIGHT / 2, ENSEMBLE_CENTER_Z];
/** Radio que debe cubrir el frustum de la sombra: el conjunto completo más margen. */
const SHADOW_SCENE_RADIUS = Math.max(ENSEMBLE_SPAN, ENSEMBLE_HEIGHT) * 1.2;
/**
 * El campo de visión de `unitView.fov` es vertical: en un celular vertical eso deja un campo horizontal angostísimo
 * (se ve "con zoom"). Dentro de una unidad se abre lo necesario para que el horizontal no baje de este mínimo, hasta un tope.
 */
const UNIT_VIEW_MIN_HORIZONTAL_FOV_DEG = 75;
const UNIT_VIEW_MAX_FOV_DEG = 100;
/** Plano cercano dentro de una unidad: los ojos quedan a ~1 m del vidrio, así que el de la vista exterior (1 m) recortaría. */
const UNIT_VIEW_NEAR = 0.4;
/** Sin resumen de sol (el análisis solo se arma cuando hace falta). */
const NO_SUN_SUMMARIES: ReadonlyMap<string, SunSummary> = new Map();
/** Sin renders interiores: una sola referencia, para que el efecto de la ficha no vea un arreglo nuevo en cada render. */
const NO_INTERIORS: string[] = [];

/** Parámetros del modelo de cielo (Preetham) compartidos entre el `<Sky>` visible y el que
 *  alimenta el `<Environment>` de reflejos. `distance` es lo importante: el default de
 *  drei es 1000, pero la cámara tiene `far: 500` (ver abajo) — la cúpula del cielo se
 *  recortaba contra el plano lejano y apenas se veía, así que ajustar turbidity/rayleigh
 *  casi no cambiaba nada visible. 480 la deja cómodamente adentro de los 500. Con la
 *  cúpula completa ya visible: `turbidity` bajo + `rayleigh` alto es justo lo contrario de
 *  lo que parecía antes (más calina = cielo más lavado, no más profundo) — un cielo
 *  despejado con buen contraste cenit/horizonte es lo que de verdad se lee como "profundo".
 *
 *  Con la cámara casi a nivel (encuadre "media altura"), lo que se ve del cielo es sobre
 *  todo la franja baja cerca del horizonte — ahí el propio modelo físico siempre da un
 *  tono parejo y lavado, sea cual sea `turbidity`/`rayleigh` (así se ve un horizonte real).
 *  Por eso la niebla (`FOG_COLOR`, abajo) importa tanto como el cielo mismo para la
 *  sensación de profundidad: antes usaba el color cálido de marca (pensado para paneles de
 *  interfaz, no para el cielo) y los edificios lejanos se apagaban hacia un tono que no
 *  combinaba con el azul del cielo — rompía la perspectiva atmosférica en vez de reforzarla. */
const SKY_PARAMS: SkyParams = { distance: 400, turbidity: 2.2, rayleigh: 2.2, mieCoefficient: 0.006, mieDirectionalG: 0.8 };
/** Tono de la franja baja del cielo (horizonte) — la niebla debe apagar lo lejano hacia
 *  este color, no hacia el fondo cálido de la interfaz, para que edificios lejanos y cielo
 *  se sientan del mismo aire. */
const FOG_COLOR = '#CBDBE8';

/**
 * Nubes dispersas: sin ellas el cielo es solo el gradiente liso del modelo atmosférico, que
 * se lee plano por parejo que esté bien calculado — las nubes le dan al ojo algo con qué
 * medir profundidad y escala. Bajo poligonaje (icosaedros, mismo lenguaje que el follaje de
 * los árboles y las macetas de balcón) en vez de la textura/sprite que trae `<Cloud>` de
 * drei por default: esa textura se descarga de un CDN externo en cada carga, justo lo que
 * este proyecto ya evitó una vez con el HDRI del entorno (ver comentario de `<Environment>`
 * más abajo) — más lento en 4G y un punto de falla de menos. Con `MeshStandardMaterial`
 * (reacciona a la luz de la escena, sol + hemisferio ya puestos) cada nube sale más clara
 * del lado del sol sin configurar nada aparte.
 *
 * Cantidad, distancia, altura, opacidad y tamaño salen de `config.sky` (parametrizadas por
 * cliente); la distancia real se calcula cada vez contra `framing.maxDistance` — ver
 * `cloudPuffMatrices` más abajo — así que nunca hace falta perseguir a mano "qué tan lejos
 * es lejos" para la torre de un cliente distinto.
 */
/** Forma genérica de una nube en escala unitaria (offset x/y/z, radio): un puñado de
 *  esferas superpuestas, más anchas que altas — la silueta clásica de cúmulo. Cada nube la
 *  reusa a su propia escala y posición. */
const CLOUD_PUFFS: [number, number, number, number][] = [
  [-1.6, 0, 0.2, 1.1],
  [-0.7, 0.3, -0.3, 1.5],
  [0.3, 0.45, 0.1, 1.7],
  [1.3, 0.2, -0.2, 1.4],
  [2.1, -0.05, 0.3, 1],
  [0.2, -0.3, 0.6, 1.2],
  [-0.5, -0.25, -0.5, 1.1],
];
/** Azimuts repartidos uniformemente (360°/cantidad) desde este ángulo base — que no haya
 *  ninguna justo en el azimut de la cámara de entrada (38°, `CAMERA_AZIMUTH_DEG` en
 *  geometry.ts) evita que una nube quede pegada al punto exacto donde arranca la vista. */
const CLOUD_BASE_AZIMUTH_DEG = 195;
/** Salto de altura entre nubes (encima de `sky.cloudHeightFactor`), determinista por
 *  índice: no todas flotan exactamente al mismo nivel. */
const CLOUD_HEIGHT_JITTER = [0, 0.35, 0.15, 0.5];
/** Breakpoint "sm" de Tailwind — mismo criterio que ya usa el resto de la interfaz para
 *  distinguir móvil de escritorio. */
const MOBILE_BREAKPOINT_PX = 640;

// Bajada de 1.05: hace falta para compensar `intensity` del sol mucho más alta (ver abajo)
// y devolver la escena a un brillo general normal sin perder el contraste que esa
// intensidad le da a la sombra.
const TONE_MAPPING_EXPOSURE = 0.7;

/** FOV vertical de la cámara — una sola constante, la usan tanto el `Canvas` como el
 *  cálculo de encuadre (`computeCameraFraming`), para que nunca queden desincronizados. */
const CAMERA_FOV = 50;
/** Plano cercano de la cámara — misma razón que `CAMERA_FOV`: también la usa el cálculo
 *  del margen de colisión (abajo), para que nunca quede más corto que lo que la cámara
 *  puede en verdad acercarse sin recortar geometría. */
const CAMERA_NEAR = 1;
/** Colchón extra más allá del plano cercano, para que la cámara nunca quede recortando la
 *  geometría justo en el límite de colisión. */
const CAMERA_COLLISION_COMFORT = 1;

/** Escribe las matrices en el buffer del `InstancedMesh` una sola vez (o cuando cambian) y
 *  pide un cuadro — mismo patrón que `useInstanceMatrices` en los componentes de `engine/`. */
function useCloudInstanceMatrices(matrices: THREE.Matrix4[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    // La esfera envolvente se calcula al primer dibujo y no cuenta las instancias: sin recalcularla, la malla se descarta
    // (frustum culling) en cuanto la cámara deja de mirar hacia el origen, p. ej. desde adentro de una unidad.
    mesh.computeBoundingSphere();
    invalidate();
  }, [matrices, invalidate]);
  return ref;
}

/** No son vendibles ni interactivas: fuera del raycasting para no interferir con el picking. */
const noCloudRaycast = () => null;

/** Todas las esferas de `CLOUDS` en un solo `InstancedMesh` (un puñado de nubes de unas
 *  pocas esferas cada una — nunca son cientos de instancias, no hace falta más de uno). */
/** No dibuja nada: avisa una vez que se montó, para saber cuándo un `Suspense` mostró su contenido. */
function MountSignal({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return null;
}

const CloudPuffs = memo(function CloudPuffs({ matrices, opacity }: { matrices: THREE.Matrix4[]; opacity: number }) {
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0, transparent: true, opacity }),
    [opacity],
  );
  const ref = useCloudInstanceMatrices(matrices);
  if (matrices.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} raycast={noCloudRaycast} />;
});

/**
 * Ruta del selector 3D: `/aura` (el masterplan de un conjunto, o la única torre de un desarrollo
 * de un solo edificio), `/aura/edificio/:buildingId` y `/aura/edificio/:buildingId/unidad/:code`.
 */
export function Selector3D() {
  const { buildingId } = useParams<{ buildingId?: string }>();
  // Un edificio que no existe en el conjunto (enlace viejo o mal escrito): al masterplan.
  if (unitIdentity.multi && buildingId && !buildings.some((candidate) => candidate.id === buildingId)) {
    return <Navigate to={MASTERPLAN_PATH} replace />;
  }
  return <Selector3DScene />;
}

function Selector3DScene() {
  const i18n = useI18n();
  const { t, text, locale } = i18n;
  const { brand, balcony, roof, camera: cameraConfig, sky: skyConfig, materials, context, name: developmentName, whatsapp } = auraConfig;
  const [introDone, setIntroDone] = useState(false);
  const handleIntroComplete = useCallback(() => setIntroDone(true), []);
  // Avance real de la carga (pantalla de carga): lo que ya llegó de verdad, no un tiempo inventado.
  const [sceneReady, setSceneReady] = useState(false);
  const [introProgress, setIntroProgress] = useState(0);
  const [towerReady, setTowerReady] = useState(false);
  const [towerMounted, setTowerMounted] = useState(false);
  const [shadersReady, setShadersReady] = useState(false);
  const handleTowerMounted = useCallback(() => setTowerMounted(true), []);
  const handleShadersReady = useCallback(() => setShadersReady(true), []);
  // Mientras la cámara vuela de un edificio a otro, los controles y la colisión se apagan.
  const [flying, setFlying] = useState(false);
  // La cámara está (o está volando desde/hacia) dentro de una unidad: sin órbita ni colisión con el edificio.
  const [inside, setInside] = useState(false);
  const { units, developmentId, loadError, openContact } = useOutletContext<AuraOutletContext>();

  // Modo presentación: mientras corre, la interfaz se esconde, la cámara la lleva el director y el edificio que visita es el activo.
  const tourActive = useTourStore((state) => state.active);
  const tourRequested = useTourStore((state) => state.requested);
  const tourBuildingId = useTourStore((state) => state.buildingId);
  const tourUnitCode = useTourStore((state) => state.unitCode);
  const tourInsideUnit = useTourStore((state) => state.insideUnit);

  const { buildingId, code } = useParams<{ buildingId?: string; code?: string }>();
  const navigate = useNavigate();
  // `null` = el masterplan (solo en un conjunto sin edificio elegido); con una sola torre, siempre ella.
  const routeBuilding = unitIdentity.multi ? (buildings.find((candidate) => candidate.id === buildingId) ?? null) : buildings[0];
  const tourBuilding = tourActive && tourBuildingId ? (buildings.find((candidate) => candidate.id === tourBuildingId) ?? null) : null;
  const activeBuilding = tourBuilding ?? routeBuilding;
  const activeId = activeBuilding?.id ?? null;

  const selectedUnitKey = useSelectionStore((state) => state.selectedUnitKey);
  const selectUnit = useSelectionStore((state) => state.selectUnit);
  const focusedFloor = useSelectionStore((state) => state.focusedFloor);
  const setFocusedFloor = useSelectionStore((state) => state.setFocusedFloor);

  const bedrooms = useFiltersStore((state) => state.bedrooms);
  const priceMin = useFiltersStore((state) => state.priceMin);
  const priceMax = useFiltersStore((state) => state.priceMax);
  const onlyAvailable = useFiltersStore((state) => state.onlyAvailable);
  const showAvailability = useFiltersStore((state) => state.showAvailability);
  // Memoizado: un objeto nuevo en cada render (aunque los VALORES no cambien) le llega a
  // <Tower> como "prop distinta" y, si Tower está en React.memo, invalida esa memoización
  // sin razón — por ejemplo, cada vez que se abre/cierra un panel que no toca filtros.
  const filters = useMemo(
    () => ({ bedrooms, priceMin, priceMax, onlyAvailable }),
    [bedrooms, priceMin, priceMax, onlyAvailable],
  );
  // Cualquier filtro activo implica "ver disponibilidad" aunque el toggle manual esté apagado.
  const availabilityMode = showAvailability || hasActiveFilters(filters);

  // URL -> selección: entrar a la ruta de una unidad, o usar atrás/adelante, selecciona esa
  // unidad. Es la única dirección manejada con efecto; selección -> URL se hace de forma
  // imperativa en `handleSelectUnit` (ver abajo). Con las dos direcciones en efectos —cada
  // una reaccionando al resultado de la otra— la selección inicial (código de la URL,
  // `selectedUnitKey` todavía null) y el efecto opuesto (que lee ese mismo `selectedUnitKey`
  // todavía no actualizado) se contradicen en el primer render y quedan rebotando para
  // siempre; con una sola dirección en efecto no hay con qué pelearse.
  const urlKey = code && activeBuilding ? unitIdentity.param({ buildingId: activeBuilding.id, code }) : null;
  useEffect(() => {
    if (urlKey !== selectedUnitKey) selectUnit(urlKey);
  }, [urlKey, selectedUnitKey, selectUnit]);

  // El resaltado de "piso enfocado" (llegando desde la fachada) se apaga solo.
  useEffect(() => {
    if (focusedFloor === null) return undefined;
    const timeout = setTimeout(() => setFocusedFloor(null), FOCUSED_FLOOR_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [focusedFloor, setFocusedFloor]);

  // Analítica (se vende como reporte mensual, ver /admin → Analítica): una vista del selector por
  // carga y por edificio al que se entra (en un conjunto el edificio va en `metadata`) —
  // `developmentId` solo cambia cuando el fetch inicial resuelve (AuraLayout.tsx).
  useEffect(() => {
    if (!developmentId) return;
    trackEvent({
      developmentId,
      type: 'selector_view',
      metadata: unitIdentity.multi ? { building: activeId ?? 'masterplan' } : undefined,
    });
  }, [developmentId, activeId]);

  // Una unidad "vista" es que `selectedUnitKey` deje de ser null, sin importar cómo llegó
  // ahí (clic directo, link compartido, o piso enfocado desde Fachada y luego clic) — todas
  // pasan por el mismo store, así que un solo efecto las cubre todas. `units` a propósito fuera
  // de las dependencias: cambia de referencia en cada actualización de Realtime (un cambio de
  // estado/precio, no una nueva vista), y volver a contar la misma unidad por eso sería ruido.
  useEffect(() => {
    if (!developmentId || !selectedUnitKey) return;
    const unit = unitIdentity.find(units, selectedUnitKey);
    trackEvent({ developmentId, type: 'unit_view', unitId: unit?.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId, selectedUnitKey]);

  // Filtros usados: con debounce (800ms de silencio) para no registrar un evento por cada
  // tecleo en el rango de precio — solo cuenta cuando el usuario deja de tocar los
  // controles con al menos un filtro activo.
  useEffect(() => {
    if (!developmentId || !hasActiveFilters(filters)) return undefined;
    const timeout = setTimeout(() => {
      trackEvent({ developmentId, type: 'filter_used', metadata: { bedrooms, priceMin, priceMax, onlyAvailable } });
    }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId, bedrooms, priceMin, priceMax, onlyAvailable]);

  // useCallback (no una función declarada a secas): se pasa a <Tower>, que está en React.memo —
  // una referencia nueva en cada render invalidaría esa memoización sin razón. Recibe el código
  // de la unidad DENTRO del edificio activo (los códigos solo son únicos por edificio).
  const handleSelectUnit = useCallback(
    (nextCode: string | null) => {
      if (!activeId) return;
      selectUnit(nextCode ? unitIdentity.param({ buildingId: activeId, code: nextCode }) : null);
      const home = unitIdentity.multi ? buildingPath(activeId) : MASTERPLAN_PATH;
      navigate(nextCode ? unitIdentity.pathFor(activeId, nextCode) : home, { replace: true });
    },
    [activeId, selectUnit, navigate],
  );

  // Entrar a un edificio desde el masterplan: la ruta cambia y la cámara vuela hacia él. No antes
  // de que termine la animación de entrada (dos animaciones moviendo la cámara se pisarían).
  const handleSelectBuilding = useCallback(
    (id: string) => {
      // Durante la presentación un toque solo la detiene: no debe además entrar al edificio que haya debajo.
      if (!introDone || useTourStore.getState().active) return;
      selectUnit(null);
      navigate(buildingPath(id));
    },
    [introDone, selectUnit, navigate],
  );

  // Al abrir el masterplan, baja el detalle de los edificios en un momento libre: cuando se toque
  // uno, el código ya está y no hay espera.
  useEffect(() => {
    if (!unitIdentity.multi) return undefined;
    const prefetch = () => void loadTower();
    // Safari no tiene `requestIdleCallback`: ahí basta esperar un momento.
    if (typeof window.requestIdleCallback === 'function') {
      const idle = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(prefetch, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // Aspecto de la ventana al montar: basta con esto (no reactivo a resize) para distinguir
  // celular vertical de escritorio — el encuadre de entrada solo se calcula una vez, igual
  // que antes cuando `camera.intro` era un vector fijo.
  const aspect = useMemo(() => (typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight), []);
  // Mismo criterio que `aspect`: se calcula una vez al montar, no reactivo a resize — un
  // giro de orientación a medio uso no debería hacer aparecer/desaparecer nubes de golpe.
  const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX, []);

  // Un encuadre por edificio (su caja real en el mundo, ya girada) y uno para el conjunto
  // completo. El masterplan y cada edificio son poses de cámara distintas: cambiar de uno a otro
  // es un vuelo (`CameraFocus`), no un salto.
  const framings = useMemo(() => {
    const byBuilding = new Map<string, CameraFraming>();
    for (const building of buildings) {
      byBuilding.set(building.id, computeCameraFraming(worldBounds(building), buildingHeight(building), aspect, CAMERA_FOV));
    }
    const master = unitIdentity.multi ? computeCameraFraming(ENSEMBLE_BOUNDS, ENSEMBLE_HEIGHT, aspect, CAMERA_FOV, MASTERPLAN_VIEW) : null;
    return { byBuilding, master };
  }, [aspect]);
  const framing = (activeId ? framings.byBuilding.get(activeId) : framings.master) ?? framings.byBuilding.values().next().value!;
  // La entrada (animación orbitando) ocurre una sola vez, hacia donde se abre la página.
  const [initialFraming] = useState(framing);
  // Las nubes se plantan más allá de lo más lejos que la cámara pueda llegar: el masterplan es lo más lejos.
  const cloudMaxDistance = (framings.master ?? framing).maxDistance;

  // Volumen de colisión de la cámara (SPEC: nunca debe quedar dentro de la torre) — huella y
  // altura reales expandidas por los márgenes del cliente (`cameraConfig`, pensados para
  // "se ve bien"). Pero el margen también tiene que ganarle a lo que de verdad sobresale del
  // volumen nominal (balcones, pérgola de azotea) MÁS el propio plano cercano de la cámara:
  // si el margen es menor a eso, la cámara puede quedar a menos de `CAMERA_NEAR` de un
  // balcón o la pérgola y esa geometría se recorta (se ve "sin textura", plana). Por eso es
  // el máximo entre lo que pide la config y ese piso de seguridad, no la config a secas.
  // `OrbitControls.minDistance` usa el límite grueso (`minDistance`, la cara más cercana);
  // `CameraCollision` aplica el límite fino por dirección cada cuadro. En el masterplan la caja
  // envuelve el conjunto entero; dentro de un edificio, solo ese edificio.
  const horizontalCollisionMargin = Math.max(
    cameraConfig.collisionHorizontalMargin,
    balcony.depth + CAMERA_NEAR + CAMERA_COLLISION_COMFORT,
  );
  const topCollisionMargin = Math.max(
    cameraConfig.collisionTopMargin,
    roof.pergolaHeight + CAMERA_NEAR + CAMERA_COLLISION_COMFORT,
  );
  const cameraLimits = useMemo(() => {
    const focusBounds = activeBuilding ? worldBounds(activeBuilding) : ENSEMBLE_BOUNDS;
    const focusHeight = activeBuilding ? buildingHeight(activeBuilding) : ENSEMBLE_HEIGHT;
    return computeCameraLimits(focusBounds, focusHeight, framing.target, horizontalCollisionMargin, topCollisionMargin);
    // `activeBuilding` es siempre el mismo objeto por id (sale de `buildings`, constante).
  }, [activeBuilding, framing.target, horizontalCollisionMargin, topCollisionMargin]);
  const minPolarAngle = (cameraConfig.minPolarAngleDeg * Math.PI) / 180;
  const maxPolarAngle = (cameraConfig.maxPolarAngleDeg * Math.PI) / 180;

  // Unidades del edificio activo (dentro de un edificio los códigos son únicos) y la unidad abierta.
  const buildingUnits = useMemo(
    () => (activeId ? units.filter((candidate) => candidate.buildingId === activeId) : []),
    [units, activeId],
  );
  const selectedUnit = unitIdentity.find(units, selectedUnitKey) ?? null;
  const selectedBuilding = selectedUnit ? buildings.find((candidate) => candidate.id === selectedUnit.buildingId) : undefined;
  const selectedUnitPolygon = selectedUnit && selectedBuilding ? findUnitPolygon(selectedBuilding.geometry, selectedUnit) : undefined;
  const selectedUnitPlanKey = selectedUnit ? unitMediaKey(selectedUnit, auraConfig.floorPlans) : undefined;
  const selectedUnitFloorPlan = selectedUnitPlanKey ? auraConfig.floorPlans[selectedUnitPlanKey] : undefined;
  const selectedUnitInteriorsKey = selectedUnit ? unitMediaKey(selectedUnit, auraConfig.interiors) : undefined;
  const selectedUnitInteriors = selectedUnitInteriorsKey ? (auraConfig.interiors[selectedUnitInteriorsKey] ?? NO_INTERIORS) : NO_INTERIORS;

  // ── Asoleamiento ──
  // Las horas de sol se calculan por edificio y fecha (no por hora del día: mover la hora solo mueve la luz), y solo
  // cuando hacen falta: una ficha abierta o el mapa de sol de tarde encendido.
  const sunEnabled = useSunStore((state) => state.enabled);
  const afternoonMap = useSunStore((state) => state.afternoonMap);
  const sunDate = useSunStore((state) => state.date);
  const sunDateKey = formatMonthDay(sunDate);
  const selectedHere = selectedUnit && activeBuilding && selectedUnit.buildingId === activeBuilding.id ? selectedUnit : null;
  const afternoonMapActive = sunEnabled && afternoonMap && Boolean(activeBuilding?.sellable);
  const needSunSummaries = Boolean(solarConfig && activeBuilding?.sellable && (selectedHere || afternoonMapActive));
  const sunSummaries = useMemo(() => {
    const date = parseMonthDay(sunDateKey);
    return needSunSummaries && activeId && date ? buildingSunSummaries(activeId, date) : NO_SUN_SUMMARIES;
  }, [needSunSummaries, activeId, sunDateKey]);
  const unitTints = useMemo(() => (afternoonMapActive && sunSummaries.size > 0 ? afternoonTints(sunSummaries) : undefined), [afternoonMapActive, sunSummaries]);
  const selectedCode = selectedHere?.code;
  const selectedUnitSun = useMemo<UnitSunInfo | undefined>(() => {
    const summary = selectedCode ? sunSummaries.get(selectedCode) : undefined;
    const date = parseMonthDay(sunDateKey);
    if (!solarConfig || !summary || !date) return undefined;
    return {
      summary,
      dateLabel: formatMonthDayLong(date, locale),
      hourRange: solarConfig.hourRange,
      afternoonFromHour: solarConfig.afternoonFromHour,
      afternoonMinHours: solarConfig.afternoonMinHours,
    };
  }, [selectedCode, sunSummaries, sunDateKey, locale]);

  // ── Vista desde la unidad ──
  // Va en la URL (?vista=unidad): se puede compartir y volver con el botón del navegador. Solo existe con una unidad
  // abierta de este edificio, y espera a que termine la animación de entrada.
  const unitViewConfig = auraConfig.unitView;
  const [searchParams, setSearchParams] = useSearchParams();
  const unitViewRequested = searchParams.get('vista') === 'unidad';
  const unitViewPose = useMemo(
    () => (selectedCode && activeId && activeBuilding?.sellable ? unitViewPoseFor(activeId, selectedCode) : null),
    [selectedCode, activeId, activeBuilding],
  );
  const viewFromUnit = unitViewRequested && introDone && !tourActive && unitViewConfig !== undefined && unitViewPose !== null;
  const unitViewFov = useMemo(() => {
    if (!unitViewConfig) return CAMERA_FOV;
    const halfHorizontal = (UNIT_VIEW_MIN_HORIZONTAL_FOV_DEG * Math.PI) / 360;
    const verticalForMinimum = (2 * Math.atan(Math.tan(halfHorizontal) / aspect) * 180) / Math.PI;
    return Math.min(UNIT_VIEW_MAX_FOV_DEG, Math.max(unitViewConfig.fov, verticalForMinimum));
  }, [unitViewConfig, aspect]);
  const enterUnitView = useCallback(() => setSearchParams({ vista: 'unidad' }, { replace: true }), [setSearchParams]);
  const exitUnitView = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);
  useEscapeKey(exitUnitView, viewFromUnit);

  // `inside` entra con la vista y sale hasta que termina el vuelo de regreso: si no, la colisión de la cámara (que
  // empuja fuera del edificio) y la órbita se encenderían con la cámara todavía adentro y la sacarían de golpe.
  const viewFromUnitRef = useRef(viewFromUnit);
  useEffect(() => {
    viewFromUnitRef.current = viewFromUnit;
    if (viewFromUnit) setInside(true);
  }, [viewFromUnit]);
  const handleFlightChange = useCallback((isFlying: boolean) => {
    setFlying(isFlying);
    if (!isFlying && !viewFromUnitRef.current) setInside(false);
  }, []);
  // La brújula arranca mirando hacia donde la vista abre.
  useEffect(() => {
    if (unitViewPose) useLookStore.getState().setYaw(unitViewPose.yaw);
  }, [unitViewPose]);
  const handleLookYaw = useCallback((yaw: number) => useLookStore.getState().setYaw(yaw), []);

  // ── Carga ──
  // El código del edificio (se baja aparte) solo se espera si hay un edificio que dibujar; el masterplan se pinta sin él.
  const needsTower = activeBuilding !== null;
  useEffect(() => {
    if (!needsTower) return undefined;
    let alive = true;
    const ready = () => alive && setTowerReady(true);
    void loadTower().then(ready, ready);
    return () => {
      alive = false;
    };
  }, [needsTower]);
  const inventoryReady = units.length > 0 || loadError !== null;
  const towerDone = !needsTower || towerReady;
  // La animación de entrada espera a que haya qué mostrar (inventario, código del edificio y escena); si algo tarda de más, arranca igual.
  const [gateExpired, setGateExpired] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setGateExpired(true), INTRO_GATE_MAX_MS);
    return () => window.clearTimeout(timer);
  }, []);
  // Los shaders se compilan en paralelo cuando ya está en la escena lo que se va a dibujar (el edificio, si hay uno), antes del primer cuadro.
  const compileScene = sceneReady && (!needsTower || towerMounted);
  const introStart = (inventoryReady && towerDone && sceneReady && shadersReady) || gateExpired;
  // La pantalla de carga se va en cuanto la escena ya se dibujó (primer cuadro de la animación de entrada): la entrada de la cámara
  // es parte de lo que se ve, no algo que esperar escondido detrás de la pantalla.
  const sceneShown = introDone || (introStart && introProgress > 0);
  // Pesos: arranque 10 %, inventario 35 %, código del edificio 25 %, escena 20 % y el primer cuadro dibujado 10 %.
  const loadProgress = sceneShown ? 1 : 0.1 + (inventoryReady ? 0.35 : 0) + (towerDone ? 0.25 : 0) + (sceneReady ? 0.1 : 0) + (shadersReady ? 0.1 : 0);
  // Qué cambia dónde cae una sombra: el edificio activo, que ya esté montado su detalle y si se está dentro de una unidad (ahí la
  // fachada deja de proyectar). El sol se suma dentro de `SunLighting`. Girar la cámara o elegir unidades no cambia ninguna sombra.
  const shadowedUnitCode = inside ? (selectedHere?.code ?? null) : tourInsideUnit ? tourUnitCode : null;
  const shadowKey = `${activeId ?? 'masterplan'}|${towerDone ? 'detail' : 'loading'}|${shadowedUnitCode ?? '-'}`;
  const loadStep = !inventoryReady ? t('loading.inventory') : !towerDone ? t('loading.building') : !sceneReady || !shadersReady ? t('loading.scene') : t('loading.camera');

  // ── Presentación (recorrido automático) ──
  // La cámara la lleva `TourDirector` por una pista armada con la pose de arranque, el edificio y la unidad elegidos. Aquí
  // viven el arranque, el paro con cualquier interacción y lo que acompaña a la cámara (rótulos, sol, "dentro de la unidad").
  interface TourRun {
    plan: TourPlan;
    track: CameraTrack;
    runner: ReturnType<typeof createTourRunner>;
    meta: { buildingId: string; unit: Unit | null; headingDeg: number | null; sunHours: number | null };
  }
  const poseProbe = useRef<(() => CameraPose) | null>(null);
  const [tourRun, setTourRun] = useState<TourRun | null>(null);
  const tourRunRef = useRef<TourRun | null>(null);
  const [tourStopToken, setTourStopToken] = useState(0);
  // La pose de la cámara al empezar: `CameraFocus` sigue recibiendo esa, sin importar a dónde vaya la cámara, para no iniciar vuelos propios.
  const [tourFrozen, setTourFrozen] = useState<{ position: [number, number, number]; target: [number, number, number] } | null>(null);
  const sunSnapshot = useRef<{ enabled: boolean; date: { month: number; day: number }; hour: number; afternoonMap: boolean } | null>(null);

  // El sol del barrido: guarda cómo estaba el control y lo restaura al terminar.
  const setTourSunHour = useCallback((hour: number | null) => {
    if (hour === null) {
      if (sunSnapshot.current) {
        useSunStore.setState(sunSnapshot.current);
        sunSnapshot.current = null;
      }
      return;
    }
    const current = useSunStore.getState();
    if (!sunSnapshot.current) sunSnapshot.current = { enabled: current.enabled, date: current.date, hour: current.hour, afternoonMap: current.afternoonMap };
    const date = (solarConfig && parseMonthDay(solarConfig.defaultDate)) || current.date;
    useSunStore.setState({ enabled: true, hour, date, afternoonMap: false });
  }, []);

  useEffect(() => {
    if (!tourRequested || tourActive || !introDone || units.length === 0 || flying) return;
    // Desde dentro de una unidad primero se sale a la vista exterior; el recorrido arranca cuando termina ese vuelo.
    if (viewFromUnit || inside) {
      if (viewFromUnit) exitUnitView();
      return;
    }
    const probe = poseProbe.current;
    if (!probe) return;

    const settings = presentationSettings();
    const featured = pickFeaturedUnit(
      units,
      unitIdentity.param,
      (unit) => Boolean(buildings.find((candidate) => candidate.id === unit.buildingId)?.sellable) && unitViewPoseFor(unit.buildingId, unit.code) !== null,
    );
    const pose = featured && unitViewConfig ? unitViewPoseFor(featured.buildingId, featured.code) : null;
    const building = (featured ? buildings.find((candidate) => candidate.id === featured.buildingId) : undefined) ?? routeBuilding ?? buildings.find((candidate) => candidate.sellable) ?? buildings[0];
    const bounds = worldBounds(building);
    const facing = pose ? Math.hypot(pose.target[0] - pose.position[0], pose.target[2] - pose.position[2]) || 1 : 1;
    const plan = buildTourPlan({
      home: probe(),
      exteriorFov: CAMERA_FOV,
      interiorFov: unitViewFov,
      exteriorNear: CAMERA_NEAR,
      interiorNear: UNIT_VIEW_NEAR,
      unit: pose ? { eye: pose.position, heading: [(pose.target[0] - pose.position[0]) / facing, (pose.target[2] - pose.position[2]) / facing] } : null,
      building: { center: [building.position[0], building.position[1]], radius: Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 },
      durationSeconds: settings.tourSeconds,
      sun: solarConfig ? { fromHour: settings.sunSweepHours[0], toHour: settings.sunSweepHours[1] } : null,
    });
    const sunDate = solarConfig ? parseMonthDay(solarConfig.defaultDate) : null;
    const sunHours = featured && sunDate ? (buildingSunSummaries(building.id, sunDate).get(featured.code)?.directHours ?? null) : null;
    const runner = createTourRunner(plan, {
      setCaption: (caption) => useTourStore.getState().setCaption(caption),
      setProgress: (progress) => useTourStore.getState().setProgress(progress),
      setInside: (isInside) => useTourStore.getState().setInsideUnit(isInside),
      setSunHour: setTourSunHour,
    });
    const run: TourRun = { plan, track: { keyframes: plan.keyframes, duration: plan.duration }, runner, meta: { buildingId: building.id, unit: featured, headingDeg: pose ? pose.headingDeg : null, sunHours } };

    // Paneles y hojas fuera: la presentación se ve limpia.
    useFavoritesStore.getState().closePanel();
    useCompareStore.getState().closeCompare();
    tourRunRef.current = run;
    setTourFrozen({ position: framing.intro, target: framing.target });
    setTourRun(run);
    setTourStopToken(0);
    useTourStore.setState({ loop: true });
    useTourStore.getState().begin(building.id, featured?.code ?? null);
    // Baja el detalle del edificio ya: la órbita inicial da tiempo de sobra a que monte.
    void loadTower();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourRequested, tourActive, introDone, units, flying, viewFromUnit, inside]);

  // Cualquier interacción detiene el recorrido (la cámara vuelve sola a donde estaba).
  useEffect(() => {
    if (!tourActive) return undefined;
    const stop = () => {
      useTourStore.setState({ loop: false });
      setTourStopToken((token) => token + 1);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, stop, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, stop));
  }, [tourActive]);

  const handleTourTime = useCallback((time: number, progress: number) => tourRunRef.current?.runner.update(time, progress), []);
  const handleTourEnd = useCallback(
    (completed: boolean) => {
      const current = tourRunRef.current;
      current?.runner.finish();
      // Sin interacción vuelve a empezar: la pantalla corre sola hasta que alguien la toque.
      if (completed && current && useTourStore.getState().loop) {
        setTourRun({ ...current, track: { ...current.track } });
        return;
      }
      tourRunRef.current = null;
      setTourRun(null);
      setTourFrozen(null);
      useTourStore.getState().end();
    },
    [],
  );

  // Los rótulos: salen de la config y de la unidad elegida, en el idioma de la interfaz.
  const tourTexts = useMemo<Record<TourCaptionId, TourCaptionText>>(() => {
    const meta = tourRun?.meta;
    const building = meta ? buildings.find((candidate) => candidate.id === meta.buildingId) : undefined;
    const availability = building ? buildingAvailability(units, building.id) : null;
    const buildingLine = building
      ? [t('tour.levels', { levels: building.geometry.levels }), availability && availability.total > 0 ? t('legend.count', { available: availability.available, total: availability.total }) : null].filter(Boolean).join(' · ')
      : '';
    const unit = meta?.unit ?? null;
    return {
      intro: { title: developmentName, subtitle: text(auraConfig.tagline) },
      building: { title: building ? text(building.name) : developmentName, subtitle: buildingLine },
      unit: unit
        ? {
            title: t('pdf.apartment', { code: unit.code }),
            subtitle: `${t('quoteSheet.summary', { type: unit.type, m2: unit.m2, bedrooms: unit.bedrooms, floor: unit.floor })} · ${i18n.money(unit.price)}`,
          }
        : { title: developmentName },
      window: { title: t('tour.windowTitle'), subtitle: meta?.headingDeg != null ? t('tour.facing', { direction: t(`compass.${compassKey(meta.headingDeg)}`) }) : undefined },
      sun: { title: t('tour.sunTitle'), subtitle: meta?.sunHours ? t('tour.sunHours', { hours: Math.round(meta.sunHours * 2) / 2 }) : t('tour.sunGeneric') },
      outro: { title: t('tour.outroTitle'), subtitle: t('tour.touch') },
    };
  }, [tourRun, units, t, text, i18n, developmentName]);

  // La ficha de unidad se anima al cerrar (usePresence retiene lo último no-nulo mientras
  // juega la transición de salida) — se dispara con la clave (string estable), no con el
  // objeto `Unit` completo: ese objeto cambia de referencia en cada actualización de
  // Realtime aunque sea la misma unidad, y reiniciaría la animación de entrada sin motivo.
  const { rendered: presentUnitKey, visible: unitPanelVisible } = usePresence(selectedUnitKey, 280);
  const [lastUnitPanelData, setLastUnitPanelData] = useState<{
    unit: Unit;
    buildingName: string | undefined;
    polygon: Point[] | undefined;
    floorPlan: FloorPlanConfig | undefined;
    interiors: string[];
    sun: UnitSunInfo | undefined;
  } | null>(null);
  useEffect(() => {
    if (selectedUnit) {
      setLastUnitPanelData({
        unit: selectedUnit,
        buildingName: unitIdentity.multi && selectedBuilding ? text(selectedBuilding.name) : undefined,
        polygon: selectedUnitPolygon,
        floorPlan: selectedUnitFloorPlan,
        interiors: selectedUnitInteriors,
        sun: selectedUnitSun,
      });
    }
  }, [selectedUnit, selectedBuilding, selectedUnitPolygon, selectedUnitFloorPlan, selectedUnitInteriors, selectedUnitSun, text]);

  // Un conjunto reparte la misma textura de sombra sobre mucho más terreno: se le da más resolución (en escritorio).
  const shadowMapSize = unitIdentity.multi && !isMobile ? SHADOW_MAP_SIZE_ENSEMBLE : SHADOW_MAP_SIZE;

  // Una matriz por esfera de nube (todas las nubes comparten un solo InstancedMesh). El
  // radio de cada nube es SIEMPRE la distancia máxima a la que `OrbitControls` deja alejar la
  // cámara (en cualquier encuadre) por `sky.cloudDistanceMargin`: más allá de eso la cámara
  // nunca puede llegar, así que las nubes quedan fuera del volumen de espacio que la cámara
  // puede ocupar, sin importar el ángulo o el zoom — nunca pueden quedar entre la cámara y la
  // torre. El conteo baja en móvil (`cloudCountMobile`).
  const cloudPuffMatrices = useMemo(() => {
    const count = isMobile ? skyConfig.cloudCountMobile : skyConfig.cloudCount;
    if (count <= 0) return [];
    const matrices: THREE.Matrix4[] = [];
    const cloudRadius = cloudMaxDistance * skyConfig.cloudDistanceMargin;
    for (let index = 0; index < count; index += 1) {
      const azimuthDeg = CLOUD_BASE_AZIMUTH_DEG + (360 / count) * index;
      const azimuthRad = (azimuthDeg * Math.PI) / 180;
      const heightFactor = skyConfig.cloudHeightFactor + CLOUD_HEIGHT_JITTER[index % CLOUD_HEIGHT_JITTER.length];
      const centerX = ENSEMBLE_CENTER_X + cloudRadius * Math.cos(azimuthRad);
      const centerY = ENSEMBLE_HEIGHT * heightFactor;
      const centerZ = ENSEMBLE_CENTER_Z + cloudRadius * Math.sin(azimuthRad);
      for (const [dx, dy, dz, puffRadius] of CLOUD_PUFFS) {
        const position = new THREE.Vector3(
          centerX + dx * skyConfig.cloudScale,
          centerY + dy * skyConfig.cloudScale,
          centerZ + dz * skyConfig.cloudScale,
        );
        const scale = puffRadius * skyConfig.cloudScale;
        matrices.push(new THREE.Matrix4().compose(position, new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)));
      }
    }
    return matrices;
  }, [isMobile, skyConfig, cloudMaxDistance]);

  // Volúmenes del masterplan (un conjunto): la forma de cada edificio con sus franjas de vidrio y losa.
  // Es estable (solo depende de la config): los cambios de disponibilidad no la reconstruyen.
  const massingItems = useMemo<MassingItem[]>(() => {
    if (!unitIdentity.multi) return [];
    return buildings.map((building) => {
      const placement = buildingPlacement(building);
      return {
        id: building.id,
        polygons: [...building.geometry.plate.map((plateUnit) => plateUnit.polygon), building.geometry.core],
        bands: massingBands(building.geometry, {
          slab: shade(materials.concrete, MASSING_SHADE.slab),
          glass: shade(materials.glass, MASSING_SHADE.glass),
          ground: shade(materials.profile, MASSING_SHADE.ground),
        }),
        position: placement.position,
        pivot: placement.pivot,
        rotationY: placement.rotationY,
      };
    });
  }, [materials.concrete, materials.glass, materials.profile]);

  // El tinte de cada volumen: blanco (se ven los colores del edificio), o —con "ver disponibilidad"—
  // vira hacia el estado que resume al edificio.
  const massingTints = useMemo(() => {
    const white = new THREE.Color('#ffffff');
    return new Map(
      buildings.map((building) => {
        const status = availabilityMode && building.sellable ? availabilityStatus(buildingAvailability(units, building.id)) : null;
        const tint = status ? white.clone().lerp(new THREE.Color(STATUS_COLORS[status]), MASSING_STATUS_STRENGTH) : white;
        return [building.id, `#${tint.getHexString()}`] as const;
      }),
    );
  }, [units, availabilityMode]);

  // Rótulos con el contador de disponibilidad de cada edificio (solo en el masterplan).
  const labelItems = useMemo<BuildingLabelItem[]>(
    () =>
      buildings.map((building) => {
        const availability = building.sellable ? buildingAvailability(units, building.id) : null;
        return {
          id: building.id,
          name: text(building.name),
          position: [building.position[0], buildingHeight(building) + LABEL_LIFT, building.position[1]],
          availability: availability ? { available: availability.available, total: availability.total } : null,
          status: availability ? availabilityStatus(availability) : null,
          caption: t(`kind.${building.kind}`),
        };
      }),
    [units, text, t],
  );

  // Edificio sin unidades (casa club, amenidades): al entrar, una tarjeta dice qué es.
  const { rendered: presentInfoBuildingId, visible: infoCardVisible } = usePresence(
    activeBuilding && !activeBuilding.sellable ? activeBuilding.id : null,
    300,
  );
  const infoBuilding = buildings.find((candidate) => candidate.id === presentInfoBuildingId);

  // Migas de pan: Masterplan › Edificio › Piso · Unidad. La primera vuelve al masterplan; solo en un conjunto.
  const crumbs = useMemo<Crumb[]>(() => {
    if (!unitIdentity.multi) return [];
    if (!activeBuilding) return [{ label: t('crumbs.masterplan') }];
    const unitCrumb: Crumb[] =
      selectedUnit && selectedUnit.buildingId === activeBuilding.id ? [{ label: t('crumbs.floorUnit', { floor: selectedUnit.floor, code: selectedUnit.code }) }] : [];
    return [
      { label: t('crumbs.masterplan'), to: MASTERPLAN_PATH },
      unitCrumb.length > 0 ? { label: text(activeBuilding.name), to: buildingPath(activeBuilding.id) } : { label: text(activeBuilding.name) },
      ...unitCrumb,
    ];
  }, [activeBuilding, selectedUnit, t, text]);

  const placement = activeBuilding ? buildingPlacement(activeBuilding) : null;
  const activeBounds = activeBuilding ? worldBounds(activeBuilding) : null;
  // Con los rótulos y las migas arriba, el resto de los controles de la esquina bajan un renglón.
  const topControlsClass = unitIdentity.multi ? 'top-28' : 'top-20';

  return (
    // `select-none`: arrastrar para orbitar la torre (escritorio) podía iniciar una
    // selección de texto nativa del navegador si el gesto pasaba cerca de la leyenda o
    // los filtros — el cursor terminaba subrayando letras en vez de solo girar la cámara.
    <div className="relative h-dvh w-screen select-none bg-neutral-900">
      <h1 className="sr-only">{developmentName}</h1>
      <Canvas
        role="img"
        aria-label={t('selector.canvasLabel', { name: developmentName })}
        // `frameloop="demand"` ya evita recalcular el shadow map en frames de más: el
        // shadow map de three.js se recalcula en cada render (autoUpdate por default),
        // y bajo "demand" solo hay render cuando algo realmente invalida la escena.
        onCreated={() => setSceneReady(true)}
        frameloop="demand"
        // `"soft"` (y también `true`) le piden a R3F `PCFSoftShadowMap` — tipo que la
        // versión de three.js instalada (0.186) ya no soporta: el renderer lo detecta en
        // el primer frame y lo sustituye por PCFShadowMap con un warning en consola. El
        // pedido de la SPEC siempre fue sombra DURA y bien definida (ver `shadow-radius={1}`
        // abajo), así que `"percentage"` —que R3F mapea directo a PCFShadowMap— pide
        // exactamente eso desde el inicio, sin pasar por el tipo eliminado ni su warning.
        shadows="percentage"
        // `near` antes era 0.1: junto con `far=500` da una proporción far/near de 5000:1,
        // que deja muy poca precisión de profundidad disponible para la escena real (todo
        // pasa a metros del target, nunca a centímetros de la cámara). A poca distancia esa
        // falta de precisión se nota grueso (no como un parpadeo de un píxel): el vidrio y
        // lo que tiene detrás (mullions, forro interior) compiten por el mismo valor de
        // profundidad y el más cercano "gana" de forma inestable. El margen de colisión de
        // la cámara (`horizontalCollisionMargin`/`topCollisionMargin`, arriba) ya garantiza
        // que la cámara nunca quede más cerca de la torre que `CAMERA_NEAR`.
        camera={{ position: initialFraming.intro, fov: CAMERA_FOV, near: CAMERA_NEAR, far: 500 }}
        // Dentro de una unidad un toque sobre el vacío es mirar alrededor, no deseleccionar.
        onPointerMissed={() => {
          if (!inside && !useTourStore.getState().active) handleSelectUnit(null);
        }}
        dpr={DPR_RANGE}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: TONE_MAPPING_EXPOSURE }}
      >
        {/* Sol, cielo, niebla y reflejos: fijos, o siguiendo el control de asoleamiento (`SunLighting`). */}
        <SunLighting
          solar={solarConfig}
          target={SUN_TARGET}
          sceneRadius={SHADOW_SCENE_RADIUS}
          fixedDirection={SUN_DIRECTION}
          shadowMapSize={shadowMapSize}
          skyParams={SKY_PARAMS}
          fogColor={FOG_COLOR}
          shadowKey={shadowKey}
        />

        {/* Nubes: `MeshStandardMaterial` reacciona a la luz de la escena (sol +
            hemisferio ya puestos para la sombra), así que sin configurar nada aparte salen
            más claras del lado del sol. Estáticas (nunca cambian tras el primer cuadro), así
            que no pelean con `frameloop="demand"` — se pintan una vez y ya. */}
        <CloudPuffs matrices={cloudPuffMatrices} opacity={skyConfig.cloudOpacity} />

        <Context footprint={ENSEMBLE_BOUNDS} context={context} minGroundSize={unitIdentity.multi ? MASTERPLAN_GROUND_SIZE : undefined} />

        {/* Conjunto: el volumen de cada edificio, con instancing; el activo se oculta aquí porque se
            dibuja con todo su detalle justo abajo. Con una sola torre no hace falta. */}
        {unitIdentity.multi && <Massing items={massingItems} tints={massingTints} hiddenId={activeId} onSelect={handleSelectBuilding} />}

        {/* El detalle completo (balcones, canceles, lobby, azotea…) existe solo para el edificio
            activo: al volver al masterplan se desmonta y libera su memoria de video. */}
        {/* El `key` va dentro de un arreglo a propósito: con `key` directamente sobre este hijo del Canvas,
            R3F deja el grupo del edificio huérfano en la escena al desmontarlo (cada vez que se entraba a
            un edificio quedaba uno más, con todas sus mallas, dibujándose y ocupando memoria de video). */}
        {activeBuilding && placement && [
          <BuildingPlacement key={activeBuilding.id} position={placement.position} pivot={placement.pivot} rotationY={placement.rotationY}>
            <Suspense fallback={null}>
              <Tower
                config={auraConfig}
                geometry={activeBuilding.geometry}
                units={buildingUnits}
                filters={filters}
                selectedUnitCode={selectedHere && !inside ? selectedHere.code : null}
                onSelectUnit={handleSelectUnit}
                focusedFloor={focusedFloor}
                availabilityMode={availabilityMode}
                interactive={activeBuilding.sellable && !inside && !tourActive}
                unitTints={unitTints}
                insideUnitCode={shadowedUnitCode}
              />
              {/* Hermano de la torre dentro del mismo `Suspense`: su efecto corre cuando el detalle del edificio ya está en la escena. */}
              <MountSignal onMount={handleTowerMounted} />
            </Suspense>
          </BuildingPlacement>,
        ]}

        {!activeBuilding && <BuildingLabels items={labelItems} inventoryLoaded={units.length > 0} onSelect={handleSelectBuilding} />}

        {/* Sombra de contacto del edificio activo. Sin `frames`: con `frames={1}` capturaba
            una sola vez, potencialmente antes de que los `InstancedMesh` del motor (balcones,
            mullions...) terminaran de poner sus matrices en su propio `useEffect` tras montar —
            esa primera captura podía quedar incompleta y nunca se repetía. Sin el límite, se
            repinta en cada render bajo `frameloop="demand"` (solo cuando algo invalida la
            escena), sin costo extra fuera de eso. `far` acotado a la planta baja: con los ~40 m
            del edificio entero contribuyendo, la sombra salía borrosa y débil en vez de leerse
            justo donde el edificio toca el suelo. */}
        {activeBuilding && activeBounds && (
          <ContactShadow
            key={activeBuilding.id}
            position={[activeBuilding.position[0], 0.02, activeBuilding.position[1]]}
            opacity={0.7}
            size={Math.max(activeBounds.maxX - activeBounds.minX, activeBounds.maxZ - activeBounds.minZ) * 2.2}
            blur={2}
            far={activeBuilding.geometry.groundFloorHeight}
            refreshKey={shadowKey}
          />
        )}

        <PrecompileScene enabled={compileScene} onDone={handleShadersReady} />
        <CameraRig intro={initialFraming.intro} target={initialFraming.target} onComplete={handleIntroComplete} onProgress={setIntroProgress} start={introStart} />
        <CameraFocus
          position={tourFrozen ? tourFrozen.position : viewFromUnit && unitViewPose ? unitViewPose.position : framing.intro}
          target={tourFrozen ? tourFrozen.target : viewFromUnit && unitViewPose ? unitViewPose.target : framing.target}
          fov={viewFromUnit ? unitViewFov : CAMERA_FOV}
          near={viewFromUnit ? UNIT_VIEW_NEAR : CAMERA_NEAR}
          duration={inside && unitViewConfig ? unitViewConfig.flightSeconds : undefined}
          onFlightChange={handleFlightChange}
        />
        {/* El director de la presentación lleva la cámara por la pista del recorrido; la sonda deja leer su pose de arranque. */}
        <CameraProbe poseRef={poseProbe} />
        <TourDirector track={tourRun?.track ?? null} stopToken={tourStopToken} onTime={handleTourTime} onEnd={handleTourEnd} />
        {/* Dentro de la unidad se mira alrededor desde un punto fijo, con límites a cada lado. */}
        {unitViewConfig && (
          <LookAround
            enabled={viewFromUnit && !flying}
            yaw={unitViewPose?.yaw ?? 0}
            yawLimitDeg={unitViewConfig.yawLimitDeg}
            pitchUpDeg={unitViewConfig.pitchUpDeg}
            pitchDownDeg={unitViewConfig.pitchDownDeg}
            onYawChange={handleLookYaw}
          />
        )}

        {/* `enablePan={false}`: pan (clic derecho o dos dedos) desplaza `target`, y una vez
            desplazado, la órbita ya no gira alrededor de la torre sino de donde haya
            quedado ese nuevo punto — se sentía como "gira alrededor de donde toco", no
            alrededor del edificio. Sin pan, `target` se queda fijo en el centro de la
            torre siempre (la torre nunca se sale del encuadre); solo quedan órbita
            (arrastrar) y zoom (rueda/pellizco), que es lo único que pedía el SPEC.
            `minDistance`/`minPolarAngle`/`maxPolarAngle`: límite grueso y barato (esférico
            en distancia, angular en altura) contra entrar al edificio o llegar a una vista
            cenital plana o por debajo del piso — todo derivado de la geometría real de la
            torre y la config del cliente, nunca hardcoded. El límite fino por dirección
            (la torre no es una esfera) lo aplica `CameraCollision`, justo abajo.
            `target` es solo el inicial: los vuelos entre el masterplan y cada edificio lo mueven
            (`CameraFocus`), y mientras dura uno los controles se apagan. */}
        <OrbitControls
          makeDefault
          enabled={introDone && !flying && !inside && !tourActive}
          target={initialFraming.target}
          enablePan={false}
          minDistance={cameraLimits.minDistance}
          maxDistance={framing.maxDistance}
          minPolarAngle={minPolarAngle}
          maxPolarAngle={maxPolarAngle}
        />
        <CameraCollision bounds={cameraLimits.bounds} target={framing.target} enabled={!flying && !inside && !tourActive} />

        <AdaptivePerformance dprRange={DPR_RANGE} />
        <WebGLRecovery />
      </Canvas>

      {unitIdentity.multi && !viewFromUnit && !tourActive && <Breadcrumbs crumbs={crumbs} />}

      {/* "Ver disponibilidad" antes iba junto a Legend en la misma fila y quedaba muy
          cerca del centro de la escena, estorbando la vista de la torre — ahora cuelga
          debajo de Legend, mismo lado. flex-wrap en el grupo de la izquierda: si algún
          día Legend crece (ej. banner de error) y ya no cabe en una fila, baja de línea
          en vez de encimarse con Filters. */}
      <div className={`fixed inset-x-4 ${viewFromUnit ? 'top-20' : topControlsClass} pointer-events-none z-10 flex flex-wrap items-start justify-between gap-2 ${tourActive ? 'hidden' : ''}`}>
        <div className="pointer-events-none flex flex-col items-start gap-2">
          {viewFromUnit ? (
            <UnitViewBackButton onBack={exitUnitView} />
          ) : (
            <>
              {/* Dentro de un edificio con unidades, el contador es el suyo; en el masterplan, o en uno sin unidades (casa club, o una torre cuyo inventario aún no se siembra), el del conjunto. */}
              <Legend units={buildingUnits.length > 0 ? buildingUnits : units} loadError={loadError} />
              <AvailabilityToggle />
            </>
          )}
          {/* El sol también se puede mover desde adentro de la unidad: se ve cómo entra la luz y cómo cambia lo que se ve afuera. */}
          {solarConfig && <SunControl solar={solarConfig} allowAfternoonMap={Boolean(activeBuilding?.sellable)} />}
        </div>
        {activeBuilding?.sellable && !viewFromUnit && <Filters units={buildingUnits} />}
      </div>

      {viewFromUnit && selectedUnit && (
        <UnitViewStatus
          floor={selectedUnit.floor}
          code={selectedUnit.code}
          buildingName={unitIdentity.multi && selectedBuilding ? text(selectedBuilding.name) : undefined}
          northAngleDeg={solarConfig ? solarConfig.northAngleDeg : null}
        />
      )}

      {/* Para quien no puede tocar los volúmenes del masterplan (teclado, lector de pantalla). */}
      {!activeBuilding && (
        <ul className="sr-only">
          {buildings.map((building) => (
            <li key={building.id}>
              <button type="button" onClick={() => handleSelectBuilding(building.id)}>
                {t('masterplan.enter', { name: text(building.name) })}
              </button>
            </li>
          ))}
        </ul>
      )}

      {presentUnitKey && lastUnitPanelData && developmentId && (
        // Sin `key`: cambiar de unidad sin cerrar antes ya no remonta el panel de golpe
        // (cortaba su propia animación de entrada/salida) — el formulario interno se
        // reinicia por su cuenta (`useEffect` en UnitPanel.tsx sobre `unit.code`).
        <UnitPanel
          unit={lastUnitPanelData.unit}
          buildingName={lastUnitPanelData.buildingName}
          polygon={lastUnitPanelData.polygon}
          floorPlan={lastUnitPanelData.floorPlan}
          interiorImages={lastUnitPanelData.interiors}
          paymentPlan={auraConfig.paymentPlan}
          developmentId={developmentId}
          developmentName={messageDevelopmentName(i18n, lastUnitPanelData.unit.buildingId)}
          whatsappPhone={whatsapp}
          onClose={() => handleSelectUnit(null)}
          onOpenContact={openContact}
          sun={lastUnitPanelData.sun}
          onViewFromUnit={unitViewConfig && unitViewPose ? enterUnitView : undefined}
          // Dentro de la unidad la ficha se esconde para no tapar la vista; al volver reaparece.
          visible={unitPanelVisible && !viewFromUnit && !tourActive}
        />
      )}

      {infoBuilding && !tourActive && (
        <BuildingInfoCard
          name={text(infoBuilding.name)}
          description={infoBuilding.description ? text(infoBuilding.description) : undefined}
          kindLabel={t(`kind.${infoBuilding.kind}`)}
          visible={infoCardVisible}
        />
      )}

      {tourActive && <TourOverlay texts={tourTexts} />}

      <LoadingScreen visible={!sceneShown} logo={brand.logo} name={developmentName} tagline={text(auraConfig.tagline)} progress={loadProgress} step={loadStep} />
    </div>
  );
}
