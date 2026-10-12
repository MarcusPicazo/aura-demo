import { activeCue, type TourCaptionId, type TourPlan } from './tour';
import { sunHourAt } from './tour';

/** Lo que el recorrido le pide al resto de la interfaz; cada función se llama solo cuando algo cambió. */
export interface TourHooks {
  setCaption: (caption: TourCaptionId | null) => void;
  setProgress: (progress: number) => void;
  setInside: (inside: boolean) => void;
  /** La hora del sol durante el barrido; `null` cuando termina (o antes de empezar): el sol vuelve a como estaba. */
  setSunHour: (hour: number | null) => void;
}

/** Cambios menores a esto (de hora del sol, de avance) no se reportan: la interfaz no necesita 60 avisos por segundo. */
const SUN_STEP_HOURS = 0.02;
const PROGRESS_STEP = 0.004;

/**
 * Traduce el tiempo del recorrido en cambios de la interfaz: qué rótulo toca, si la cámara está dentro de la unidad,
 * cuánto va de recorrido y en qué hora está el sol. Sin React: recibe el plan y las funciones que lo llevan a la pantalla.
 */
export function createTourRunner(plan: TourPlan, hooks: TourHooks) {
  let caption: TourCaptionId | null | undefined;
  let inside: boolean | undefined;
  let sunHour: number | null | undefined;
  let progressSent = -1;

  return {
    update(time: number, progress: number) {
      const cue = activeCue(plan.cues, time)?.id ?? null;
      if (cue !== caption) {
        caption = cue;
        hooks.setCaption(cue);
      }
      const isInside = plan.inside !== null && time >= plan.inside[0] && time <= plan.inside[1];
      if (isInside !== inside) {
        inside = isInside;
        hooks.setInside(isInside);
      }
      const hour = sunHourAt(plan.sun, time);
      if (hour === null ? sunHour !== null : sunHour === null || sunHour === undefined || Math.abs(hour - sunHour) >= SUN_STEP_HOURS) {
        sunHour = hour;
        hooks.setSunHour(hour);
      }
      if (Math.abs(progress - progressSent) >= PROGRESS_STEP) {
        progressSent = progress;
        hooks.setProgress(progress);
      }
    },
    /** Deja todo como estaba (rótulo fuera, sol restaurado, cámara fuera de la unidad). */
    finish() {
      hooks.setCaption(null);
      hooks.setInside(false);
      hooks.setSunHour(null);
      hooks.setProgress(0);
      caption = undefined;
      inside = undefined;
      sunHour = undefined;
      progressSent = -1;
    },
  };
}
