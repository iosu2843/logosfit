import { dairy } from './catalog/dairy';
import { extras } from './catalog/extras';
import { plants } from './catalog/plants';
import { protein } from './catalog/protein';
import type { FoodItem } from './types';

type Seed = [name: string, calories: number, protein: number, carbohydrates: number, fat: number, fiber?: number, unit?: 'g' | 'ml'];

export const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

const slug = (value: string) => normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Valores por 100 g (o 100 ml) tomados de USDA FoodData Central (SR Legacy), redondeados.
 * Son valores de referencia: las etiquetas de producto o el método de cocinado pueden variarlos.
 */
const seeds: Seed[] = [
  ['Pechuga de pollo cocida', 165, 31, 0, 3.6, 0],
  ['Pechuga de pavo cocida', 135, 29, 0, 1.6, 0],
  ['Carne picada de ternera (90 % magra) cocinada', 217, 26.1, 0, 11.8, 0],
  ['Salmón cocinado', 208, 20.4, 0, 13.4, 0],
  ['Atún al natural', 116, 25.5, 0, 0.8, 0],
  ['Bacalao cocinado', 105, 22.8, 0, 0.9, 0],
  ['Huevo entero', 143, 12.6, 0.7, 9.5, 0],
  ['Clara de huevo', 52, 10.9, 0.7, 0.2, 0],
  ['Tofu firme', 144, 17.3, 2.8, 8.7, 2.3],
  ['Arroz cocido', 130, 2.7, 28.2, 0.3, 0.4],
  ['Pasta cocida', 157, 5.8, 30.9, 0.9, 1.8],
  ['Quinoa cocida', 120, 4.4, 21.3, 1.9, 2.8],
  ['Avena en copos', 389, 16.9, 66.3, 6.9, 10.6],
  ['Pan integral', 247, 13, 41, 4.2, 6.8],
  ['Pan blanco', 265, 9, 49, 3.2, 2.7],
  ['Patata cocida', 87, 1.9, 20.1, 0.1, 1.8],
  ['Boniato cocido', 90, 2, 20.7, 0.2, 3.3],
  ['Lentejas cocidas', 116, 9, 20.1, 0.4, 7.9],
  ['Garbanzos cocidos', 164, 8.9, 27.4, 2.6, 7.6],
  ['Judías negras cocidas', 132, 8.9, 23.7, 0.5, 8.7],
  ['Plátano', 89, 1.1, 22.8, 0.3, 2.6],
  ['Manzana', 52, 0.3, 13.8, 0.2, 2.4],
  ['Naranja', 47, 0.9, 11.8, 0.1, 2.4],
  ['Aguacate', 160, 2, 8.5, 14.7, 6.7],
  ['Brócoli cocido', 35, 2.4, 7.2, 0.4, 3.3],
  ['Espinacas crudas', 23, 2.9, 3.6, 0.4, 2.2],
  ['Tomate', 18, 0.9, 3.9, 0.2, 1.2],
  ['Yogur griego natural', 73, 10, 3.9, 2, 0],
  ['Queso cottage', 98, 11.1, 3.4, 4.3, 0],
  ['Leche entera', 61, 3.2, 4.8, 3.3, 0, 'ml'],
  ['Leche desnatada', 34, 3.4, 5, 0.1, 0, 'ml'],
  ['Almendras', 579, 21.2, 21.6, 49.9, 12.5],
  ['Crema de cacahuete', 588, 25.1, 20, 50.4, 6],
  ['Aceite de oliva', 884, 0, 0, 100, 0, 'ml'],
  ['Miel', 304, 0.3, 82.4, 0, 0.2],
];

const baseFoods: FoodItem[] = seeds.map(([name, calories, proteinG, carbohydrates, fat, fiber, unit]) => ({
  id: `usda-${slug(name)}`,
  name,
  unit: unit ?? 'g',
  per100: { calories, protein: proteinG, carbohydrates, fat, fiber },
  source: 'USDA',
}));

const known = new Set(baseFoods.map((food) => normalizeText(food.name)));

/** Catálogo ampliado: valores aproximados de referencia (BEDCA/USDA). Se omiten nombres ya incluidos en la base inicial. */
const catalogFoods: FoodItem[] = [...dairy, ...protein, ...plants, ...extras].flatMap((section) =>
  section.rows.flatMap(([name, calories, proteinG, carbohydrates, fat, fiber, unit]) => {
    const key = normalizeText(name);
    if (known.has(key)) return [];
    known.add(key);
    const food: FoodItem = { id: `ref-${slug(name)}`, name, unit: unit ?? 'g', per100: { calories, protein: proteinG, carbohydrates, fat, fiber }, source: 'referencia', category: section.category };
    return [food];
  }),
);

export const referenceFoods: FoodItem[] = [...baseFoods, ...catalogFoods];

/** Medida casera con peso típico (g, o ml en líquidos). Son equivalencias medias de uso común. */
export type HouseholdUnit = { label: string; amount: number };

const unitRules: Array<[RegExp, HouseholdUnit[]]> = [
  [/aceite de|manteca de cerdo/, [{ label: '1 cucharada', amount: 13 }, { label: '1 cucharadita', amount: 4.5 }]],
  [/mantequilla|margarina/, [{ label: '1 cucharada', amount: 14 }, { label: '1 cucharadita', amount: 5 }]],
  [/mayonesa|alioli|kechup|ketchup|mostaza|pesto|salsa|tahini|crema de (cacahuete|almendra|cacao)|mermelada|miel|sirope/, [{ label: '1 cucharada', amount: 15 }, { label: '1 cucharadita', amount: 5 }]],
  [/azucar|cacao|maltodextrina|creatina/, [{ label: '1 cucharada', amount: 12 }, { label: '1 cucharadita', amount: 4 }]],
  [/proteina de|caseina|ganador|avena instantanea/, [{ label: '1 cacito (30 g)', amount: 30 }]],
  [/queso en lonchas|fiambre|jamon|pechuga de pavo en lonchas|lomo embuchado|salmon ahumado|bacon|chopped|mortadela|pastrami/, [{ label: '1 loncha', amount: 20 }]],
  [/queso en porciones/, [{ label: '1 porción', amount: 17 }]],
  [/queso/, [{ label: '1 loncha / porción', amount: 25 }]],
  [/pan de molde/, [{ label: '1 rebanada', amount: 30 }]],
  [/pan de barra|pan integral|pan blanco|pan de centeno|pan de espelta/, [{ label: '1 rebanada', amount: 30 }]],
  [/tostadas|biscotes/, [{ label: '1 unidad', amount: 8 }]],
  [/tortita de arroz/, [{ label: '1 unidad', amount: 9 }]],
  [/wrap|pita|bagel|tortilla de maiz/, [{ label: '1 unidad', amount: 60 }]],
  [/huevo de codorniz/, [{ label: '1 unidad', amount: 10 }]],
  [/clara/, [{ label: '1 clara', amount: 33 }]],
  [/yema/, [{ label: '1 yema', amount: 17 }]],
  [/huevo|tortilla francesa/, [{ label: '1 unidad (M)', amount: 55 }]],
  [/yogur|skyr|petit suisse|natillas|flan|cuajada|queso batido/, [{ label: '1 unidad', amount: 125 }]],
  [/manzana|pera|naranja|melocoton|nectarina|platano|aguacate/, [{ label: '1 unidad', amount: 150 }]],
  [/mandarina|kiwi|ciruela$|albaricoque|higo$/, [{ label: '1 unidad', amount: 80 }]],
  [/zanahoria|tomate$|pimiento|cebolla$/, [{ label: '1 unidad', amount: 100 }]],
  [/dátiles|datiles/, [{ label: '1 unidad', amount: 8 }]],
  [/almendras|nueces|avellanas|pistachos|anacardos|cacahuetes|mezcla de frutos secos/, [{ label: '1 puñado', amount: 30 }]],
  [/chia|lino|sesamo|girasol|calabaza$|amapola/, [{ label: '1 cucharada', amount: 10 }]],
  [/avena en copos|muesli|granola|cereales|copos/, [{ label: '1 cucharada', amount: 8 }, { label: '1 taza', amount: 40 }]],
  [/arroz|pasta|quinoa|cuscus|bulgur|macarrones|espaguetis|lentejas|garbanzos|alubias/, [{ label: '1 taza (cocido)', amount: 160 }]],
  [/galletas/, [{ label: '1 galleta', amount: 7 }]],
  [/magdalenas/, [{ label: '1 unidad', amount: 35 }]],
  [/croissant/, [{ label: '1 unidad', amount: 60 }]],
  [/chocolate/, [{ label: '1 onza', amount: 10 }]],
];

const liquidUnits: HouseholdUnit[] = [{ label: '1 vaso', amount: 200 }, { label: '1 taza', amount: 250 }, { label: '1 cucharada', amount: 15 }];

export function householdUnits(food: FoodItem): HouseholdUnit[] {
  const name = normalizeText(food.name);
  if (food.unit === 'ml') {
    if (/aceite|vinagre|salsa de soja|salsa teriyaki|vinagreta/.test(name)) return [{ label: '1 cucharada', amount: 13 }, { label: '1 cucharadita', amount: 4.5 }];
    return liquidUnits;
  }
  const rule = unitRules.find(([pattern]) => pattern.test(name));
  return rule ? rule[1] : [];
}

export function searchFoods(foods: FoodItem[], query: string, limit = 8): FoodItem[] {
  const needle = normalizeText(query);
  if (!needle) return [];
  const words = needle.split(/\s+/);
  return foods
    .map((food) => {
      const haystack = normalizeText(food.name);
      const searchable = food.category ? `${haystack} ${normalizeText(food.category)}` : haystack;
      if (!words.every((word) => searchable.includes(word))) return null;
      return { food, rank: haystack.startsWith(needle) ? 0 : haystack.includes(needle) ? 1 : 2 };
    })
    .filter((item): item is { food: FoodItem; rank: number } => item !== null)
    .sort((a, b) => a.rank - b.rank || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map((item) => item.food);
}

/** Busca la mejor coincidencia para un nombre libre, por ejemplo un ingrediente detectado en una foto. */
export function matchFood(foods: FoodItem[], name: string): FoodItem | null {
  const needle = normalizeText(name);
  if (!needle) return null;
  const exact = foods.find((food) => normalizeText(food.name) === needle);
  if (exact) return exact;
  const contained = foods.find((food) => {
    const key = normalizeText(food.name).split(' ')[0];
    return key.length > 3 && needle.includes(key);
  });
  return contained ?? null;
}
