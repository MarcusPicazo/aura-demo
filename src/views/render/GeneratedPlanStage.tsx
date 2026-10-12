import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { FloorPlan, PlanCamera } from '../../engine/FloorPlan';
import { WebGLRecovery } from '../../engine/WebGLRecovery';
import { HotspotTooltip, type TooltipState } from './HotspotTooltip';
import { planFrame, type LevelPlan } from '../../lib/levelPlan';
import { buildPlanStyle } from '../../lib/planStyle';
import { unitDetail } from '../../lib/render';
import { useI18n } from '../../i18n/useI18n';

import { STAGE_BOTTOM_REM, STAGE_PANEL_PADDING, STAGE_TOP_REM } from './layout';
import type { Unit } from '../../types';

/** Duración del fundido al cambiar de nivel. */
const LEVEL_FADE_MS = 320;

interface GeneratedPlanStageProps {
  plan: LevelPlan;
  units: Unit[];
  selectedUnitCode: string | null;
  /** Una unidad (abre su ficha) o `null` al tocar fuera de ellas (la cierra). */
  onSelectUnit: (code: string | null) => void;
  /** Color de acento del desarrollo, para el contorno de la unidad seleccionada. */
  accent: string;
  /** Color de fondo del desarrollo: el lienzo se funde con la página. */
  background: string;
  /** Hay una ficha de unidad abierta: en escritorio se le deja su espacio a la derecha. */
  panelOpen: boolean;
}

/**
 * Planta del nivel dibujada por el motor (cámara ortográfica cenital), interactiva: pasar el
 * cursor muestra la unidad y su estado, tocarla abre su ficha. Se colorea con el inventario
 * que recibe por props —el mismo que el 3D y el render con imágenes—, así que un cambio de
 * estado en Supabase la recolorea sin recargar y nunca puede quedar desfasada.
 */
export function GeneratedPlanStage({ plan, units, selectedUnitCode, onSelectUnit, accent, background, panelOpen }: GeneratedPlanStageProps) {
  const i18n = useI18n();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const fadeRef = useRef<HTMLDivElement>(null);

  const style = useMemo(() => buildPlanStyle(accent, background), [accent, background]);
  const frame = useMemo(() => planFrame(plan.bounds), [plan.bounds]);
  const statuses = useMemo(() => new Map(units.map((unit) => [unit.code, unit.status] as const)), [units]);

  // Fundido al cambiar de nivel (y al entrar): el contenido del lienzo cambia de golpe, así que
  // se anima el lienzo entero. Con "reducir movimiento" no se anima nada.
  useEffect(() => {
    const element = fadeRef.current;
    if (!element || typeof element.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: LEVEL_FADE_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }, [plan.floor]);

  function handleHover(hover: { code: string; x: number; y: number } | null) {
    const unit = hover ? units.find((candidate) => candidate.code === hover.code) : undefined;
    setTooltip(hover ? { x: hover.x, y: hover.y, title: i18n.t('unit.label', { code: hover.code }), detail: unit ? unitDetail(i18n, unit) : null } : null);
  }

  return (
    <div
      className={`absolute inset-x-0 pl-16 pr-4 transition-[padding] duration-300 ease-elegant motion-reduce:transition-none sm:pl-16 sm:pr-16 ${
        panelOpen ? STAGE_PANEL_PADDING : ''
      }`}
      style={{ top: `${STAGE_TOP_REM}rem`, bottom: `${STAGE_BOTTOM_REM}rem` }}
    >
      <div ref={fadeRef} className="h-full w-full">
        <Canvas
          orthographic
          flat
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ antialias: true }}
          camera={{ near: 1, far: 100, position: [0, 50, 0], zoom: 1 }}
          onPointerMissed={() => onSelectUnit(null)}
        >
          <PlanCamera frame={frame} />
          <FloorPlan
            plan={plan}
            statuses={statuses}
            style={style}
            showStatus
            showCodes
            selectedUnitCode={selectedUnitCode}
            onSelectUnit={onSelectUnit}
            onHoverUnit={handleHover}
          />
          <WebGLRecovery />
        </Canvas>
      </div>

      {/* El lienzo no es accesible por teclado ni por lector de pantalla: esta lista hace lo mismo que tocar cada unidad. */}
      <ul className="sr-only">
        {plan.units.map((unit) => {
          const inventory = units.find((candidate) => candidate.code === unit.code);
          return (
            <li key={unit.code}>
              <button type="button" onClick={() => onSelectUnit(unit.code)}>
                {i18n.t('unit.label', { code: unit.code })}
                {inventory ? `, ${i18n.status(inventory.status)}` : ''}
              </button>
            </li>
          );
        })}
      </ul>

      {tooltip && <HotspotTooltip tooltip={tooltip} />}
    </div>
  );
}
