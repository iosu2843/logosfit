import type { MacroTotals } from '../nutritionAnalyzer';

export type { MacroTotals };

export type Macros = MacroTotals & { fiber?: number };

export type MealType = 'desayuno' | 'media-manana' | 'comida' | 'merienda' | 'cena';

export const mealTypes: ReadonlyArray<{ id: MealType; label: string }> = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'media-manana', label: 'Media mañana' },
  { id: 'comida', label: 'Comida' },
  { id: 'merienda', label: 'Merienda' },
  { id: 'cena', label: 'Cena' },
];

export const mealLabel = (id: MealType | undefined) => mealTypes.find((meal) => meal.id === id)?.label ?? 'Comida';

export type NutritionKind = 'protein' | 'water' | 'meal';
export type EntrySource = 'manual' | 'database' | 'recipe' | 'text' | 'plan' | 'copy';

/** Entrada del diario. Es la misma estructura que usaba el registro rápido original. */
export type NutritionEntry = {
  id: string;
  timestamp: string;
  kind: NutritionKind;
  amount: number;
  description?: string;
  macros?: MacroTotals;
  foods?: string[];
  mealType?: MealType;
  grams?: number;
  fiber?: number;
  source?: EntrySource;
};

export type NutritionProfileData = {
  proteinGoalGrams: number;
  waterGoalMl: number;
  entriesByDay: Record<string, NutritionEntry[]>;
};

export type FoodItem = {
  id: string;
  name: string;
  unit: 'g' | 'ml';
  /** Valores por 100 g (o 100 ml). */
  per100: Macros;
  source: 'USDA' | 'usuario';
};

export type NutritionGoal = 'gain' | 'maintain' | 'lose';

export type Targets = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

export type RecipeIngredient = { name: string; grams: number; per100: Macros; foodId?: string };
export type Recipe = { id: string; name: string; servings: number; ingredients: RecipeIngredient[] };

export type SavedMealItem = { name: string; grams: number; macros: Macros };
export type SavedMeal = { id: string; name: string; mealType: MealType; items: SavedMealItem[] };

export type PlannedItem = { id: string; name: string; grams?: number; macros: Macros; recipeId?: string };
export type PlanDay = Record<MealType, PlannedItem[]>;

export type AdjustmentRecord = { date: string; summary: string; from: Targets; to: Targets };

/** Modos de objetivo de Nutrition Goals AI. Cada uno se asocia a un NutritionGoal para el resto del módulo. */
export type GoalMode = 'volume' | 'cut' | 'recomp' | 'maintain' | 'habits';
export type SafetyFlags = { eatingDisorder: boolean; pregnancy: boolean; condition: boolean; medication: boolean };
export type GoalPrefs = {
  experience: string;
  restrictions: string;
  allergies: string;
  mealTimes: string;
  flags: SafetyFlags;
};
export type WeeklyGoalStatus = 'pending' | 'progress' | 'done';
export type WeeklyGoal = {
  id: string;
  name: string;
  description: string;
  reason: string;
  /** Meta numérica (días, sesiones…). */
  target: number;
  /** Clave de la métrica calculada automáticamente; sin ella el usuario marca el avance a mano. */
  metric?: 'logged' | 'protein' | 'calories' | 'water' | 'fiber' | 'training';
  manualProgress: number;
  /** Marcado manual como completada (solo metas sin métrica automática). */
  manualDone: boolean;
};
export type GoalReviewRecord = { date: string; title: string; action: 'keep' | 'apply' | 'dismiss'; from?: Targets; to?: Targets };
export type GoalsState = {
  mode: GoalMode | null;
  prefs: GoalPrefs;
  weekStart: string | null;
  weekly: WeeklyGoal[];
  reviews: GoalReviewRecord[];
};

export type NutritionAIData = {
  version: 1;
  goal: NutritionGoal | null;
  targets: Targets | null;
  mealSplit: Record<MealType, number>;
  customFoods: FoodItem[];
  favoriteFoodIds: string[];
  usage: Record<string, number>;
  recipes: Recipe[];
  savedMeals: SavedMeal[];
  weekPlan: Record<number, PlanDay>;
  adjustments: AdjustmentRecord[];
  dismissed: Record<string, string>;
  goals: GoalsState;
};

export type ProgressPoint = { id: string; date: string; value: number };

export type RecommendationKind = 'adjustment' | 'warning' | 'tip' | 'info';

export type Recommendation = {
  id: string;
  kind: RecommendationKind;
  title: string;
  detail: string;
  /** Datos y razonamiento que justifican la recomendación. */
  rationale: string[];
  /** Propuesta de nuevos objetivos. Nunca se aplica sin confirmación del usuario. */
  proposal?: Targets;
};
