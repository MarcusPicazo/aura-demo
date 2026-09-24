import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, Sky } from '@react-three/drei';
import { Tower } from '../engine/Tower';
import { Context } from '../engine/Context';
import { CameraRig } from '../engine/CameraRig';
import { AdaptivePerformance } from '../engine/AdaptivePerformance';
import { UnitPanel } from './UnitPanel';
import { Filters } from './Filters';
import { Legend } from './Legend';
import { AvailabilityToggle } from './AvailabilityToggle';
import { LoadingScreen } from './LoadingScreen';
import type { AuraOutletContext } from './AuraLayout';
import { buildTowerLayout, computeCameraFraming, findUnitPolygon, floorPlanKey } from '../lib/geometry';
import { hasActiveFilters } from '../lib/filters';
import { trackEvent } from '../lib/analytics';
import { usePresence } from '../lib/usePresence';
import { useSelectionStore } from '../store/selectionStore';
import { useFiltersStore } from '../store/filtersStore';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig, FloorPlanConfig, Point, Unit } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

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
const SKY_PARAMS = { distance: 400, turbidity: 2.2, rayleigh: 2.2, mieCoefficient: 0.006, mieDirectionalG: 0.8 };
/** Tono de la franja baja del cielo (horizonte) — la niebla debe apagar lo lejano hacia
 *  este color, no hacia el fondo cálido de la interfaz, para que edificios lejanos y cielo
 *  se sientan del mismo aire. */
const FOG_COLOR = '#CBDBE8';

// Bajada de 1.05: hace falta para compensar `intensity` del sol mucho más alta (ver abajo)
// y devolver la escena a un brillo general normal sin perder el contraste que esa
// intensidad le da a la sombra.
const TONE_MAPPING_EXPOSURE = 0.7;

/** FOV vertical de la cámara — una sola constante, la usan tanto el `Canvas` como el
 *  cálculo de encuadre (`computeCameraFraming`), para que nunca queden desincronizados. */
const CAMERA_FOV = 50;

export function Selector3D() {
  const { geometry, brand, name: developmentName, whatsapp } = auraConfig;
  const [introDone, setIntroDone] = useState(false);
  const { units, developmentId, loadError, openContact } = useOutletContext<AuraOutletContext>();

  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const selectedUnitCode = useSelectionStore((state) => state.selectedUnitCode);
  const selectUnit = useSelectionStore((state) => state.selectUnit);
  const focusedFloor = useSelectionStore((state) => state.focusedFloor);
  const setFocusedFloor = useSelectionStore((state) => state.setFocusedFloor);

  const bedrooms = useFiltersStore((state) => state.bedrooms);
  const priceMin = useFiltersStore((state) => state.priceMin);
  const priceMax = useFiltersStore((state) => state.priceMax);
  const onlyAvailable = useFiltersStore((state) => state.onlyAvailable);
  const showAvailability = useFiltersStore((state) => state.showAvailability);
  const filters = { bedrooms, priceMin, priceMax, onlyAvailable };
  // Cualquier filtro activo implica "ver disponibilidad" aunque el toggle manual esté apagado.
  const availabilityMode = showAvailability || hasActiveFilters(filters);

  // URL -> selección: entrar a /aura/unidad/:code, o usar atrás/adelante, selecciona esa
  // unidad. Es la única dirección manejada con efecto; selección -> URL se hace de forma
  // imperativa en `handleSelectUnit` (ver abajo). Con las dos direcciones en efectos —cada
  // una reaccionando al resultado de la otra— la selección inicial (código de la URL,
  // `selectedUnitCode` todavía null) y el efecto opuesto (que lee ese mismo `selectedUnitCode`
  // todavía no actualizado) se contradicen en el primer render y quedan rebotando para
  // siempre; con una sola dirección en efecto no hay con qué pelearse.
  useEffect(() => {
    const urlCode = code ?? null;
    if (urlCode !== selectedUnitCode) selectUnit(urlCode);
  }, [code, selectedUnitCode, selectUnit]);

  // El resaltado de "piso enfocado" (llegando desde la fachada) se apaga solo.
  useEffect(() => {
    if (focusedFloor === null) return undefined;
    const timeout = setTimeout(() => setFocusedFloor(null), FOCUSED_FLOOR_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [focusedFloor, setFocusedFloor]);

  // Analítica (se vende como reporte mensual, ver /admin → Analítica): una vista del
  // selector por carga — `developmentId` solo cambia cuando el fetch inicial resuelve
  // (AuraLayout.tsx), así que este efecto no se repite en cada re-render.
  useEffect(() => {
    if (!developmentId) return;
    trackEvent({ developmentId, type: 'selector_view' });
  }, [developmentId]);

  // Una unidad "vista" es que `selectedUnitCode` deje de ser null, sin importar cómo llegó
  // ahí (clic directo, link compartido a /aura/unidad/:code, o piso enfocado desde
  // Fachada y luego clic) — todas pasan por el mismo store, así que un solo efecto las
  // cubre todas. `units` a propósito fuera de las dependencias: cambia de referencia en
  // cada actualización de Realtime (un cambio de estado/precio, no una nueva vista), y
  // volver a contar la misma unidad por eso sería ruido en el reporte.
  useEffect(() => {
    if (!developmentId || !selectedUnitCode) return;
    const unit = units.find((candidate) => candidate.code === selectedUnitCode);
    trackEvent({ developmentId, type: 'unit_view', unitId: unit?.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId, selectedUnitCode]);

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

  function handleSelectUnit(nextCode: string | null) {
    selectUnit(nextCode);
    navigate(nextCode ? `/aura/unidad/${nextCode}` : '/aura', { replace: true });
  }

  // Solo para pasarle la huella y la altura total al contexto urbano y a las sombras;
  // Tower calcula su propio layout internamente a partir de `geometry`.
  const layout = useMemo(() => buildTowerLayout(geometry), [geometry]);
  const footprintCenterX = (layout.footprint.minX + layout.footprint.maxX) / 2;
  const footprintCenterZ = (layout.footprint.minZ + layout.footprint.maxZ) / 2;
  const footprintSpan = Math.max(
    layout.footprint.maxX - layout.footprint.minX,
    layout.footprint.maxZ - layout.footprint.minZ,
  );

  // Aspecto de la ventana al montar: basta con esto (no reactivo a resize) para distinguir
  // celular vertical de escritorio — el encuadre de entrada solo se calcula una vez, igual
  // que antes cuando `camera.intro` era un vector fijo.
  const aspect = useMemo(() => (typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight), []);
  const framing = useMemo(
    () => computeCameraFraming(layout.footprint, layout.totalHeight, aspect, CAMERA_FOV),
    [layout.footprint, layout.totalHeight, aspect],
  );

  const selectedUnit = units.find((unit) => unit.code === selectedUnitCode) ?? null;
  const selectedUnitPolygon = selectedUnit ? findUnitPolygon(geometry, selectedUnit) : undefined;
  const selectedUnitPlanKey = selectedUnit ? floorPlanKey(selectedUnit, geometry.levels) : null;
  const selectedUnitFloorPlan = selectedUnitPlanKey ? auraConfig.floorPlans[selectedUnitPlanKey] : undefined;
  const selectedUnitInteriors = selectedUnitPlanKey ? (auraConfig.interiors[selectedUnitPlanKey] ?? []) : [];

  // La ficha de unidad se anima al cerrar (usePresence retiene lo último no-nulo mientras
  // juega la transición de salida) — se dispara con el código (string estable), no con el
  // objeto `Unit` completo: ese objeto cambia de referencia en cada actualización de
  // Realtime aunque sea la misma unidad, y reiniciaría la animación de entrada sin motivo.
  const { rendered: presentUnitCode, visible: unitPanelVisible } = usePresence(selectedUnitCode, 350);
  const [lastUnitPanelData, setLastUnitPanelData] = useState<{
    unit: Unit;
    polygon: Point[] | undefined;
    floorPlan: FloorPlanConfig | undefined;
    interiors: string[];
  } | null>(null);
  useEffect(() => {
    if (selectedUnit) {
      setLastUnitPanelData({
        unit: selectedUnit,
        polygon: selectedUnitPolygon,
        floorPlan: selectedUnitFloorPlan,
        interiors: selectedUnitInteriors,
      });
    }
  }, [selectedUnit, selectedUnitPolygon, selectedUnitFloorPlan, selectedUnitInteriors]);

  // El sol apunta al centro de la torre (a media altura), no al origen del mundo — si no,
  // el frustum de su shadow camera queda descentrado y desperdicia resolución de sombra.
  // `target` va como prop del propio `<directionalLight>` (R3F la asigna igual que
  // cualquier otra prop, de forma síncrona y en cada commit) — asignarla a mano con un
  // `ref` + `useEffect` aparte, como estaba antes, dependía del orden exacto en que se
  // monta el ref frente al efecto y se perdía en cuanto había un remount (HMR, StrictMode):
  // `light.target` se quedaba apuntando al Object3D por default de three.js, en el origen,
  // y la sombra dejaba de proyectarse donde debía (o directamente no se veía).
  const sunTarget = useMemo(() => new THREE.Object3D(), []);

  const sunTargetPosition: [number, number, number] = [footprintCenterX, layout.totalHeight / 2, footprintCenterZ];
  // Radio que debe cubrir el frustum de la shadow camera: la torre completa más margen.
  const sceneRadius = Math.max(footprintSpan, layout.totalHeight) * 1.2;
  const sunDistance = sceneRadius * 4;
  const sunPosition: [number, number, number] = [
    footprintCenterX + SUN_DIRECTION[0] * sunDistance,
    SUN_DIRECTION[1] * sunDistance,
    footprintCenterZ + SUN_DIRECTION[2] * sunDistance,
  ];

  return (
    // `select-none`: arrastrar para orbitar la torre (escritorio) podía iniciar una
    // selección de texto nativa del navegador si el gesto pasaba cerca de la leyenda o
    // los filtros — el cursor terminaba subrayando letras en vez de solo girar la cámara.
    <div className="relative h-dvh w-screen select-none bg-neutral-900">
      <Canvas
        // `frameloop="demand"` ya evita recalcular el shadow map en frames de más: el
        // shadow map de three.js se recalcula en cada render (autoUpdate por default),
        // y bajo "demand" solo hay render cuando algo realmente invalida la escena.
        frameloop="demand"
        shadows="soft"
        // `near` antes era 0.1: junto con `far=500` da una proporción far/near de 5000:1,
        // que deja muy poca precisión de profundidad disponible para la escena real (todo
        // pasa a metros del target, nunca a centímetros de la cámara). A poca distancia esa
        // falta de precisión se nota grueso (no como un parpadeo de un píxel): el vidrio y
        // lo que tiene detrás (mullions, forro interior) compiten por el mismo valor de
        // profundidad y el más cercano "gana" de forma inestable. 1 sigue siendo mucho más
        // cerca de lo que la cámara puede llegar (`minDistance` en OrbitControls, abajo).
        camera={{ position: framing.intro, fov: CAMERA_FOV, near: 1, far: 500 }}
        onPointerMissed={() => handleSelectUnit(null)}
        dpr={DPR_RANGE}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: TONE_MAPPING_EXPOSURE }}
      >
        {/* Niebla ligera a la distancia (solo se nota cerca del horizonte, no sobre la
            torre): da profundidad sin necesitar postprocesado. */}
        <fog attach="fog" args={[FOG_COLOR, sunDistance * 0.45, sunDistance * 1.4]} />
        <Sky sunPosition={sunPosition} {...SKY_PARAMS} />

        {/* Hemisferio (cielo arriba, rebote de piso abajo) en vez de ambiental plano:
            así la sombra del sol tiene con qué contrastar sin que la escena se vea gris.
            Bajado de 0.35 a 0.22: con más luz de relleno ambiental, la zona en sombra casi
            no se distinguía de la iluminada — la sombra del sol necesita algo de contraste
            para leerse, no solo existir en el shadow map. */}
        <hemisphereLight args={['#bcd4f2', '#9c9384', 0.22]} />
        <directionalLight
          position={sunPosition}
          target={sunTarget}
          // Subida de 1.4 a 6, junto con `TONE_MAPPING_EXPOSURE` bajado para compensar:
          // diagnostiqué por qué la sombra no se veía (más abajo, en el shadow map en sí no
          // era el problema — sí tenía datos correctos) sacando la escena a un contraste
          // extremo a mano y viendo en qué punto la sombra se volvía visible. El motivo real
          // es que la sombra solo resta la contribución DIRECCIONAL, nunca la ambiental (el
          // `Environment` entero actuando como luz), y con una intensidad "razonable" en
          // papel (1.4–1.6) esa resta apenas se notaba contra tanto relleno ambiental — ACES
          // además comprime más las diferencias chicas que las grandes, así que hacía falta
          // una diferencia de partida bastante más grande de lo que parece razonable a
          // simple vista para que sobreviva la curva y se lea "dura", no solo presente.
          intensity={6}
          color="#fff3e0"
          castShadow
          shadow-mapSize={SHADOW_MAP_SIZE}
          // `radius` bajado de 4 a 1: el pedido es sombra DURA y bien definida, no un
          // desenfoque suave — 4 (con normalBias grande, ver abajo) la dejaba casi
          // imperceptible. `normalBias` bajado de 0.4 a 0.05: 0.4 empujaba la muestra ~40cm
          // a lo largo de la normal, mucho para geometría delgada (mullions, cantos de losa,
          // vidrio) — se conoce como "peter-panning" y básicamente desprendía la sombra de
          // su objeto o la debilitaba. El frustum de la shadow camera también se acota más
          // cerca de la escena real (antes ±2×sceneRadius de margen, ahora ±1.2×): con casi
          // toda esa distancia vacía, la precisión de profundidad se repartía donde no hacía
          // falta en vez de sobre la torre y la calle.
          shadow-radius={1}
          shadow-bias={-0.0006}
          shadow-normalBias={0.05}
          shadow-camera-left={-sceneRadius}
          shadow-camera-right={sceneRadius}
          shadow-camera-top={sceneRadius}
          shadow-camera-bottom={-sceneRadius}
          shadow-camera-near={sunDistance - sceneRadius * 1.2}
          shadow-camera-far={sunDistance + sceneRadius * 1.2}
        />
        <primitive object={sunTarget} position={sunTargetPosition} />

        {/* Antes: `preset="city"` descargaba un HDRI de ~1.5 MB de un CDN externo en cada
            carga (SPEC §8: <3s en 4G simulado). El vidrio no necesita ese nivel de detalle
            para verse creíble — un env map de baja resolución generado del `<Sky>` que ya
            está en la escena da el mismo tono de reflejo de cielo sin descargar nada. */}
        {/* `frames={1}` captura el cubemap una sola vez: el sol/cielo no cambian en
            tiempo real, así que recalcularlo cada frame bajo frameloop="demand" sería
            trabajo repetido sin nada nuevo que mostrar. */}
        <Environment resolution={256} background={false} frames={1}>
          <Sky sunPosition={sunPosition} {...SKY_PARAMS} />
        </Environment>

        <Context footprint={layout.footprint} context={auraConfig.context} />
        <Tower
          config={auraConfig}
          units={units}
          filters={filters}
          selectedUnitCode={selectedUnitCode}
          onSelectUnit={handleSelectUnit}
          focusedFloor={focusedFloor}
          availabilityMode={availabilityMode}
        />

        {/* `far` acotado a la planta baja (antes: la altura completa de la torre) — con
            los ~40 m del edificio entero contribuyendo, la sombra de contacto salía
            borrosa y débil en vez de leerse justo donde el edificio toca el suelo.
            Sin `frames`: con `frames={1}` capturaba una sola vez, potencialmente antes de
            que los `InstancedMesh` del motor (balcones, mullions...) terminaran de poner
            sus matrices en su propio `useEffect` tras montar — esa primera captura podía
            quedar incompleta y nunca se repetía. Sin el límite, se repinta en cada render
            bajo `frameloop="demand"` (solo cuando algo invalida la escena), sin costo extra
            fuera de eso. */}
        <ContactShadows
          position={[footprintCenterX, 0.02, footprintCenterZ]}
          opacity={0.7}
          scale={footprintSpan * 2.2}
          blur={2}
          far={geometry.groundFloorHeight}
        />

        <CameraRig intro={framing.intro} target={framing.target} onComplete={() => setIntroDone(true)} />

        {/* `enablePan={false}`: pan (clic derecho o dos dedos) desplaza `target`, y una vez
            desplazado, la órbita ya no gira alrededor de la torre sino de donde haya
            quedado ese nuevo punto — se sentía como "gira alrededor de donde toco", no
            alrededor del edificio. Sin pan, `target` se queda fijo en el centro de la
            torre siempre; solo quedan órbita (arrastrar) y zoom (rueda/pellizco), que es
            lo único que pedía el SPEC. */}
        <OrbitControls
          enabled={introDone}
          target={framing.target}
          enablePan={false}
          minDistance={20}
          maxDistance={framing.maxDistance}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />

        <AdaptivePerformance dprRange={DPR_RANGE} />
      </Canvas>

      {/* "Ver disponibilidad" antes iba junto a Legend en la misma fila y quedaba muy
          cerca del centro de la escena, estorbando la vista de la torre — ahora cuelga
          debajo de Legend, mismo lado. flex-wrap en el grupo de la izquierda: si algún
          día Legend crece (ej. banner de error) y ya no cabe en una fila, baja de línea
          en vez de encimarse con Filters. */}
      <div className="fixed inset-x-4 top-20 z-10 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <Legend units={units} loadError={loadError} />
          <AvailabilityToggle />
        </div>
        <Filters units={units} />
      </div>

      {presentUnitCode && lastUnitPanelData && developmentId && (
        // Sin `key`: cambiar de unidad sin cerrar antes ya no remonta el panel de golpe
        // (cortaba su propia animación de entrada/salida) — el formulario interno se
        // reinicia por su cuenta (`useEffect` en UnitPanel.tsx sobre `unit.code`).
        <UnitPanel
          unit={lastUnitPanelData.unit}
          polygon={lastUnitPanelData.polygon}
          floorPlan={lastUnitPanelData.floorPlan}
          interiorImages={lastUnitPanelData.interiors}
          paymentPlan={auraConfig.paymentPlan}
          developmentId={developmentId}
          developmentName={developmentName}
          whatsappPhone={whatsapp}
          onClose={() => handleSelectUnit(null)}
          onOpenContact={openContact}
          visible={unitPanelVisible}
        />
      )}

      <LoadingScreen visible={!introDone} logo={brand.logo} name={developmentName} tagline={auraConfig.tagline} />
    </div>
  );
}
