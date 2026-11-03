import { describe, expect, it } from 'vitest';
import { addDaysToKey, dayTotals, linearTrend, mifflinBmr, recipePerServing, splitByMeals, suggestTargets, withCarbsForCalories, defaultMealSplit } from './calc';
import { generateRecommendations, type EngineInput } from './engine';
import { matchFood, referenceFoods, searchFoods } from './foods';
import { parseScanResult, rescaleIngredient, scanTotals, createHttpScannerProvider, ScannerError, type ScanIngredient } from './scanner';
import { adherence, buildBuckets } from './stats';
import type { NutritionEntry, Targets } from './types';

const TODAY = '2025-06-30';
const targets: Targets = { calories: 2500, protein: 150, carbohydrates: 300, fat: 70 };

const mealEntry = (calories: number, protein = 0): NutritionEntry => ({ id: String(Math.random()), timestamp: '', kind: 'meal', amount: 0, macros: { calories, protein, carbohydrates: 0, fat: 0 }, mealType: 'comida' });

function baseInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    today: TODAY,
    profile: { sex: 'Hombre', age: 30, heightCm: 180, weightKg: 80 },
    goal: 'maintain',
    targets,
    bmr: 1800,
    bodyWeight: [],
    entriesByDay: {},
    training: { sessionsPerWeek: 4, setsPerWeek: 60, setsByGroup: {}, trainingWeekdays: [1, 2, 4, 5], typeByWeekday: {} },
    todayTraining: { isTraining: false, exerciseCount: 0 },
    performance: null,
    waterGoalMl: 2500,
    ...overrides,
  };
}

const weights = (values: number[], spacing = 5) => values.map((value, index) => ({ id: String(index), date: addDaysToKey(TODAY, -(values.length - 1 - index) * spacing), value }));
const loggedDays = (count: number, calories: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [addDaysToKey(TODAY, -(index + 1)), [mealEntry(calories, 150)]]));

describe('calc', () => {
  it('suma macros y agua por día', () => {
    const totals = dayTotals([mealEntry(500, 30), mealEntry(300, 10), { id: 'w', timestamp: '', kind: 'water', amount: 250 }]);
    expect(totals.macros.calories).toBe(800);
    expect(totals.macros.protein).toBe(40);
    expect(totals.waterMl).toBe(250);
  });

  it('calcula Mifflin-St Jeor', () => {
    expect(Math.round(mifflinBmr({ sex: 'Hombre', weightKg: 80, heightCm: 180, age: 30 }))).toBe(1780);
    expect(Math.round(mifflinBmr({ sex: 'Mujer', weightKg: 60, heightCm: 165, age: 28 }))).toBe(1330);
  });

  it('propone objetivos coherentes y cuadra carbohidratos', () => {
    const gain = suggestTargets({ goal: 'gain', weightKg: 80, tdee: 2800, bmr: 1800 });
    const lose = suggestTargets({ goal: 'lose', weightKg: 80, tdee: 2800, bmr: 1800 });
    expect(gain.calories).toBeGreaterThan(lose.calories);
    expect(lose.calories).toBeGreaterThanOrEqual(1800);
    expect(withCarbsForCalories({ calories: 2000, protein: 150, fat: 60, carbohydrates: 0 }).carbohydrates).toBe(215);
  });

  it('reparte calorías entre comidas', () => {
    const split = splitByMeals(targets, defaultMealSplit());
    expect(split.desayuno.calories).toBe(625);
    const total = Object.values(split).reduce((sum, item) => sum + item.calories, 0);
    expect(total).toBe(2500);
  });

  it('calcula los valores de una receta por ración', () => {
    const per = recipePerServing({ id: 'r', name: 'r', servings: 2, ingredients: [{ name: 'a', grams: 200, per100: { calories: 100, protein: 10, carbohydrates: 5, fat: 2 } }] });
    expect(per.calories).toBe(100);
    expect(per.protein).toBe(10);
  });

  it('la tendencia lineal ignora un valor puntual atípico', () => {
    const trend = linearTrend(weights([80, 80, 80.1, 82.5, 80.1, 80.2, 80.2], 4));
    expect(trend).not.toBeNull();
    expect(Math.abs(trend?.slopePerWeek ?? 99)).toBeLessThan(0.4);
  });
});

describe('foods', () => {
  it('busca sin tildes ni mayúsculas', () => {
    expect(searchFoods(referenceFoods, 'POLLO').length).toBeGreaterThan(0);
    expect(searchFoods(referenceFoods, 'zzzzqq')).toEqual([]);
  });
  it('empareja nombres libres', () => {
    expect(matchFood(referenceFoods, 'Arroz cocido')).not.toBeNull();
    expect(matchFood(referenceFoods, 'xyzxyz')).toBeNull();
  });
});

describe('motor de recomendaciones', () => {
  it('no propone cambios con datos insuficientes', () => {
    const result = generateRecommendations(baseInput({ bodyWeight: weights([80, 80.5]) }));
    expect(result.some((item) => item.proposal)).toBe(false);
    expect(result.some((item) => item.id === 'weight-data')).toBe(true);
  });

  it('propone ajustar calorías cuando el peso se sale del rango y hay adherencia', () => {
    const result = generateRecommendations(baseInput({ bodyWeight: weights([78, 78.8, 79.7, 80.5, 81.4]), entriesByDay: loggedDays(12, 2500) }));
    const adjustment = result.find((item) => item.id === 'calorie-adjust');
    expect(adjustment?.proposal).toBeDefined();
    expect(adjustment?.proposal?.calories).toBeLessThan(targets.calories);
    expect(Math.abs((adjustment?.proposal?.calories ?? 0) - targets.calories)).toBeLessThanOrEqual(250);
    expect(targets.calories).toBe(2500);
  });

  it('no propone ajuste si no se cumple el objetivo registrado', () => {
    const result = generateRecommendations(baseInput({ bodyWeight: weights([78, 78.8, 79.7, 80.5, 81.4]), entriesByDay: loggedDays(12, 1700) }));
    expect(result.some((item) => item.proposal)).toBe(false);
    expect(result.some((item) => item.id === 'adherence')).toBe(true);
  });

  it('respeta el periodo de espera tras un ajuste', () => {
    const result = generateRecommendations(baseInput({ bodyWeight: weights([78, 78.8, 79.7, 80.5, 81.4]), entriesByDay: loggedDays(12, 2500), lastAdjustmentDate: addDaysToKey(TODAY, -5) }));
    expect(result.some((item) => item.proposal)).toBe(false);
    expect(result.some((item) => item.id === 'cooldown')).toBe(true);
  });

  it('no propone déficits a menores de edad', () => {
    const result = generateRecommendations(baseInput({ goal: 'lose', profile: { sex: 'Hombre', age: 16, heightCm: 175, weightKg: 70 }, bodyWeight: weights([70, 70.3, 70.6, 70.9, 71.2]), entriesByDay: loggedDays(12, 2500) }));
    expect(result.some((item) => item.proposal)).toBe(false);
    expect(result.some((item) => item.id === 'minor')).toBe(true);
  });

  it('no baja de un suelo calórico al perder grasa', () => {
    const low: Targets = { calories: 1500, protein: 140, carbohydrates: 100, fat: 50 };
    const result = generateRecommendations(baseInput({ goal: 'lose', targets: low, bmr: 1500, bodyWeight: weights([80, 79, 78, 77, 76]), entriesByDay: loggedDays(12, 1500) }));
    for (const item of result) if (item.proposal) expect(item.proposal.calories).toBeGreaterThanOrEqual(1500);
  });
});

describe('estadísticas', () => {
  it('no cuenta los días sin registro como 0 kcal', () => {
    const buckets = buildBuckets(loggedDays(2, 2000), TODAY, 'week');
    expect(buckets).toHaveLength(7);
    expect(buckets.filter((bucket) => bucket.calories !== null)).toHaveLength(2);
  });
  it('calcula cumplimiento', () => {
    const result = adherence(loggedDays(4, 2500), TODAY, 'week', targets);
    expect(result).toEqual({ loggedDays: 4, calorieDays: 4, proteinDays: 4 });
  });
});

const sample = (overrides: Partial<ScanIngredient> = {}): ScanIngredient => ({ name: 'Arroz', category: 'ingrediente', grams: 200, calories: 260, protein: 5, carbohydrates: 56, fat: 0.5, ...overrides });

describe('food scanner', () => {
  it('valida y normaliza la respuesta', () => {
    const parsed = parseScanResult({ dishName: 'Plato', ingredients: [{ name: 'Pollo', grams: 150, gramsMin: 120, gramsMax: 180, calories: 250, protein: 40, carbohydrates: 0, fat: 8 }], notes: ['Aceite no visible'] });
    expect(parsed.ingredients[0].category).toBe('ingrediente');
    expect(parsed.notes).toHaveLength(1);
  });

  it('rechaza respuestas inválidas', () => {
    expect(() => parseScanResult(null)).toThrow(ScannerError);
    expect(() => parseScanResult({ ingredients: [] })).toThrow(ScannerError);
    expect(() => parseScanResult({ ingredients: [{ name: 'X', grams: -5, calories: 1, protein: 1, carbohydrates: 1, fat: 1 }] })).toThrow(ScannerError);
    expect(() => parseScanResult({ ingredients: [{ name: 'X', grams: 5, calories: 'mucho', protein: 1, carbohydrates: 1, fat: 1 }] })).toThrow(ScannerError);
  });

  it('calcula rangos de incertidumbre', () => {
    const withRange = scanTotals([sample({ gramsMin: 150, gramsMax: 250 })]);
    expect(withRange.min.calories).toBeCloseTo(195);
    expect(withRange.max.calories).toBeCloseTo(325);
    const generic = scanTotals([sample({ category: 'aceite', grams: 10, calories: 88, protein: 0, carbohydrates: 0, fat: 10 })]);
    expect(generic.usesGenericMargin).toBe(true);
    expect(generic.min.calories).toBeCloseTo(44);
    expect(generic.max.calories).toBeCloseTo(132);
  });

  it('reescala al corregir gramos', () => {
    const scaled = rescaleIngredient(sample(), 100);
    expect(scaled.calories).toBe(130);
    expect(scaled.grams).toBe(100);
  });

  it('mapea errores HTTP del proveedor', async () => {
    const image = { base64: 'abc', mimeType: 'image/jpeg' as const };
    const provider = (status: number, body: unknown = {}) => createHttpScannerProvider({ url: 'https://x.test', fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as typeof fetch });
    await expect(provider(401).analyze(image)).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(provider(429).analyze(image)).rejects.toMatchObject({ code: 'rate-limited' });
    await expect(provider(500).analyze(image)).rejects.toMatchObject({ code: 'server' });
    const failing = createHttpScannerProvider({ url: 'https://x.test', fetchImpl: (async () => { throw new TypeError('offline'); }) as typeof fetch });
    await expect(failing.analyze(image)).rejects.toMatchObject({ code: 'network' });
    const ok = await provider(200, { ingredients: [{ name: 'Pollo', grams: 100, calories: 165, protein: 31, carbohydrates: 0, fat: 3.6 }] }).analyze(image);
    expect(ok.ingredients).toHaveLength(1);
  });
});
