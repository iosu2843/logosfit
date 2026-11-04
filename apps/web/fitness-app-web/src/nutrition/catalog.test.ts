import { describe, expect, it } from 'vitest';
import { householdUnits, normalizeText, referenceFoods, searchFoods } from './foods';

describe('catálogo de alimentos', () => {
  it('tiene ids y nombres únicos', () => {
    expect(new Set(referenceFoods.map((food) => food.id)).size).toBe(referenceFoods.length);
    expect(new Set(referenceFoods.map((food) => normalizeText(food.name))).size).toBe(referenceFoods.length);
  });

  it('tiene valores no negativos y calorías coherentes con los macros', () => {
    const bad = referenceFoods.filter(({ name, per100: m }) => {
      if (/vino|cerveza|cacao puro/i.test(name)) return false; // alcohol y cacao (fibra/teobromina) no cuadran con los factores de Atwater
      const expected = 4 * m.protein + 4 * Math.max(0, m.carbohydrates - (m.fiber ?? 0)) + 2 * (m.fiber ?? 0) + 9 * m.fat;
      const values = [m.calories, m.protein, m.carbohydrates, m.fat];
      return values.some((v) => v < 0) || m.protein + m.carbohydrates + m.fat > 100.5 || Math.abs(m.calories - expected) > Math.max(40, expected * 0.3);
    }).map((food) => food.name);
    expect(bad).toEqual([]);
  });

  it('ofrece medidas caseras con peso definido', () => {
    const find = (name: string) => referenceFoods.find((food) => food.name === name)!;
    expect(householdUnits(find('Queso en lonchas'))).toEqual([{ label: '1 loncha', amount: 20 }]);
    expect(householdUnits(find('Leche entera')).some((unit) => unit.label === '1 vaso' && unit.amount === 200)).toBe(true);
    expect(householdUnits(find('Aceite de oliva')).map((unit) => unit.label)).toContain('1 cucharada');
  });

  it('distingue variantes y busca por categoría', () => {
    expect(searchFoods(referenceFoods, 'mozzarella', 10).map((food) => food.name)).toEqual(expect.arrayContaining(['Queso mozzarella fresca', 'Queso mozzarella rallada']));
    expect(searchFoods(referenceFoods, 'skyr').length).toBeGreaterThan(0);
    expect(searchFoods(referenceFoods, 'suplementación', 50).length).toBeGreaterThan(5);
  });
});
