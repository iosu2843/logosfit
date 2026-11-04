import { useCallback, useState } from 'react';
import { saveItem } from '../cloud';
import { defaultMealSplit } from './calc';
import { defaultPrefs } from './nutritionGoalsEngine';
import type { GoalMode, GoalsState, Macros, MealType, NutritionAIData, NutritionEntry, PlanDay, PlannedItem } from './types';
import { mealTypes } from './types';

export const NUTRITION_AI_KEY = 'fitness-nutrition-ai-by-profile';

export const emptyPlanDay = (): PlanDay => Object.fromEntries(mealTypes.map((meal) => [meal.id, [] as PlannedItem[]])) as PlanDay;

export const defaultGoalsState = (): GoalsState => ({ mode: null, prefs: defaultPrefs(), weekStart: null, weekly: [] });

const goalModeIds: GoalMode[] = ['volume', 'cut', 'recomp', 'maintain', 'habits'];

export function normalizeGoalsState(raw: unknown): GoalsState {
  const base = defaultGoalsState();
  if (!isRecord(raw)) return base;
  const prefs = isRecord(raw.prefs) ? raw.prefs : {};
  const flags = isRecord(prefs.flags) ? prefs.flags : {};
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 300) : '');
  return {
    mode: goalModeIds.includes(raw.mode as GoalMode) ? (raw.mode as GoalMode) : null,
    prefs: {
      experience: text(prefs.experience),
      restrictions: text(prefs.restrictions),
      allergies: text(prefs.allergies),
      mealTimes: text(prefs.mealTimes),
      flags: { eatingDisorder: flags.eatingDisorder === true, pregnancy: flags.pregnancy === true, condition: flags.condition === true, medication: flags.medication === true },
    },
    weekStart: typeof raw.weekStart === 'string' ? raw.weekStart : null,
    weekly: Array.isArray(raw.weekly) ? (raw.weekly as GoalsState['weekly']).filter((goal) => isRecord(goal) && typeof goal.id === 'string' && Number.isFinite(goal.target)) : [],
  };
}

export const defaultAIData = (): NutritionAIData => ({
  version: 1,
  goal: null,
  targets: null,
  mealSplit: defaultMealSplit(),
  customFoods: [],
  favoriteFoodIds: [],
  usage: {},
  recipes: [],
  savedMeals: [],
  weekPlan: {},
  adjustments: [],
  dismissed: {},
  goals: defaultGoalsState(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Mezcla datos guardados con los valores por defecto para tolerar versiones antiguas o datos corruptos. */
export function normalizeAIData(raw: unknown): NutritionAIData {
  const base = defaultAIData();
  if (!isRecord(raw)) return base;
  const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  const targets = isRecord(raw.targets) && ['calories', 'protein', 'carbohydrates', 'fat'].every((key) => typeof raw.targets !== 'object' || Number.isFinite((raw.targets as Record<string, unknown>)[key]))
    ? (raw.targets as unknown as NutritionAIData['targets'])
    : null;
  return {
    ...base,
    goal: raw.goal === 'gain' || raw.goal === 'maintain' || raw.goal === 'lose' ? raw.goal : null,
    targets,
    mealSplit: isRecord(raw.mealSplit) ? { ...base.mealSplit, ...(raw.mealSplit as Record<MealType, number>) } : base.mealSplit,
    customFoods: list(raw.customFoods),
    favoriteFoodIds: list(raw.favoriteFoodIds),
    usage: isRecord(raw.usage) ? (raw.usage as Record<string, number>) : {},
    recipes: list(raw.recipes),
    savedMeals: list(raw.savedMeals),
    weekPlan: isRecord(raw.weekPlan) ? (raw.weekPlan as unknown as NutritionAIData['weekPlan']) : {},
    adjustments: list(raw.adjustments),
    dismissed: isRecord(raw.dismissed) ? (raw.dismissed as Record<string, string>) : {},
    goals: normalizeGoalsState(raw.goals),
  };
}

function readAll(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(localStorage.getItem(NUTRITION_AI_KEY) ?? '{}');
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readAIData(scopeId: string): NutritionAIData {
  return normalizeAIData(readAll()[scopeId]);
}

export function writeAIData(scopeId: string, data: NutritionAIData) {
  saveItem(NUTRITION_AI_KEY, JSON.stringify({ ...readAll(), [scopeId]: data }));
}

export function useNutritionAI(scopeId: string) {
  const [state, setState] = useState(() => ({ scopeId, data: readAIData(scopeId) }));
  const data = state.scopeId === scopeId ? state.data : readAIData(scopeId);

  const update = useCallback(
    (change: (current: NutritionAIData) => NutritionAIData) => {
      setState((previous) => {
        const current = previous.scopeId === scopeId ? previous.data : readAIData(scopeId);
        const next = change(current);
        writeAIData(scopeId, next);
        return { scopeId, data: next };
      });
    },
    [scopeId],
  );

  return [data, update] as const;
}

export const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function makeMealEntry(input: {
  name: string;
  mealType: MealType;
  macros: Macros;
  grams?: number;
  source: NutritionEntry['source'];
  foods?: string[];
}): NutritionEntry {
  return {
    id: newId('meal'),
    timestamp: new Date().toISOString(),
    kind: 'meal',
    amount: 0,
    description: input.name,
    macros: { calories: input.macros.calories, protein: input.macros.protein, carbohydrates: input.macros.carbohydrates, fat: input.macros.fat },
    fiber: input.macros.fiber,
    mealType: input.mealType,
    grams: input.grams,
    source: input.source,
    foods: input.foods ?? [input.name],
  };
}

/** Duplica las comidas de otro día (no el agua ni la proteína suelta) para registrarlas en la fecha de destino. */
export function duplicateMeals(entries: NutritionEntry[]): NutritionEntry[] {
  return entries
    .filter((entry) => entry.kind === 'meal' && entry.macros)
    .map((entry) => ({ ...entry, id: newId('meal'), timestamp: new Date().toISOString(), source: 'copy' as const }));
}
