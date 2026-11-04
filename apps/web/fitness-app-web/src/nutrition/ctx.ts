import type { NutritionAIData, NutritionEntry, NutritionGoal, ProgressPoint, Targets } from './types';
import type { MetricsLike, TrainingDayLike } from './training';

export type NutritionProfileInfo = {
  name: string;
  sex: string;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  goalText: string;
  activityLevel: string;
  experience: string;
};

export type NutritionCtx = {
  today: string;
  profile: NutritionProfileInfo;
  entriesByDay: Record<string, NutritionEntry[]>;
  waterGoalMl: number;
  ai: NutritionAIData;
  updateAI: (change: (current: NutritionAIData) => NutritionAIData) => void;
  goal: NutritionGoal;
  targets: Targets;
  /** Verdadero si los objetivos aún no se han confirmado y proceden de una estimación o de valores genéricos. */
  provisional: boolean;
  bmr: number | null;
  addEntries: (date: string, entries: NutritionEntry[]) => void;
  removeEntry: (date: string, id: string) => void;
  setTargets: (targets: Targets) => void;
  plan: Record<number, TrainingDayLike | undefined>;
  metrics: MetricsLike;
  bodyWeight: ProgressPoint[];
  exerciseLoads: Record<string, ProgressPoint[]>;
  /** Fechas (YYYY-MM-DD) con sesión de entrenamiento completada. */
  trainedDates: string[];
  setWaterGoal: (ml: number) => void;
};
