import type { Macros, MealType, NutritionEntry, NutritionGoal, Recipe, Targets } from './types';
import { mealTypes } from './types';

export const round1 = (value: number) => Math.round(value * 10) / 10;
export const round0 = (value: number) => Math.round(value);
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const emptyMacros = (): Macros => ({ calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 });

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbohydrates: a.carbohydrates + b.carbohydrates,
    fat: a.fat + b.fat,
    fiber: (a.fiber ?? 0) + (b.fiber ?? 0),
  };
}

export function roundMacros(macros: Macros): Macros {
  return {
    calories: round0(macros.calories),
    protein: round1(macros.protein),
    carbohydrates: round1(macros.carbohydrates),
    fat: round1(macros.fat),
    fiber: round1(macros.fiber ?? 0),
  };
}

export function scalePer100(per100: Macros, amount: number): Macros {
  const factor = Math.max(0, amount) / 100;
  return {
    calories: per100.calories * factor,
    protein: per100.protein * factor,
    carbohydrates: per100.carbohydrates * factor,
    fat: per100.fat * factor,
    fiber: (per100.fiber ?? 0) * factor,
  };
}

export function entryMacros(entry: NutritionEntry): Macros {
  if (entry.kind === 'meal' && entry.macros) return { ...entry.macros, fiber: entry.fiber ?? 0 };
  if (entry.kind === 'protein') return { ...emptyMacros(), protein: entry.amount };
  return emptyMacros();
}

export type DayTotals = { macros: Macros; waterMl: number; mealCount: number; hasData: boolean };

export function dayTotals(entries: NutritionEntry[] | undefined): DayTotals {
  const list = entries ?? [];
  let macros = emptyMacros();
  let waterMl = 0;
  let mealCount = 0;
  for (const entry of list) {
    if (entry.kind === 'water') waterMl += entry.amount;
    else {
      macros = addMacros(macros, entryMacros(entry));
      if (entry.kind === 'meal') mealCount += 1;
    }
  }
  return { macros, waterMl, mealCount, hasData: mealCount > 0 || macros.protein > 0 };
}

export function entriesByMeal(entries: NutritionEntry[] | undefined): Record<MealType, NutritionEntry[]> {
  const grouped = Object.fromEntries(mealTypes.map((meal) => [meal.id, [] as NutritionEntry[]])) as Record<MealType, NutritionEntry[]>;
  for (const entry of entries ?? []) {
    if (entry.kind !== 'meal') continue;
    grouped[entry.mealType ?? 'comida'].push(entry);
  }
  return grouped;
}

/* Fechas: claves YYYY-MM-DD en hora local, igual que el resto de la app. */
export function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDaysToKey(key: string, days: number) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Los `count` días que terminan en `endKey`, del más antiguo al más reciente. */
export function lastDays(endKey: string, count: number) {
  return Array.from({ length: count }, (_, index) => addDaysToKey(endKey, index - (count - 1)));
}

export function daysBetween(fromKey: string, toKey: string) {
  return Math.round((parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime()) / 86_400_000);
}

/* Energía */
export function mifflinBmr(input: { sex: string; weightKg: number; heightCm: number; age: number }) {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  if (input.sex === 'Hombre') return base + 5;
  if (input.sex === 'Mujer') return base - 161;
  return base - 78;
}

export function activityFactor(level: string) {
  if (level.startsWith('Sedentario')) return 1.2;
  if (level.startsWith('Ligero')) return 1.375;
  if (level.startsWith('Moderado')) return 1.55;
  if (level.startsWith('Alto')) return 1.725;
  if (level.startsWith('Muy alto')) return 1.9;
  return 1.375;
}

export function goalFromText(text: string): NutritionGoal {
  const value = text.toLocaleLowerCase('es');
  if (value.includes('muscular') || value.includes('fuerza')) return 'gain';
  if (value.includes('grasa')) return 'lose';
  return 'maintain';
}

export const goalLabels: Record<NutritionGoal, string> = {
  gain: 'Ganancia muscular',
  maintain: 'Mantenimiento',
  lose: 'Pérdida de grasa',
};

export function caloriesFromMacros(protein: number, carbohydrates: number, fat: number) {
  return round0(protein * 4 + carbohydrates * 4 + fat * 9);
}

/** Propone objetivos a partir del gasto estimado. Es un punto de partida, no una prescripción. */
export function suggestTargets(input: { goal: NutritionGoal; weightKg: number; tdee: number; bmr: number }): Targets {
  const { goal, weightKg, tdee, bmr } = input;
  const factor = goal === 'gain' ? 1.1 : goal === 'lose' ? 0.85 : 1;
  const calories = round0(Math.max(tdee * factor, goal === 'lose' ? bmr : 0) / 10) * 10;
  const protein = round0(weightKg * (goal === 'gain' ? 1.8 : goal === 'lose' ? 2 : 1.6));
  const fat = round0(Math.max(weightKg * 0.7, (calories * 0.25) / 9));
  const carbohydrates = Math.max(0, round0((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbohydrates, fat };
}

/** Reajusta los carbohidratos para que las calorías y los macros cuadren. */
export function withCarbsForCalories(targets: Targets): Targets {
  const carbohydrates = Math.max(0, round0((targets.calories - targets.protein * 4 - targets.fat * 9) / 4));
  return { ...targets, carbohydrates };
}

export const defaultMealSplit = (): Record<MealType, number> => ({
  desayuno: 25,
  'media-manana': 10,
  comida: 30,
  merienda: 10,
  cena: 25,
});

export function splitByMeals(targets: Targets, split: Record<MealType, number>): Record<MealType, Targets> {
  const total = Object.values(split).reduce((sum, value) => sum + value, 0) || 100;
  return Object.fromEntries(
    mealTypes.map((meal) => {
      const share = (split[meal.id] ?? 0) / total;
      return [
        meal.id,
        {
          calories: round0(targets.calories * share),
          protein: round0(targets.protein * share),
          carbohydrates: round0(targets.carbohydrates * share),
          fat: round0(targets.fat * share),
        },
      ];
    }),
  ) as Record<MealType, Targets>;
}

/* Recetas */
export function recipeTotals(recipe: Recipe): Macros {
  return recipe.ingredients.reduce((sum, item) => addMacros(sum, scalePer100(item.per100, item.grams)), emptyMacros());
}

export function recipePerServing(recipe: Recipe): Macros {
  const total = recipeTotals(recipe);
  const servings = Math.max(1, recipe.servings);
  return {
    calories: total.calories / servings,
    protein: total.protein / servings,
    carbohydrates: total.carbohydrates / servings,
    fat: total.fat / servings,
    fiber: (total.fiber ?? 0) / servings,
  };
}

/* Tendencias */
export type Trend = { slopePerWeek: number; n: number; spanDays: number; first: number; last: number };

/** Regresión lineal por mínimos cuadrados sobre (días, valor). Suaviza fluctuaciones puntuales. */
export function linearTrend(points: Array<{ date: string; value: number }>): Trend | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const origin = sorted[0].date;
  const xs = sorted.map((point) => daysBetween(origin, point.date));
  const ys = sorted.map((point) => point.value);
  const n = sorted.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (denominator === 0) return null;
  const slope = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0) / denominator;
  return { slopePerWeek: slope * 7, n, spanDays: xs[n - 1] - xs[0], first: ys[0], last: ys[n - 1] };
}

export function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
