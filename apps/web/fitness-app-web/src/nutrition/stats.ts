import { addDaysToKey, average, dayTotals, lastDays, parseDateKey } from './calc';
import type { NutritionEntry, ProgressPoint, Targets } from './types';

export type RangeId = 'week' | 'month' | 'quarter';
export const rangeDays: Record<RangeId, number> = { week: 7, month: 30, quarter: 90 };
export const rangeLabels: Record<RangeId, string> = { week: 'Semana', month: 'Mes', quarter: 'Trimestre' };

export type Bucket = {
  label: string;
  start: string;
  end: string;
  loggedDays: number;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
};

const shortLabel = (key: string) => {
  const date = parseDateKey(key);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

/** Agrupa el periodo en cubos (días en semana/mes, semanas en trimestre). Los días sin registro no cuentan como 0 kcal. */
export function buildBuckets(entriesByDay: Record<string, NutritionEntry[]>, today: string, range: RangeId): Bucket[] {
  const days = lastDays(today, rangeDays[range]);
  const size = range === 'quarter' ? 7 : 1;
  const buckets: Bucket[] = [];
  for (let index = 0; index < days.length; index += size) {
    const slice = days.slice(index, index + size);
    const logged = slice.map((day) => dayTotals(entriesByDay[day]).macros).filter((macros) => macros.calories > 0);
    const averageOf = (pick: (macros: (typeof logged)[number]) => number) => (logged.length ? average(logged.map(pick)) : null);
    buckets.push({
      label: shortLabel(slice[0]),
      start: slice[0],
      end: slice[slice.length - 1],
      loggedDays: logged.length,
      calories: averageOf((macros) => macros.calories),
      protein: averageOf((macros) => macros.protein),
      carbohydrates: averageOf((macros) => macros.carbohydrates),
      fat: averageOf((macros) => macros.fat),
    });
  }
  return buckets;
}

export type Adherence = { loggedDays: number; calorieDays: number; proteinDays: number };

/** Días con calorías dentro de ±10 % del objetivo y días con al menos el 90 % de la proteína objetivo. */
export function adherence(entriesByDay: Record<string, NutritionEntry[]>, today: string, range: RangeId, targets: Targets): Adherence {
  let loggedDays = 0;
  let calorieDays = 0;
  let proteinDays = 0;
  for (const day of lastDays(today, rangeDays[range])) {
    const macros = dayTotals(entriesByDay[day]).macros;
    if (macros.calories <= 0) continue;
    loggedDays += 1;
    if (Math.abs(macros.calories - targets.calories) <= targets.calories * 0.1) calorieDays += 1;
    if (macros.protein >= targets.protein * 0.9) proteinDays += 1;
  }
  return { loggedDays, calorieDays, proteinDays };
}

export function weightSeries(points: ProgressPoint[], today: string, range: RangeId) {
  const start = addDaysToKey(today, -(rangeDays[range] - 1));
  return points.filter((point) => point.date >= start && point.date <= today).sort((a, b) => a.date.localeCompare(b.date));
}
