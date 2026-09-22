import { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { Tower } from '../engine/Tower';
import { Context } from '../engine/Context';
import { CameraRig } from '../engine/CameraRig';
import { AdaptivePerformance } from '../engine/AdaptivePerformance';
import { UnitPanel } from './UnitPanel';
import { Filters } from './Filters';
import { Legend } from './Legend';
import type { AuraOutletContext } from './AuraLayout';
import { buildTowerLayout, findUnitPolygon, floorPlanKey } from '../lib/geometry';
import { useSelectionStore } from '../store/selectionStore';
import { useFiltersStore } from '../store/filtersStore';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig } from '../types';

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
  const filters = { bedrooms, priceMin, priceMax, onlyAvailable };

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

  return (
    <div className="relative h-dvh w-screen bg-neutral-900">
      <Canvas
        frameloop="demand"
        camera={{ position: camera.intro, fov: 50, near: 0.1, far: 500 }}
        onPointerMissed={() => handleSelectUnit(null)}
        dpr={DPR_RANGE}
      >
        <color attach="background" args={[brand.background]} />

        <ambientLight intensity={0.35} />
        <directionalLight position={[40, 60, 20]} intensity={0.9} />

        <Suspense fallback={null}>
          <Environment preset="city" background={false} />
        </Suspense>

        <Context footprint={layout.footprint} towerHeight={layout.totalHeight} />
        <Tower
          config={auraConfig}
          units={units}
          filters={filters}
          selectedUnitCode={selectedUnitCode}
          onSelectUnit={handleSelectUnit}
          focusedFloor={focusedFloor}
        />

        <ContactShadows
          position={[footprintCenterX, 0.02, footprintCenterZ]}
          opacity={0.5}
          scale={footprintSpan * 2.2}
          blur={2.4}
          far={layout.totalHeight}
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
        <Filters units={units} />
      </div>

      {selectedUnit && developmentId && (
        <UnitPanel
          key={selectedUnit.code}
          unit={selectedUnit}
          polygon={selectedUnitPolygon}
          floorPlan={selectedUnitFloorPlan}
          interiorImages={selectedUnitInteriors}
          developmentId={developmentId}
          developmentName={developmentName}
          whatsappPhone={whatsapp}
          onClose={() => handleSelectUnit(null)}
        />
      )}
    </div>
  );
}
