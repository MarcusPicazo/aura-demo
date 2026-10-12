/** Anchos (px) de las variantes responsivas del modo render. */
export const RENDER_WIDTHS = [800, 1600, 2400];

/** Los anchos que se generan para una imagen original: nunca por encima de su tamaño (no se amplía). */
export function variantWidths(originalWidth: number): number[] {
  const widths = RENDER_WIDTHS.filter((width) => width <= originalWidth);
  return widths.length > 0 ? widths : [originalWidth];
}
