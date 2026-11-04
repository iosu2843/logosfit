import type { PlanLike, WorkoutLog } from '../workoutLog';
import type { NutritionEntry } from '../nutrition/types';

export type LeagueMuscle = 'Pecho' | 'Espalda' | 'Piernas' | 'Hombros' | 'Bíceps' | 'Tríceps' | 'Abdomen';
export const leagueMuscles: LeagueMuscle[] = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Abdomen'];

export type Tier = 'bronce' | 'plata' | 'oro' | 'platino' | 'legendario';
export const tierLabels: Record<Tier, string> = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino', legendario: 'Legendario' };

export type Category = 'fuerza' | 'disciplina' | 'sabiduria' | 'nutricion' | 'resistencia' | 'exploracion' | 'iron' | 'propios';
export const categoryInfo: Record<Category, { label: string; greek: string; icon: string }> = {
  fuerza: { label: 'Fuerza', greek: 'Areté', icon: '🏛️' },
  disciplina: { label: 'Disciplina', greek: 'Estoicismo', icon: '⚖️' },
  sabiduria: { label: 'Sabiduría', greek: 'Sophia', icon: '🦉' },
  nutricion: { label: 'Nutrición', greek: 'Eudaimonía', icon: '🍇' },
  resistencia: { label: 'Resistencia', greek: 'Stoa', icon: '🏺' },
  exploracion: { label: 'Exploración', greek: 'Polymathia', icon: '🧭' },
  iron: { label: 'Iron Milestones', greek: 'Hierro', icon: '🛡️' },
  propios: { label: 'Hitos propios', greek: 'Idios', icon: '✍️' },
};

/** Serie validada. `review` indica una marca anómala pendiente de revisión: cuenta en el modo personal, no en la competición. */
export type ValidSet = { date: string; exercise: string; group: string; weight: number; reps: number; review: boolean };

export type CustomMilestone = { id: string; exercise: string; metric: 'weight' | 'reps' | 'seconds'; target: number; minReps: number };

export type Visibility = 'private' | 'friends' | 'public';

export type GamState = {
  version: 1;
  initialized: boolean;
  visits: string[];
  charts: string[];
  reviews: string[];
  reportViews: string[];
  routineEdits: string[];
  firstSeen: Record<string, string>;
  seen: string[];
  showcase: string[];
  visibility: Visibility;
  hideRankings: boolean;
  country: string;
  sound: boolean;
  custom: CustomMilestone[];
};

export type GamCtx = {
  today: string;
  workoutLog: WorkoutLog;
  plan: PlanLike;
  bodyWeight: Array<{ date: string; value: number }>;
  entriesByDay: Record<string, NutritionEntry[]>;
  nutrition: { recipes: number; proteinGoal: number; calorieTarget: number | null };
  profile: { name: string; complete: boolean; weightKg: number | null };
  state: GamState;
};

export type Progress = { current: number; target: number };

export type AchievementStatus = 'locked' | 'progress' | 'unlocked';

export type Achievement = {
  id: string;
  name: string;
  philosopher: string;
  description: string;
  category: Category;
  tier: Tier;
  xp: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  secret?: boolean;
  seasonal?: boolean;
  muscle?: LeagueMuscle;
  /** El progreso no depende de datos fechados: la fecha de desbloqueo es la primera vez que se detecta. */
  undated?: boolean;
  meta?: boolean;
  platinumOf?: Category;
  progress: (metrics: Metrics) => Progress;
};

export type AchievementState = {
  def: Achievement;
  status: AchievementStatus;
  progress: Progress;
  unlockedAt: string | null;
};

export type Metrics = {
  asOf: string;
  sets: ValidSet[];
  setsByExercise: Record<string, ValidSet[]>;
  trainedDates: string[];
  sessions: number;
  setSessions: number;
  totalVolume: number;
  maxSessionVolume: number;
  maxExerciseVolume: number;
  prExercises: number;
  prByMuscle: Record<LeagueMuscle, number>;
  progressiveExercises: number;
  maxWeeklySessions: number;
  bestAdherenceStreak: number;
  distinctTrainingDays: number;
  activeWeeksIn52: number;
  activeWeeks: number;
  bodyWeightRun: number;
  chartViews: number;
  reviews: number;
  reportViews: number;
  routineEdits: number;
  visits: number;
  dawnWorkout: boolean;
  cardioSessions: number;
  cardioWeekRun: number;
  mealsLogged: number;
  nutritionDays: number;
  proteinWeek: number;
  fullMealWeeks: number;
  balancedWeeks: number;
  nutritionWeeks: number;
  harmonyRun: number;
  recipes: number;
  profileComplete: boolean;
  unlockedOthers: number;
};

