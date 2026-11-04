import { describe, expect, it } from 'vitest';
import { caloriesFromMacros } from './calc';
import { computeGoals, weeklyGoalTemplates, weeklyProgress, defaultFlags, type GoalsInput } from './nutritionGoalsEngine';
import { normalizeAIData } from './store';
import type { NutritionEntry } from './types';

const base: GoalsInput = {
  mode: 'volume', sex: 'Hombre', age: 28, weightKg: 80, heightCm: 180, activityLevel: 'Moderado · 3-4 días/semana',
  experience: 'Intermedio', sessionsPerWeek: 4, flags: defaultFlags(), mealsPerDay: 4,
};

describe('computeGoals', () => {
  it('calcula superávit en volumen y déficit en definición', () => {
    const volume = computeGoals(base);
    const cut = computeGoals({ ...base, mode: 'cut' });
    expect(volume.status).toBe('ok');
    expect(volume.targets.calories).toBeGreaterThan(volume.tdee);
    expect(cut.targets.calories).toBeLessThan(cut.tdee);
    expect(cut.targets.calories).toBeGreaterThanOrEqual(cut.bmr - 10);
  });

  it('los macros cuadran con las calorías', () => {
    for (const mode of ['volume', 'cut', 'recomp', 'maintain', 'habits'] as const) {
      const { targets } = computeGoals({ ...base, mode });
      expect(Math.abs(caloriesFromMacros(targets.protein, targets.carbohydrates, targets.fat) - targets.calories)).toBeLessThan(15);
    }
  });

  it('la media semanal de días de entrenamiento y descanso coincide con el objetivo', () => {
    const result = computeGoals(base);
    const average = (result.trainingDay.calories * 4 + result.restDay.calories * 3) / 7;
    expect(Math.abs(average - result.targets.calories)).toBeLessThan(15);
    expect(result.trainingDay.carbohydrates).toBeGreaterThan(result.restDay.carbohydrates);
    expect(result.trainingDay.protein).toBe(result.restDay.protein);
  });

  it('pide datos que faltan', () => {
    const result = computeGoals({ ...base, weightKg: null, sex: '' });
    expect(result.status).toBe('missing-data');
    expect(result.missing).toEqual(expect.arrayContaining(['peso', 'sexo']));
  });

  it('bloquea metas con TCA o embarazo', () => {
    expect(computeGoals({ ...base, flags: { ...defaultFlags(), eatingDisorder: true } }).status).toBe('blocked');
    expect(computeGoals({ ...base, flags: { ...defaultFlags(), pregnancy: true } }).status).toBe('blocked');
  });

  it('no propone déficit a menores ni con IMC bajo ni con condición médica', () => {
    expect(computeGoals({ ...base, mode: 'cut', age: 16 }).mode).toBe('maintain');
    expect(computeGoals({ ...base, mode: 'cut', weightKg: 50 }).mode).toBe('maintain');
    const medical = computeGoals({ ...base, mode: 'cut', flags: { ...defaultFlags(), condition: true } });
    expect(medical.mode).toBe('maintain');
    expect(medical.warnings.length).toBeGreaterThan(0);
  });
});

const day = (offset: number) => {
  const date = new Date(2025, 5, 30 - offset, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const today = day(0);
const meal = (calories: number, protein: number): NutritionEntry => ({ id: `m${calories}${protein}`, timestamp: '', kind: 'meal', amount: 0, macros: { calories, protein, carbohydrates: 0, fat: 0 }, mealType: 'comida', source: 'manual' });
const targets = { calories: 2800, protein: 150, carbohydrates: 350, fat: 80 };

describe('metas semanales', () => {
  it('calcula el progreso automático y manual', () => {
    const weekStart = day(2);
    const goals = weeklyGoalTemplates({ mode: 'volume', sessionsPerWeek: 3, hasFiber: true });
    const data = { weekStart, today, entriesByDay: { [day(2)]: [meal(2800, 150)], [day(1)]: [meal(2800, 100)] }, targets, fiberGrams: 30, waterGoalMl: 2500, trainedDates: [day(1)] };
    const find = (id: string) => goals.find((goal) => goal.id === id)!;
    expect(weeklyProgress(find('logged'), data).value).toBe(2);
    expect(weeklyProgress(find('protein'), data).value).toBe(1);
    expect(weeklyProgress(find('training'), data).value).toBe(1);
    const manual = { ...find('sleep'), manualProgress: 5 };
    expect(weeklyProgress(manual, data).done).toBe(true);
  });
});

describe('persistencia de metas', () => {
  it('migra datos antiguos sin goals y sanea datos corruptos', () => {
    expect(normalizeAIData({ version: 1, goal: 'gain' }).goals.mode).toBeNull();
    const data = normalizeAIData({ goals: { mode: 'x', prefs: { flags: { pregnancy: true } }, weekly: [{ nope: 1 }] } });
    expect(data.goals.mode).toBeNull();
    expect(data.goals.prefs.flags.pregnancy).toBe(true);
    expect(data.goals.weekly).toEqual([]);
  });
  it('conserva el modo guardado', () => {
    expect(normalizeAIData({ goals: { mode: 'recomp' } }).goals.mode).toBe('recomp');
  });
});

