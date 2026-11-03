export type MacroTotals = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

export type MealAnalysis = {
  macros: MacroTotals;
  foods: string[];
  unmatchedText: string;
};

type FoodReference = {
  name: string;
  aliases: string[];
  servingGrams: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

const foodReferences: FoodReference[] = [
  { name: 'Pechuga de pollo', aliases: ['pechuga de pollo', 'fiambre de pollo', 'pollo'], servingGrams: 100, calories: 165, protein: 31, carbohydrates: 0, fat: 3.6 },
  { name: 'Pechuga de pavo', aliases: ['fiambre de pavo', 'pechuga de pavo', 'pavo'], servingGrams: 100, calories: 135, protein: 29, carbohydrates: 0, fat: 1.6 },
  { name: 'Salmón', aliases: ['salmon'], servingGrams: 100, calories: 208, protein: 20.4, carbohydrates: 0, fat: 13.4 },
  { name: 'Atún', aliases: ['atun'], servingGrams: 100, calories: 116, protein: 25.5, carbohydrates: 0, fat: 0.8 },
  { name: 'Huevo', aliases: ['huevos', 'huevo'], servingGrams: 50, calories: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5 },
  { name: 'Arroz cocido', aliases: ['arroz integral cocido', 'arroz cocido', 'arroz integral', 'arroz'], servingGrams: 100, calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3 },
  { name: 'Pasta cocida', aliases: ['pasta integral cocida', 'pasta cocida', 'pasta'], servingGrams: 100, calories: 157, protein: 5.8, carbohydrates: 30.9, fat: 0.9 },
  { name: 'Avena', aliases: ['avena'], servingGrams: 40, calories: 389, protein: 16.9, carbohydrates: 66.3, fat: 6.9 },
  { name: 'Pan integral', aliases: ['pan integral', 'pan'], servingGrams: 40, calories: 247, protein: 13, carbohydrates: 41, fat: 4.2 },
  { name: 'Patata cocida', aliases: ['patata cocida', 'patata', 'papa'], servingGrams: 100, calories: 87, protein: 1.9, carbohydrates: 20.1, fat: 0.1 },
  { name: 'Plátano', aliases: ['platano', 'banana'], servingGrams: 118, calories: 89, protein: 1.1, carbohydrates: 22.8, fat: 0.3 },
  { name: 'Manzana', aliases: ['manzana'], servingGrams: 182, calories: 52, protein: 0.3, carbohydrates: 13.8, fat: 0.2 },
  { name: 'Yogur griego', aliases: ['yogur griego', 'yogurt griego'], servingGrams: 100, calories: 73, protein: 10, carbohydrates: 3.9, fat: 2 },
  { name: 'Leche', aliases: ['leche'], servingGrams: 100, calories: 61, protein: 3.2, carbohydrates: 4.8, fat: 3.3 },
  { name: 'Lentejas cocidas', aliases: ['lentejas cocidas', 'lentejas'], servingGrams: 100, calories: 116, protein: 9, carbohydrates: 20.1, fat: 0.4 },
  { name: 'Garbanzos cocidos', aliases: ['garbanzos cocidos', 'garbanzos'], servingGrams: 100, calories: 164, protein: 8.9, carbohydrates: 27.4, fat: 2.6 },
  { name: 'Aguacate', aliases: ['aguacate', 'palta'], servingGrams: 50, calories: 160, protein: 2, carbohydrates: 8.5, fat: 14.7 },
  { name: 'Aceite de oliva', aliases: ['aceite de oliva', 'aceite'], servingGrams: 10, calories: 884, protein: 0, carbohydrates: 0, fat: 100 },
  { name: 'Queso cottage', aliases: ['queso cottage', 'cottage'], servingGrams: 100, calories: 98, protein: 11.1, carbohydrates: 3.4, fat: 4.3 },
  { name: 'Proteína en polvo', aliases: ['proteina en polvo', 'whey', 'proteina whey'], servingGrams: 30, calories: 120, protein: 24, carbohydrates: 3, fat: 1.5 },
  { name: 'Almendras', aliases: ['almendras', 'almendra'], servingGrams: 20, calories: 579, protein: 21.2, carbohydrates: 21.6, fat: 49.9 },
  { name: 'Brócoli', aliases: ['brocoli'], servingGrams: 100, calories: 34, protein: 2.8, carbohydrates: 6.6, fat: 0.4 },
  { name: 'Tofu', aliases: ['tofu'], servingGrams: 100, calories: 144, protein: 17.3, carbohydrates: 2.8, fat: 8.7 },
  { name: 'Jamón cocido', aliases: ['fiambre de jamon york', 'jamon cocido', 'jamon york', 'fiambre de jamon', 'fiambre'], servingGrams: 40, calories: 110, protein: 18, carbohydrates: 1.5, fat: 3 },
  { name: 'Jamón serrano', aliases: ['jamon iberico', 'jamon serrano', 'jamon'], servingGrams: 40, calories: 241, protein: 31, carbohydrates: 0, fat: 9 },
  { name: 'Mortadela', aliases: ['mortadela'], servingGrams: 30, calories: 311, protein: 16, carbohydrates: 3, fat: 25 },
  { name: 'Salchichón', aliases: ['salchichon'], servingGrams: 30, calories: 425, protein: 22, carbohydrates: 1.5, fat: 37 },
  { name: 'Chorizo', aliases: ['chorizo'], servingGrams: 30, calories: 455, protein: 24, carbohydrates: 2, fat: 38 },
  { name: 'Fuet', aliases: ['fuet'], servingGrams: 30, calories: 340, protein: 22, carbohydrates: 1, fat: 27 },
  { name: 'Lomo embuchado', aliases: ['lomo embuchado', 'lomo'], servingGrams: 30, calories: 200, protein: 32, carbohydrates: 0.5, fat: 7 },
  { name: 'Cecina', aliases: ['cecina'], servingGrams: 30, calories: 160, protein: 31, carbohydrates: 0, fat: 4 },
  { name: 'Choped', aliases: ['choped'], servingGrams: 30, calories: 205, protein: 14, carbohydrates: 3.5, fat: 15 },
  { name: 'Bacon', aliases: ['panceta', 'beicon', 'bacon'], servingGrams: 30, calories: 470, protein: 16, carbohydrates: 1.5, fat: 44 },
  { name: 'Queso manchego', aliases: ['queso manchego', 'manchego'], servingGrams: 30, calories: 414, protein: 26, carbohydrates: 0.5, fat: 34 },
  { name: 'Queso semicurado', aliases: ['queso semicurado'], servingGrams: 30, calories: 380, protein: 26, carbohydrates: 1, fat: 30 },
  { name: 'Queso curado', aliases: ['queso curado'], servingGrams: 30, calories: 420, protein: 28, carbohydrates: 1, fat: 35 },
  { name: 'Queso fresco', aliases: ['queso de burgos', 'queso fresco', 'queso burgos', 'queso tierno', 'burgos'], servingGrams: 50, calories: 170, protein: 14, carbohydrates: 3.5, fat: 11 },
  { name: 'Queso mozzarella', aliases: ['queso mozzarella', 'mozzarella'], servingGrams: 125, calories: 280, protein: 28, carbohydrates: 3, fat: 17 },
  { name: 'Queso crema', aliases: ['queso de untar', 'queso crema', 'philadelphia'], servingGrams: 30, calories: 250, protein: 6, carbohydrates: 4, fat: 23 },
  { name: 'Queso emmental', aliases: ['queso emmental', 'emmental'], servingGrams: 30, calories: 380, protein: 29, carbohydrates: 0.4, fat: 29 },
  { name: 'Queso gouda', aliases: ['queso en lonchas', 'lonchas de queso', 'queso gouda', 'gouda'], servingGrams: 30, calories: 356, protein: 25, carbohydrates: 2.2, fat: 27 },
  { name: 'Queso cheddar', aliases: ['queso cheddar', 'cheddar'], servingGrams: 30, calories: 403, protein: 25, carbohydrates: 1.3, fat: 33 },
  { name: 'Queso parmesano', aliases: ['queso parmesano', 'queso rallado', 'parmesano'], servingGrams: 10, calories: 431, protein: 38, carbohydrates: 4, fat: 29 },
  { name: 'Queso feta', aliases: ['queso feta', 'feta'], servingGrams: 40, calories: 264, protein: 14, carbohydrates: 4, fat: 21 },
  { name: 'Queso de cabra', aliases: ['queso de cabra', 'rulo de cabra'], servingGrams: 30, calories: 360, protein: 21, carbohydrates: 0.5, fat: 30 },
  { name: 'Queso azul', aliases: ['gorgonzola', 'queso azul', 'roquefort'], servingGrams: 30, calories: 353, protein: 21, carbohydrates: 2, fat: 29 },
  { name: 'Queso', aliases: ['queso'], servingGrams: 30, calories: 380, protein: 26, carbohydrates: 1, fat: 30 },
];

function normalizeFoodText(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function analyzeMealDescription(description: string): MealAnalysis | null {
  const normalized = normalizeFoodText(description);
  const matchedRanges: Array<[number, number]> = [];
  const foods: string[] = [];
  const macros: MacroTotals = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };

  for (const food of foodReferences) {
    const aliases = [...food.aliases].sort((first, second) => second.length - first.length);
    let match: RegExpMatchArray | null = null;
    let matchStart = -1;

    for (const alias of aliases) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matcher = new RegExp(`(?:^|\\b)(?:(\\d+(?:[.,]\\d+)?)\\s*(g|gr|gramos|ml)?\\s*(?:de\\s*)?)?${escapedAlias}(?:\\b)`, 'i');
      const candidate = matcher.exec(normalized);
      if (!candidate) continue;
      const candidateStart = candidate.index + candidate[0].indexOf(alias);
      const candidateEnd = candidateStart + alias.length;
      if (matchedRanges.some(([start, end]) => candidateStart < end && candidateEnd > start)) continue;
      match = candidate;
      matchStart = candidateStart;
      break;
    }

    if (!match) continue;
    const quantity = match[1] ? Number(match[1].replace(',', '.')) : 1;
    const hasGramUnit = Boolean(match[2]);
    const grams = hasGramUnit ? quantity : quantity * food.servingGrams;
    const scale = grams / 100;
    macros.calories += food.calories * scale;
    macros.protein += food.protein * scale;
    macros.carbohydrates += food.carbohydrates * scale;
    macros.fat += food.fat * scale;
    foods.push(food.name);
    matchedRanges.push([matchStart, matchStart + (match[0].length || 1)]);
  }

  if (foods.length === 0) return null;
  return {
    macros: {
      calories: Math.round(macros.calories),
      protein: Math.round(macros.protein * 10) / 10,
      carbohydrates: Math.round(macros.carbohydrates * 10) / 10,
      fat: Math.round(macros.fat * 10) / 10,
    },
    foods,
    unmatchedText: '',
  };
}