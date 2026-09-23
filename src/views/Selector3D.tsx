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
import { buildTowerLayout, findUnitPolygon, floorPlanKey } from '../lib/geometry';
import { hasActiveFilters } from '../lib/filters';
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

const TONE_MAPPING_EXPOSURE = 1.05;

export function Selector3D() {
  const { camera, geometry, brand, name: developmentName, whatsapp } = auraConfig;
  const [introDone, setIntroDone] = useState(false);
  const { units, developmentId, loadError } = useOutletContext<AuraOutletContext>();

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

  const selectedUnit = units.find((unit) => unit.code === selectedUnitCode) ?? null;
  const selectedUnitPolygon = selectedUnit ? findUnitPolygon(geometry, selectedUnit) : undefined;
  const selectedUnitPlanKey = selectedUnit ? floorPlanKey(selectedUnit, geometry.levels) : null;
  const selectedUnitFloorPlan = selectedUnitPlanKey ? auraConfig.floorPlans[selectedUnitPlanKey] : undefined;
  const selectedUnitInteriors = selectedUnitPlanKey ? (auraConfig.interiors[selectedUnitPlanKey] ?? []) : [];

  // La ficha de unidad se anima al cerrar (usePresence retiene lo último no-nulo mientras
  // juega la transición de salida) — se dispara con el código (string estable), no con el
  // objeto `Unit` completo: ese objeto cambia de referencia en cada actualización de
  // Realtime aunque sea la misma unidad, y reiniciaría la animación de entrada sin motivo.
  const { rendered: presentUnitCode, visible: unitPanelVisible } = usePresence(selectedUnitCode, 300);
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
    <div className="relative h-dvh w-screen bg-neutral-900">
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
        camera={{ position: camera.intro, fov: 50, near: 1, far: 500 }}
        onPointerMissed={() => handleSelectUnit(null)}
        dpr={DPR_RANGE}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: TONE_MAPPING_EXPOSURE }}
      >
        {/* Niebla ligera a la distancia (solo se nota cerca del horizonte, no sobre la
            torre): da profundidad sin necesitar postprocesado. */}
        <fog attach="fog" args={[brand.background, sunDistance * 0.45, sunDistance * 1.4]} />
        <Sky sunPosition={sunPosition} turbidity={3} rayleigh={0.9} mieCoefficient={0.006} mieDirectionalG={0.85} />

        {/* Hemisferio (cielo arriba, rebote de piso abajo) en vez de ambiental plano:
            así la sombra del sol tiene con qué contrastar sin que la escena se vea gris. */}
        <hemisphereLight args={['#bcd4f2', '#9c9384', 0.35]} />
        <directionalLight
          position={sunPosition}
          target={sunTarget}
          intensity={1.4}
          color="#fff3e0"
          castShadow
          shadow-mapSize={SHADOW_MAP_SIZE}
          shadow-radius={4}
          shadow-bias={-0.0012}
          shadow-normalBias={0.4}
          shadow-camera-left={-sceneRadius}
          shadow-camera-right={sceneRadius}
          shadow-camera-top={sceneRadius}
          shadow-camera-bottom={-sceneRadius}
          shadow-camera-near={sunDistance - sceneRadius * 2}
          shadow-camera-far={sunDistance + sceneRadius * 2}
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
          <Sky sunPosition={sunPosition} turbidity={3} rayleigh={0.9} mieCoefficient={0.006} mieDirectionalG={0.85} />
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
            borrosa y débil en vez de leerse justo donde el edificio toca el suelo. */}
        <ContactShadows
          position={[footprintCenterX, 0.02, footprintCenterZ]}
          opacity={0.6}
          scale={footprintSpan * 2.2}
          blur={2}
          far={geometry.groundFloorHeight}
          frames={1}
        />

        <CameraRig intro={camera.intro} target={camera.target} onComplete={() => setIntroDone(true)} />

        <OrbitControls
          enabled={introDone}
          target={camera.target}
          minDistance={20}
          maxDistance={160}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />

        <AdaptivePerformance dprRange={DPR_RANGE} />
      </Canvas>

      {/* flex-wrap: en pantallas angostas, si Filters se expande y ya no cabe junto a
          Legend, baja de línea en vez de encimarse (en vez de dos `fixed` adivinando
          el ancho del otro). */}
      <div className="fixed inset-x-4 top-20 z-10 flex flex-wrap items-start gap-2">
        <Legend units={units} loadError={loadError} />
        <AvailabilityToggle />
        <Filters units={units} />
      </div>

      {presentUnitCode && lastUnitPanelData && developmentId && (
        <UnitPanel
          key={presentUnitCode}
          unit={lastUnitPanelData.unit}
          polygon={lastUnitPanelData.polygon}
          floorPlan={lastUnitPanelData.floorPlan}
          interiorImages={lastUnitPanelData.interiors}
          paymentPlan={auraConfig.paymentPlan}
          developmentId={developmentId}
          developmentName={developmentName}
          whatsappPhone={whatsapp}
          onClose={() => handleSelectUnit(null)}
          visible={unitPanelVisible}
        />
      )}

      <LoadingScreen visible={!introDone} logo={brand.logo} name={developmentName} tagline={auraConfig.tagline} />
    </div>
  );
}
