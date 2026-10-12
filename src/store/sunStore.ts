import { create } from 'zustand';
import { activeConfig } from '../config/active';
import { parseMonthDay, type MonthDay } from '../lib/solar';

interface SunState {
  /** El sol de la escena sigue la fecha y la hora de abajo. Apagado, se ve el sol fijo de siempre. */
  enabled: boolean;
  /** Fecha del año y hora local decimal (16.5 = 4:30 pm). */
  date: MonthDay;
  hour: number;
  /** Resalta en el edificio las unidades que reciben sol de tarde. */
  afternoonMap: boolean;
  setEnabled: (enabled: boolean) => void;
  setDate: (date: MonthDay) => void;
  setHour: (hour: number) => void;
  setAfternoonMap: (afternoonMap: boolean) => void;
}

const FALLBACK_DATE: MonthDay = { month: 3, day: 20 };
const FALLBACK_HOUR = 16.5;

/** Fecha y hora con que abre el control: las de `config.solar` (si falta o está mal escrita, el equinoccio a las 4:30 pm). */
const initialDate = (activeConfig.solar && parseMonthDay(activeConfig.solar.defaultDate)) || FALLBACK_DATE;
const initialHour = activeConfig.solar?.defaultHour ?? FALLBACK_HOUR;

/** Asoleamiento global: lo escribe el control de hora y fecha, y lo leen la luz de la escena, el mapa de unidades y la ficha. */
export const useSunStore = create<SunState>((set) => ({
  enabled: false,
  date: initialDate,
  hour: initialHour,
  afternoonMap: false,
  setEnabled: (enabled) => set({ enabled }),
  setDate: (date) => set({ date }),
  setHour: (hour) => set({ hour }),
  setAfternoonMap: (afternoonMap) => set({ afternoonMap }),
}));
