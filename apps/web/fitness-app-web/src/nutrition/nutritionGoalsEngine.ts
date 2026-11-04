import { activityFactor, addDaysToKey, caloriesFromMacros, clamp, lastDays, mifflinBmr, round0, dayTotals } from './calc';
import { analyzeIntake, analyzeWeight } from './engine';
import type { GoalMode, GoalPrefs, NutritionEntry, NutritionGoal, ProgressPoint, SafetyFlags, Targets, WeeklyGoal } from './types';

export const goalModes: Array<{ id: GoalMode; label: string; hint: string }> = [
  { id: 'volume', label: 'Volumen', hint: 'Ganar masa muscular con un superávit prudente.' },
  { id: 'cut', label: 'Definición', hint: 'Perder grasa con un déficit moderado.' },
  { id: 'recomp', label: 'Recomposición', hint: 'Energía cercana al mantenimiento y proteína alta.' },
  { id: 'maintain', label: 'Mantenimiento / rendimiento', hint: 'Sostener peso y apoyar el entrenamiento.' },
  { id: 'habits', label: 'Hábitos saludables', hint: 'Alimentación equilibrada sin foco en el peso.' },
];

export const modeToGoal: Record<GoalMode, NutritionGoal> = { volume: 'gain', cut: 'lose', recomp: 'maintain', maintain: 'maintain', habits: 'maintain' };

export const goalToMode = (goal: NutritionGoal): GoalMode => (goal === 'gain' ? 'volume' : goal === 'lose' ? 'cut' : 'maintain');

export const defaultFlags = (): SafetyFlags => ({ eatingDisorder: false, pregnancy: false, condition: false, medication: false });
export const defaultPrefs = (): GoalPrefs => ({ experience: '', restrictions: '', allergies: '', mealTimes: '', flags: defaultFlags() });

export type GoalsInput = {
  mode: GoalMode;
  sex: string;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  activityLevel: string;
  experience: string;
  /** Sesiones de entrenamiento por semana del plan. */
  sessionsPerWeek: number;
  flags: SafetyFlags;
  mealsPerDay: number;
};

export type DayTargets = { calories: number; protein: number; carbohydrates: number; fat: number };

export type GoalsResult = {
  status: 'ok' | 'missing-data' | 'blocked';
  missing: string[];
  /** Modo realmente aplicado (puede diferir del pedido si la seguridad lo restringe). */
  mode: GoalMode;
  warnings: string[];
  bmr: number;
  tdee: number;
  calorieAdjustmentPercent: number;
  targets: Targets;
  fiberGrams: number;
  waterMl: number;
  proteinPerKg: number;
  fatPercent: number;
  carbPercent: number;
  proteinPercent: number;
  proteinPerMeal: number;
  trainingDay: DayTargets;
  restDay: DayTargets;
  rationale: string[];
};

export const MIN_CALORIES = 1200;
const TRAINING_DAY_CARB_SHIFT_KCAL = 150;

const modeProfile: Record<GoalMode, { factor: number; protein: number; fatFloor: number }> = {
  volume: { factor: 1.08, protein: 1.8, fatFloor: 0.8 },
  cut: { factor: 0.85, protein: 2.0, fatFloor: 0.7 },
  recomp: { factor: 1.0, protein: 2.0, fatFloor: 0.8 },
  maintain: { factor: 1.0, protein: 1.6, fatFloor: 0.8 },
  habits: { factor: 1.0, protein: 1.4, fatFloor: 0.8 },
};

const emptyTargets = (): Targets => ({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
const emptyDay = (): DayTargets => emptyTargets();

export function computeGoals(input: GoalsInput): GoalsResult {
  const warnings: string[] = [];
  const rationale: string[] = [];
  const missing: string[] = [];
  if (!input.weightKg || input.weightKg < 20) missing.push('peso');
  if (!input.heightCm || input.heightCm < 100) missing.push('altura');
  if (!input.age || input.age < 10) missing.push('edad');
  if (input.sex !== 'Hombre' && input.sex !== 'Mujer') missing.push('sexo');

  const base: GoalsResult = {
    status: 'ok', missing, mode: input.mode, warnings, bmr: 0, tdee: 0, calorieAdjustmentPercent: 0, targets: emptyTargets(), fiberGrams: 0, waterMl: 0,
    proteinPerKg: 0, fatPercent: 0, carbPercent: 0, proteinPercent: 0, proteinPerMeal: 0, trainingDay: emptyDay(), restDay: emptyDay(), rationale,
  };

  const { flags } = input;
  if (flags.eatingDisorder || flags.pregnancy) {
    return { ...base, status: 'blocked', warnings: ['Con antecedentes de trastorno de la conducta alimentaria o embarazo/lactancia no se generan metas automáticas. Consulta con un médico o dietista-nutricionista.'] };
  }
  if (missing.length > 0) return { ...base, status: 'missing-data' };

  const weightKg = input.weightKg as number;
  const heightCm = input.heightCm as number;
  const age = input.age as number;
  const bmr = mifflinBmr({ sex: input.sex, weightKg, heightCm, age });
  const factor = activityFactor(input.activityLevel);
  const tdee = bmr * factor;
  rationale.push(`Metabolismo basal (Mifflin-St Jeor): ${round0(bmr)} kcal.`);
  rationale.push(`Gasto total estimado: ${round0(bmr)} × ${factor} (actividad) = ${round0(tdee)} kcal. Es una estimación, no una medición.`);
  if (!input.activityLevel) warnings.push('No has indicado tu nivel de actividad: se usa un factor ligero (1,375).');

  let mode = input.mode;
  const bmi = weightKg / (heightCm / 100) ** 2;
  if (age < 18) {
    warnings.push('Eres menor de edad: no se proponen déficits ni superávits calóricos. Consulta con un pediatra o dietista-nutricionista.');
    mode = 'maintain';
  } else if (mode === 'cut' && bmi < 18.5) {
    warnings.push('Tu IMC está por debajo de 18,5: no se propone déficit calórico. Consulta con un profesional sanitario.');
    mode = 'maintain';
  }
  if (flags.condition || flags.medication) {
    warnings.push('Has indicado una condición médica o medicación: estas metas son solo orientativas y deben validarse con tu médico o dietista-nutricionista antes de seguirlas.');
    if (mode === 'cut') mode = 'maintain';
  }

  const profile = modeProfile[mode];
  let factorApplied = profile.factor;
  if (mode === 'volume' && input.experience === 'Avanzado') factorApplied = 1.05;
  if (mode === 'volume' && input.experience === 'Principiante') factorApplied = 1.1;
  if (mode === 'cut' && input.experience === 'Principiante') factorApplied = 0.88;

  let calories = Math.round((tdee * factorApplied) / 10) * 10;
  const floor = Math.max(MIN_CALORIES, Math.round(bmr / 10) * 10);
  if (mode === 'cut' && calories < floor) {
    calories = floor;
    warnings.push(`El déficit se limitó a ${floor} kcal (tu metabolismo basal) para evitar una restricción excesiva.`);
  }
  const adjustment = ((calories - tdee) / tdee) * 100;
  rationale.push(
    mode === 'volume' ? `Superávit prudente de ${Math.abs(round0(adjustment))} %: ganar músculo requiere energía extra, pero un exceso grande solo añade grasa.`
      : mode === 'cut' ? `Déficit moderado de ${Math.abs(round0(adjustment))} %: permite perder grasa preservando masa muscular y rendimiento.`
        : mode === 'recomp' ? 'Energía cercana al mantenimiento: la recomposición se apoya en proteína alta y entrenamiento de fuerza, y es lenta.'
          : mode === 'maintain' ? 'Energía de mantenimiento para sostener el peso y el rendimiento.'
            : 'Energía de mantenimiento: el foco está en la calidad de la dieta y en la constancia.',
  );

  const protein = round0(weightKg * profile.protein);
  const fatByWeight = weightKg * profile.fatFloor;
  const fat = round0(Math.max(fatByWeight, (calories * 0.25) / 9));
  const carbohydrates = Math.max(0, round0((calories - protein * 4 - fat * 9) / 4));
  rationale.push(`Proteína ${profile.protein} g/kg (${protein} g): dentro de los rangos habituales para personas que entrenan fuerza (1,4–2,2 g/kg).`);
  rationale.push(`Grasas: el mayor entre ${profile.fatFloor} g/kg y el 25 % de las calorías (${fat} g), para cubrir funciones hormonales y vitaminas.`);
  rationale.push(`Carbohidratos: el resto de la energía (${carbohydrates} g), útiles para el rendimiento.`);

  const macroCalories = caloriesFromMacros(protein, carbohydrates, fat);
  const proteinPercent = macroCalories > 0 ? round0(((protein * 4) / macroCalories) * 100) : 0;
  const fatPercent = macroCalories > 0 ? round0(((fat * 9) / macroCalories) * 100) : 0;
  const carbPercent = macroCalories > 0 ? 100 - proteinPercent - fatPercent : 0;

  const fiberGrams = clamp(round0((calories / 1000) * 14), 25, 38);
  const waterMl = clamp(Math.round((weightKg * 32) / 250) * 250, 1500, 3500);

  const sessions = clamp(input.sessionsPerWeek, 0, 7);
  const restDays = 7 - sessions;
  // Se desplaza energía en forma de carbohidratos entre días; la media semanal se mantiene en el objetivo.
  const shift = sessions > 0 && restDays > 0 ? TRAINING_DAY_CARB_SHIFT_KCAL : 0;
  const trainingExtra = shift;
  const restLess = restDays > 0 ? (shift * sessions) / restDays : 0;
  const trainingDay: DayTargets = withCalories({ calories, protein, carbohydrates, fat }, calories + trainingExtra);
  const restDay: DayTargets = withCalories({ calories, protein, carbohydrates, fat }, calories - restLess);
  if (shift > 0) rationale.push(`Días de entrenamiento: +${trainingExtra} kcal en carbohidratos; descanso: −${round0(restLess)} kcal. La media semanal no cambia.`);

  const meals = clamp(Math.round(input.mealsPerDay) || 4, 2, 6);
  const proteinPerMeal = round0(protein / meals);
  if (proteinPerMeal / weightKg < 0.2) warnings.push('Repartir la proteína en tantas comidas deja porciones pequeñas; puedes agrupar algunas.');

  return {
    status: 'ok', missing, mode, warnings, bmr: round0(bmr), tdee: round0(tdee), calorieAdjustmentPercent: Math.round(adjustment * 10) / 10,
    targets: { calories, protein, carbohydrates, fat }, fiberGrams, waterMl, proteinPerKg: profile.protein,
    fatPercent, carbPercent, proteinPercent, proteinPerMeal, trainingDay, restDay, rationale,
  };
}

function withCalories(day: DayTargets, calories: number): DayTargets {
  const target = Math.round(calories / 10) * 10;
  const carbohydrates = Math.max(0, round0((target - day.protein * 4 - day.fat * 9) / 4));
  return { calories: target, protein: day.protein, fat: day.fat, carbohydrates };
}

/* Metas semanales */
export type WeekProgress = { value: number; target: number; auto: boolean; done: boolean; state: 'pending' | 'progress' | 'done' };

export function weeklyGoalTemplates(input: { mode: GoalMode; sessionsPerWeek: number; hasFiber: boolean }): WeeklyGoal[] {
  const goal = (id: string, name: string, description: string, reason: string, target: number, metric?: WeeklyGoal['metric']): WeeklyGoal => ({ id, name, description, reason, target, metric, manualProgress: 0, manualDone: false });
  const list: WeeklyGoal[] = [
    goal('logged', 'Registrar tu alimentación', 'Anota tus comidas al menos 5 días esta semana.', 'Sin registros no se pueden valorar tendencias ni ajustar objetivos con fiabilidad.', 5, 'logged'),
    goal('protein', 'Alcanzar la proteína', 'Llega al menos al 90 % de tu objetivo de proteína 5 días.', 'La proteína suficiente apoya la recuperación y la ganancia o conservación de masa muscular.', 5, 'protein'),
  ];
  if (input.mode !== 'habits') {
    list.push(goal('calories', 'Ajustarte a tus calorías', 'Mantente dentro de ±10 % de tu objetivo calórico 5 días.', 'La constancia energética permite que el peso responda de forma interpretable.', 5, 'calories'));
  }
  list.push(goal('water', 'Hidratarte', 'Alcanza tu objetivo de agua orientativo 5 días.', 'Una hidratación adecuada favorece el rendimiento; el objetivo es orientativo.', 5, 'water'));
  if (input.hasFiber) list.push(goal('fiber', 'Fibra suficiente', 'Alcanza tu objetivo de fibra 4 días.', 'La fibra mejora la saciedad y la salud digestiva.', 4, 'fiber'));
  if (input.sessionsPerWeek > 0) list.push(goal('training', 'Completar tus entrenamientos', `Completa ${input.sessionsPerWeek} sesiones planificadas.`, 'La nutrición solo rinde si acompaña un estímulo de entrenamiento constante.', input.sessionsPerWeek, 'training'));
  list.push(goal('fruitveg', 'Frutas y verduras', 'Incluye al menos 400 g de frutas y verduras al día, marcando los días cumplidos.', 'Aportan micronutrientes y fibra. Este dato no se mide automáticamente.', 5));
  list.push(goal('sleep', 'Dormir bien', 'Duerme 7 h o más durante 5 noches, marcando las noches cumplidas.', 'El descanso influye en la recuperación y el apetito. Este dato no se mide automáticamente.', 5));
  return list;
}

export type WeekData = {
  weekStart: string;
  today: string;
  entriesByDay: Record<string, NutritionEntry[]>;
  targets: Targets;
  fiberGrams: number;
  waterGoalMl: number;
  trainedDates: string[];
};

export function weeklyProgress(goal: WeeklyGoal, data: WeekData): WeekProgress {
  const days = lastDays(addDaysToKey(data.weekStart, 6), 7).filter((day) => day <= data.today);
  let value = goal.manualProgress;
  let auto = false;
  const totals = days.map((day) => dayTotals(data.entriesByDay[day]));
  if (goal.metric) {
    auto = true;
    if (goal.metric === 'logged') value = totals.filter((item) => item.macros.calories > 0).length;
    if (goal.metric === 'protein') value = totals.filter((item) => item.macros.protein >= data.targets.protein * 0.9).length;
    if (goal.metric === 'calories') value = totals.filter((item) => item.macros.calories > 0 && Math.abs(item.macros.calories - data.targets.calories) <= data.targets.calories * 0.1).length;
    if (goal.metric === 'water') value = totals.filter((item) => item.waterMl >= data.waterGoalMl).length;
    if (goal.metric === 'fiber') value = totals.filter((item) => (item.macros.fiber ?? 0) >= data.fiberGrams).length;
    if (goal.metric === 'training') value = data.trainedDates.filter((date) => date >= data.weekStart && date <= addDaysToKey(data.weekStart, 6)).length;
  }
  const done = auto ? value >= goal.target : goal.manualDone || value >= goal.target;
  return { value, target: goal.target, auto, done, state: done ? 'done' : value > 0 ? 'progress' : 'pending' };
}

/* Revisión periódica */
export type GoalReview = {
  id: string;
  action: 'keep' | 'increase' | 'decrease' | 'protein' | 'wait';
  title: string;
  detail: string;
  rationale: string[];
  proposal?: Targets;
};

export const REVIEW_COOLDOWN_DAYS = 14;
export const REVIEW_MIN_LOGGED_DAYS = 10;

const weeklyRate: Record<GoalMode, [number, number]> = {
  volume: [0.1, 0.5],
  cut: [-1, -0.4],
  recomp: [-0.25, 0.25],
  maintain: [-0.25, 0.25],
  habits: [-0.5, 0.5],
};

export function reviewGoals(input: { mode: GoalMode; today: string; targets: Targets; bodyWeight: ProgressPoint[]; entriesByDay: Record<string, NutritionEntry[]>; lastChangeDate?: string; blocked: boolean; minCalories?: number }): GoalReview {
  const { mode, today, targets } = input;
  if (input.blocked) {
    return { id: 'review-blocked', action: 'wait', title: 'Revisión no disponible', detail: 'Con tu perfil de seguridad no se proponen ajustes automáticos. Consulta con un profesional sanitario.', rationale: [] };
  }
  const weight = analyzeWeight(input.bodyWeight, today);
  const intake = analyzeIntake(input.entriesByDay, today);
  const rationale: string[] = [];
  if (input.lastChangeDate && input.lastChangeDate > addDaysToKey(today, -REVIEW_COOLDOWN_DAYS)) {
    return { id: 'review-cooldown', action: 'wait', title: 'Cambio reciente', detail: `Cambiaste tus metas hace menos de ${REVIEW_COOLDOWN_DAYS} días: espera a ver su efecto antes de otra revisión.`, rationale: [] };
  }
  if (weight.status !== 'ok' || intake.loggedDays < REVIEW_MIN_LOGGED_DAYS) {
    return {
      id: 'review-data',
      action: 'wait',
      title: 'Aún no hay datos suficientes',
      detail: 'Para decidir hace falta una tendencia de varias semanas: al menos 4 pesajes en 10 días y 10 días de comidas registradas en las últimas 2 semanas.',
      rationale: [`Pesajes (28 días): ${weight.points}.`, `Días con comidas (14 días): ${intake.loggedDays}.`],
    };
  }
  rationale.push(`Tendencia de peso: ${weight.weeklyChangeKg >= 0 ? '+' : ''}${Math.round(weight.weeklyChangeKg * 100) / 100} kg/sem (${Math.round(weight.weeklyChangePercent * 100) / 100} % del peso).`);
  rationale.push(`Ingesta media: ${round0(intake.avgCalories)} kcal frente a un objetivo de ${round0(targets.calories)} (${intake.loggedDays} días).`);
  const adherence = Math.abs(intake.avgCalories - targets.calories) / targets.calories;
  if (adherence > 0.15) {
    return { id: 'review-adherence', action: 'keep', title: 'Primero, ajústate al objetivo actual', detail: 'Tu ingesta real se aleja más del 15 % del objetivo; cambiar el objetivo no sería informativo. Mantén las metas y revisa tu adherencia.', rationale };
  }
  const [min, max] = weeklyRate[mode];
  const percent = weight.weeklyChangePercent;
  const step = clamp(Math.round((targets.calories * 0.05) / 50) * 50, 100, 250);
  const floor = input.minCalories ?? MIN_CALORIES;
  const make = (action: GoalReview['action'], title: string, detail: string, delta: number): GoalReview => {
    const calories = Math.max(floor, targets.calories + delta);
    const carbohydrates = Math.max(0, round0((calories - targets.protein * 4 - targets.fat * 9) / 4));
    return { id: `review-${action}`, action, title, detail, rationale, proposal: { ...targets, calories, carbohydrates } };
  };
  if (percent < min - 0.05) {
    if (mode === 'cut') return make('increase', 'Pierdes peso demasiado rápido', 'Un ritmo mayor del 1 % semanal puede perjudicar el rendimiento y la masa muscular. Se propone subir algo la energía.', step);
    return make('increase', 'El peso baja por debajo de lo previsto', 'Tu tendencia es inferior al rango de tu objetivo. Se propone un pequeño aumento de energía.', step);
  }
  if (percent > max + 0.05) {
    if (mode === 'volume') return make('decrease', 'Ganas peso más rápido de lo necesario', 'Un ritmo mayor al 0,5 % semanal suele añadir grasa. Se propone reducir ligeramente la energía.', -step);
    return make('decrease', 'El peso sube por encima de lo previsto', 'Tu tendencia supera el rango de tu objetivo. Se propone un pequeño ajuste a la baja.', -step);
  }
  if (mode === 'cut' && percent > -0.4 + 0.05 && percent <= 0.05) {
    return make('decrease', 'La pérdida de peso se ha estancado', 'Con buena adherencia el peso no baja. Se propone un recorte pequeño; valora también esperar otras 2 semanas.', -step);
  }
  if (intake.avgProtein < targets.protein * 0.85) {
    return { id: 'review-protein', action: 'protein', title: 'Refuerza la proteína', detail: 'Tu peso evoluciona como se espera, pero la proteína media queda por debajo del 85 % del objetivo. No hace falta cambiar las calorías.', rationale: [...rationale, `Proteína media: ${round0(intake.avgProtein)} g de ${round0(targets.protein)} g.`] };
  }
  return { id: 'review-keep', action: 'keep', title: 'Mantén tus metas', detail: 'Tu evolución encaja con el objetivo. No se recomienda cambiar nada ahora.', rationale };
}
