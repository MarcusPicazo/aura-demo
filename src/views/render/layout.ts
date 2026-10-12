/**
 * Espacio vertical que el modo render reserva fuera de la imagen: arriba, las pestañas y el
 * selector de vista; abajo, la leyenda y el aviso. Lo usan igual el escenario (para el
 * padding) y la precarga (para pedir la misma variante de `srcset` que luego pintará el `<img>`).
 */
export const STAGE_TOP_REM = 7.5;
export const STAGE_BOTTOM_REM = 5.5;
export const STAGE_RESERVED_VERTICAL_REM = STAGE_TOP_REM + STAGE_BOTTOM_REM;

/**
 * Padding derecho de escritorio (`sm:` en adelante) mientras la ficha de unidad está abierta: la
 * ficha mide 24rem (`w-96`) y queda a 1rem del borde, así que el escenario se recorre a la
 * izquierda en lugar de quedar tapado por ella. En celular la ficha es una hoja inferior y no se reserva nada.
 */
export const STAGE_PANEL_PADDING = 'sm:pr-[26rem]';

/** Duración del fundido entre vistas; el escenario quita la capa anterior cuando termina. */
export const STAGE_FADE_MS = 500;
