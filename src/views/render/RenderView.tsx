import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import type { AuraOutletContext } from '../AuraLayout';
import { UnitPanel } from '../UnitPanel';
import { FloorSelector } from './FloorSelector';
import { GeneratedPlanStage } from './GeneratedPlanStage';
import { RenderLegend } from './RenderLegend';
import { RenderStage } from './RenderStage';
import { ViewSwitcher } from './ViewSwitcher';
import { useRenderPreload } from './useRenderPreload';
import { findUnitPolygon } from '../../lib/geometry';
import { buildLevelPlan, levelFloors } from '../../lib/levelPlan';
import { hasTower3D, usableRenderOf } from '../../lib/modes';
import {
  FLOOR_PARAM,
  UNIT_PARAM,
  findView,
  isImageBacked,
  matchesUnitRef,
  parseNumberParam,
  planFloors,
  renderPath,
  resolveSurface,
  resolveView,
  unitMediaKey,
} from '../../lib/render';
import { trackEvent } from '../../lib/analytics';
import { usePresence } from '../../lib/usePresence';
import { useI18n } from '../../i18n/useI18n';
import { useSelectionStore } from '../../store/selectionStore';
import { activeConfig as auraConfig, buildings, messageDevelopmentName, unitIdentity } from '../../config/active';
import type { DevelopmentConfig, RenderConfig, RenderHotspot } from '../../types';

/** Las vistas que este desarrollo puede mostrar de verdad (sin la planta generada si no hay modelo 3D). */
const usableRender = usableRenderOf(auraConfig);

/** El piso más cercano de la lista (para un `?piso=` fuera de rango o sin valor). */
function nearestFloor(floor: number | null, floors: number[]): number | null {
  if (floors.length === 0) return null;
  if (floor === null) return floors[0];
  return floors.reduce((best, candidate) => (Math.abs(candidate - floor) < Math.abs(best - floor) ? candidate : best));
}

interface RenderExperienceProps {
  config: DevelopmentConfig;
  render: RenderConfig;
}

function RenderExperience({ config, render }: RenderExperienceProps) {
  const { units, developmentId, loadError, openContact } = useOutletContext<AuraOutletContext>();
  const i18n = useI18n();
  const { viewId } = useParams<{ viewId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectUnit = useSelectionStore((state) => state.selectUnit);

  const view = resolveView(render, viewId);
  const unitParam = searchParams.get(UNIT_PARAM);
  const unit = unitIdentity.find(units, unitParam);
  // Un link con unidad pero sin piso abre la planta de esa unidad.
  const floor = parseNumberParam(searchParams.get(FLOOR_PARAM)) ?? unit?.floor ?? null;

  // Superficie con imagen (todas las vistas menos la planta generada). Memoizada por vista+piso:
  // el escenario y la precarga reaccionan a su identidad, así que no puede ser un objeto nuevo
  // en cada render (p. ej. cada vez que Realtime actualiza `units`).
  const imageView = isImageBacked(view) ? view : null;
  const surface = useMemo(() => (imageView ? resolveSurface(imageView, floor) : null), [imageView, floor]);
  useRenderPreload(render, surface);

  // Planta generada: de qué edificio es, y los pisos salen de su geometría, no de una lista de imágenes.
  const generatedBuilding = useMemo(() => {
    if (view.kind !== 'generatedPlan' || !hasTower3D(config)) return null;
    return (
      buildings.find((candidate) => candidate.id === view.buildingId) ??
      buildings.find((candidate) => candidate.sellable) ??
      buildings[0] ??
      null
    );
  }, [view, config]);
  const generatedFloors = useMemo(() => (generatedBuilding ? levelFloors(generatedBuilding.geometry) : []), [generatedBuilding]);
  const generatedFloor = generatedBuilding ? nearestFloor(floor, generatedFloors) : null;
  const levelPlan = useMemo(
    () =>
      generatedBuilding && generatedFloor !== null
        ? buildLevelPlan({ buildingId: generatedBuilding.id, geometry: generatedBuilding.geometry, floorPlans: config.floorPlans }, generatedFloor)
        : null,
    [generatedBuilding, generatedFloor, config.floorPlans],
  );
  // Dentro de un edificio los códigos son únicos: la planta trabaja con las unidades del suyo.
  const generatedUnits = useMemo(
    () => (generatedBuilding ? units.filter((candidate) => candidate.buildingId === generatedBuilding.id) : []),
    [units, generatedBuilding],
  );

  // La URL es la fuente de verdad de la unidad abierta (se comparte y sobrevive a recargar);
  // el store solo la sigue, para que el resto de la interfaz (ficha de contacto, pestañas)
  // sepa qué unidad hay seleccionada. En un solo sentido: nada escribe el store por su cuenta.
  useEffect(() => {
    selectUnit(unitParam);
  }, [unitParam, selectUnit]);

  useEffect(() => {
    if (!developmentId) return;
    trackEvent({ developmentId, type: 'selector_view', metadata: { mode: 'render' } });
  }, [developmentId]);

  // `units` fuera de las dependencias a propósito, igual que en Selector3D: cambia de
  // referencia con cada actualización de Realtime y volver a contar la misma unidad sería ruido.
  useEffect(() => {
    if (!developmentId || !unitParam) return;
    trackEvent({ developmentId, type: 'unit_view', unitId: unit?.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentId, unitParam]);

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleSelectUnitParam = useCallback(
    (param: string | null) => updateParams((params) => (param ? params.set(UNIT_PARAM, param) : params.delete(UNIT_PARAM))),
    [updateParams],
  );

  // La planta generada reporta el código de la unidad (único dentro de su edificio).
  const handleSelectGeneratedUnit = useCallback(
    (code: string | null) => {
      handleSelectUnitParam(code && generatedBuilding ? unitIdentity.param({ buildingId: generatedBuilding.id, code }) : null);
    },
    [handleSelectUnitParam, generatedBuilding],
  );

  const handleActivate = useCallback(
    (hotspot: RenderHotspot) => {
      const { target } = hotspot;
      if (target.type === 'unit') {
        const targetUnit = units.find((candidate) => matchesUnitRef(candidate, target));
        handleSelectUnitParam(
          unitIdentity.param(targetUnit ?? { buildingId: target.buildingId ?? unitIdentity.defaultBuildingId, code: target.code }),
        );
      } else {
        navigate(renderPath({ viewId: target.viewId, floor: target.floor ?? null }));
      }
    },
    [navigate, handleSelectUnitParam, units],
  );

  function handleSelectView(nextViewId: string) {
    const target = findView(render, nextViewId);
    // Pasar a una planta con una unidad abierta lleva a su piso; si no, cada vista arranca limpia.
    if ((target?.kind === 'plan' || target?.kind === 'generatedPlan') && unit) {
      navigate(renderPath({ viewId: nextViewId, floor: unit.floor, unitParam: unitIdentity.param(unit) }));
    } else {
      navigate(renderPath({ viewId: nextViewId }));
    }
  }

  function handleSelectFloor(nextFloor: number) {
    updateParams((params) => {
      params.set(FLOOR_PARAM, String(nextFloor));
      params.delete(UNIT_PARAM);
    });
  }

  const handleCloseUnit = useCallback(() => handleSelectUnitParam(null), [handleSelectUnitParam]);

  // La ficha se anima al cerrar: `usePresence` retiene el último valor mientras juega la salida.
  const { rendered: presentUnitParam, visible: unitPanelVisible } = usePresence(unitParam, 280);
  const panelUnit = unitIdentity.find(units, presentUnitParam);
  const panelBuilding = panelUnit ? buildings.find((candidate) => candidate.id === panelUnit.buildingId) : undefined;
  const planKey = panelUnit ? unitMediaKey(panelUnit, config.floorPlans) : undefined;
  const interiorsKey = panelUnit ? unitMediaKey(panelUnit, config.interiors) : undefined;

  const isPlanView = view.kind === 'plan' || view.kind === 'generatedPlan';

  return (
    <div className="relative h-dvh w-screen select-none overflow-hidden bg-[var(--brand-background)]">
      {levelPlan ? (
        <GeneratedPlanStage
          plan={levelPlan}
          units={generatedUnits}
          selectedUnitCode={unit && unit.buildingId === generatedBuilding?.id ? unit.code : null}
          onSelectUnit={handleSelectGeneratedUnit}
          accent={config.brand.accent}
          background={config.brand.background}
          panelOpen={unitParam !== null}
        />
      ) : (
        surface && (
          <RenderStage
            surface={surface}
            units={units}
            selectedUnit={unit ?? null}
            onActivate={handleActivate}
            reserveSide={isPlanView}
            panelOpen={unitParam !== null}
          />
        )
      )}

      <ViewSwitcher views={render.views} activeViewId={view.id} onSelect={handleSelectView} />

      {view.kind === 'plan' && surface?.floor !== undefined && (
        <FloorSelector floors={planFloors(view)} activeFloor={surface.floor} units={units} onSelect={handleSelectFloor} />
      )}
      {levelPlan && generatedFloor !== null && (
        <FloorSelector floors={generatedFloors} activeFloor={generatedFloor} units={generatedUnits} onSelect={handleSelectFloor} />
      )}

      <RenderLegend units={units} loadError={loadError} />

      {panelUnit && developmentId && (
        <UnitPanel
          unit={panelUnit}
          buildingName={unitIdentity.multi && panelBuilding ? i18n.text(panelBuilding.name) : undefined}
          polygon={panelBuilding ? findUnitPolygon(panelBuilding.geometry, panelUnit) : undefined}
          floorPlan={planKey ? config.floorPlans[planKey] : undefined}
          interiorImages={interiorsKey ? (config.interiors[interiorsKey] ?? []) : []}
          paymentPlan={config.paymentPlan}
          developmentId={developmentId}
          developmentName={messageDevelopmentName(i18n, panelUnit.buildingId)}
          whatsappPhone={config.whatsapp}
          onClose={handleCloseUnit}
          onOpenContact={openContact}
          visible={unitPanelVisible}
        />
      )}
    </div>
  );
}

/**
 * Modo render (`/aura/render/:viewId?piso=&unidad=`): vistas del desarrollo —imágenes con
 * zonas clicables, o la planta por nivel que dibuja el motor— que llevan a otra vista o
 * abren la ficha de la unidad, alimentadas por el mismo inventario de Supabase que el
 * selector 3D. Las vistas con imagen no dependen del modelo 3D: un cliente que solo entrega
 * renders las usa tal cual.
 */
export function RenderView() {
  if (!usableRender) return <Navigate to="/aura" replace />;
  return <RenderExperience config={auraConfig} render={usableRender} />;
}
