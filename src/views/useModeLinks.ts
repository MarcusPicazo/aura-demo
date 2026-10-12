import { useLocation, useSearchParams } from 'react-router-dom';
import { availableModes, usableRenderOf, type AvailableModes } from '../lib/modes';
import { buildingPath } from '../lib/buildings';
import { FLOOR_PARAM, RENDER_BASE_PATH, findView, locateFloor, locateUnit, parseNumberParam, renderPath } from '../lib/render';
import { useSelectionStore } from '../store/selectionStore';
import { activeConfig as auraConfig, unitIdentity } from '../config/active';
import type { Unit } from '../types';

const modes = availableModes(auraConfig);
const render = usableRenderOf(auraConfig);

export interface ModeLinks {
  modes: AvailableModes;
  isTower: boolean;
  isRender: boolean;
  isProject: boolean;
  /** Destino del modo 3D: la unidad abierta, o —si solo se estaba mirando una planta— ese piso enfocado. */
  towerTo: string;
  /** Destino del modo render: la planta de la unidad abierta, o la del piso enfocado en el 3D. Estando
   *  ya en render apunta a donde estás, no a la vista predeterminada. */
  renderTo: string;
  /** Debe llamarse al ir al 3D: lleva al selector 3D el piso que se miraba en una planta. */
  onGoToTower: () => void;
}

/**
 * Cómo pasar entre el modo 3D y el modo render sin perder lo que el usuario traía (la unidad
 * abierta o el piso). Lo comparten las pestañas y el botón de cambio de modo, para que
 * ambos lleven siempre al mismo lugar.
 */
export function useModeLinks(units: Unit[]): ModeLinks {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedUnitKey = useSelectionStore((state) => state.selectedUnitKey);
  const focusedFloor = useSelectionStore((state) => state.focusedFloor);
  const setFocusedFloor = useSelectionStore((state) => state.setFocusedFloor);

  const isRender = location.pathname.startsWith(RENDER_BASE_PATH);
  const isProject = location.pathname.startsWith('/aura/proyecto');
  const isTower = !isRender && !isProject;

  const selectedUnit = unitIdentity.find(units, selectedUnitKey);
  const renderFloor = isRender ? parseNumberParam(searchParams.get(FLOOR_PARAM)) : null;

  // En un conjunto, estando en la planta de un edificio sin unidad abierta, el 3D abre ese edificio (no el masterplan).
  const renderViewId = isRender ? location.pathname.slice(RENDER_BASE_PATH.length + 1).split('/')[0] : '';
  const renderView = render && renderViewId ? findView(render, renderViewId) : undefined;
  const viewBuildingId = unitIdentity.multi && renderView?.kind === 'generatedPlan' ? renderView.buildingId : undefined;
  const towerTo = selectedUnit ? unitIdentity.path(selectedUnit) : viewBuildingId ? buildingPath(viewBuildingId) : '/aura';

  let renderTo = RENDER_BASE_PATH;
  if (render) {
    if (isRender) renderTo = `${location.pathname}${location.search}`;
    else if (selectedUnit) renderTo = renderPath(locateUnit(render, selectedUnit, unitIdentity.param(selectedUnit)));
    else {
      const floorLocation = focusedFloor !== null ? locateFloor(render, focusedFloor) : null;
      if (floorLocation) renderTo = renderPath(floorLocation);
    }
  }

  function onGoToTower() {
    if (!selectedUnitKey && renderFloor !== null) setFocusedFloor(renderFloor);
  }

  return { modes, isTower, isRender, isProject, towerTo, renderTo, onGoToTower };
}
