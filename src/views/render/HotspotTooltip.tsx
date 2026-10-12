export interface TooltipState {
  /** Posición del puntero en pantalla (coordenadas de cliente). */
  x: number;
  y: number;
  title: string;
  detail: string | null;
}

/** Globo con el nombre de la zona o unidad bajo el cursor y el dato que explica su color. */
export function HotspotTooltip({ tooltip }: { tooltip: TooltipState }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-30 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-lg bg-neutral-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
      style={{
        left: Math.min(Math.max(tooltip.x, 112), window.innerWidth - 112),
        top: tooltip.y - 14,
      }}
    >
      <p className="font-medium">{tooltip.title}</p>
      {tooltip.detail && <p className="mt-0.5 text-neutral-300">{tooltip.detail}</p>}
    </div>
  );
}
