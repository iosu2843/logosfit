import { addDaysToKey, average, clamp, daysBetween, entriesByMeal, dayTotals, lastDays, linearTrend, round0, round1, withCarbsForCalories } from './calc';
import type { DayTrainingInfo, PerformanceSummary, TrainingSummary } from './training';
import type { NutritionEntry, NutritionGoal, ProgressPoint, Recommendation, Targets } from './types';
import { mealTypes } from './types';

export type EngineInput = {
  today: string;
  profile: { sex: string; age: number | null; heightCm: number | null; weightKg: number | null };
  goal: NutritionGoal;
  targets: Targets;
  bmr: number | null;
  bodyWeight: ProgressPoint[];
  entriesByDay: Record<string, NutritionEntry[]>;
  training: TrainingSummary;
  todayTraining: DayTrainingInfo;
  performance: PerformanceSummary | null;
  waterGoalMl: number;
  lastAdjustmentDate?: string;
};

/** Variación semanal de peso aceptable como porcentaje del peso corporal. */
export const weeklyRateRange: Record<NutritionGoal, [number, number]> = {
  gain: [0.1, 0.5],
  maintain: [-0.25, 0.25],
  lose: [-1, -0.4],
};

export const WINDOW_WEIGHT_DAYS = 28;
export const WINDOW_INTAKE_DAYS = 14;
export const MIN_WEIGHT_POINTS = 4;
export const MIN_WEIGHT_SPAN_DAYS = 10;
export const MIN_LOGGED_DAYS_FOR_ADJUSTMENT = 10;
export const ADJUSTMENT_COOLDOWN_DAYS = 14;

export type WeightAnalysis = {
  status: 'insufficient' | 'ok';
  points: number;
  spanDays: number;
  weeklyChangeKg: number;
  weeklyChangePercent: number;
  meanWeight: number;
};

export function analyzeWeight(bodyWeight: ProgressPoint[], today: string): WeightAnalysis {
  const start = addDaysToKey(today, -WINDOW_WEIGHT_DAYS);
  const recent = bodyWeight.filter((point) => point.date >= start && point.date <= today && point.value > 0);
  const trend = linearTrend(recent);
  const meanWeight = average(recent.map((point) => point.value));
  if (!trend || recent.length < MIN_WEIGHT_POINTS || trend.spanDays < MIN_WEIGHT_SPAN_DAYS) {
    return { status: 'insufficient', points: recent.length, spanDays: trend?.spanDays ?? 0, weeklyChangeKg: 0, weeklyChangePercent: 0, meanWeight };
  }
  return {
    status: 'ok',
    points: recent.length,
    spanDays: trend.spanDays,
    weeklyChangeKg: trend.slopePerWeek,
    weeklyChangePercent: (trend.slopePerWeek / meanWeight) * 100,
    meanWeight,
  };
}

export type IntakeAnalysis = {
  loggedDays: number;
  windowDays: number;
  avgCalories: number;
  avgProtein: number;
  avgCarbohydrates: number;
  avgFat: number;
  avgWaterMl: number;
  waterDays: number;
  avgMealSlots: number;
  topSlotProteinShare: number;
};

export function analyzeIntake(entriesByDay: Record<string, NutritionEntry[]>, today: string, windowDays = WINDOW_INTAKE_DAYS): IntakeAnalysis {
  // El día de hoy se excluye: normalmente está incompleto y falsearía las medias.
  const days = lastDays(addDaysToKey(today, -1), windowDays);
  const logged = days.map((day) => ({ day, totals: dayTotals(entriesByDay[day]), entries: entriesByDay[day] })).filter((item) => item.totals.macros.calories > 0);
  const waterDays = days.map((day) => dayTotals(entriesByDay[day]).waterMl).filter((ml) => ml > 0);
  const slotCounts: number[] = [];
  const topShares: number[] = [];
  for (const item of logged) {
    const grouped = entriesByMeal(item.entries);
    const slots = mealTypes.map((meal) => grouped[meal.id].reduce((sum, entry) => sum + (entry.macros?.protein ?? 0), 0));
    slotCounts.push(mealTypes.filter((meal) => grouped[meal.id].length > 0).length);
    const totalProtein = slots.reduce((a, b) => a + b, 0);
    if (totalProtein > 0) topShares.push(Math.max(...slots) / totalProtein);
  }
  return {
    loggedDays: logged.length,
    windowDays,
    avgCalories: average(logged.map((item) => item.totals.macros.calories)),
    avgProtein: average(logged.map((item) => item.totals.macros.protein)),
    avgCarbohydrates: average(logged.map((item) => item.totals.macros.carbohydrates)),
    avgFat: average(logged.map((item) => item.totals.macros.fat)),
    avgWaterMl: average(waterDays),
    waterDays: waterDays.length,
    avgMealSlots: average(slotCounts),
    topSlotProteinShare: average(topShares),
  };
}

const calorieStep = (calories: number) => clamp(Math.round((calories * 0.05) / 50) * 50, 100, 250);

export function generateRecommendations(input: EngineInput): Recommendation[] {
  const { today, profile, goal, targets, training, todayTraining, performance } = input;
  const recommendations: Recommendation[] = [];
  const weightAnalysis = analyzeWeight(input.bodyWeight, today);
  const intake = analyzeIntake(input.entriesByDay, today);
  const weightKg = profile.weightKg ?? (weightAnalysis.meanWeight || null);
  const isMinor = profile.age !== null && profile.age < 18;
  const [rateMin, rateMax] = weeklyRateRange[goal];

  if (isMinor) {
    recommendations.push({
      id: 'minor',
      kind: 'warning',
      title: 'Perfil menor de edad',
      detail: 'No se proponen déficits calóricos ni cambios automáticos de objetivos. Consulta con un pediatra o dietista-nutricionista.',
      rationale: [`Edad indicada: ${profile.age} años.`],
    });
  }

  /* 1. Objetivo calórico a partir de la tendencia de peso */
  const daysSinceAdjustment = input.lastAdjustmentDate ? daysBetween(input.lastAdjustmentDate, today) : null;
  if (weightAnalysis.status === 'insufficient') {
    recommendations.push({
      id: 'weight-data',
      kind: 'info',
      title: 'Faltan datos de peso para ajustar calorías',
      detail: `Necesito al menos ${MIN_WEIGHT_POINTS} pesajes repartidos en ${MIN_WEIGHT_SPAN_DAYS} días o más. Pésate 3-4 veces por semana, a la misma hora, y se calculará la tendencia.`,
      rationale: [`Pesajes en las últimas ${WINDOW_WEIGHT_DAYS} jornadas: ${weightAnalysis.points}.`, 'Un solo pesaje o una fluctuación de un día (agua, sodio, digestión) no es una tendencia.'],
    });
  } else {
    const rate = weightAnalysis.weeklyChangePercent;
    const rateText = `${weightAnalysis.weeklyChangeKg >= 0 ? '+' : ''}${weightAnalysis.weeklyChangeKg.toFixed(2)} kg/semana (${rate >= 0 ? '+' : ''}${rate.toFixed(2)} % del peso)`;
    const rationaleBase = [
      `Tendencia calculada con ${weightAnalysis.points} pesajes en ${weightAnalysis.spanDays} días: ${rateText}.`,
      `Rango razonable para tu objetivo: ${rateMin} % a ${rateMax} % por semana.`,
    ];
    const outOfRange = rate < rateMin || rate > rateMax;
    const caloriesAdherent = intake.loggedDays >= MIN_LOGGED_DAYS_FOR_ADJUSTMENT && Math.abs(intake.avgCalories - targets.calories) <= targets.calories * 0.1;

    if (!outOfRange) {
      recommendations.push({
        id: 'trend-ok',
        kind: 'info',
        title: 'Tu evolución de peso encaja con el objetivo',
        detail: 'No hace falta cambiar las calorías. Mantén el plan y sigue registrando.',
        rationale: rationaleBase,
      });
    } else if (isMinor) {
      // Sin propuestas para menores de edad.
    } else if (daysSinceAdjustment !== null && daysSinceAdjustment < ADJUSTMENT_COOLDOWN_DAYS) {
      recommendations.push({
        id: 'cooldown',
        kind: 'info',
        title: 'Espera a ver el efecto del último ajuste',
        detail: `Cambiaste el objetivo hace ${daysSinceAdjustment} días. Los cambios de peso tardan 2-3 semanas en reflejarse con claridad.`,
        rationale: rationaleBase,
      });
    } else if (intake.loggedDays < MIN_LOGGED_DAYS_FOR_ADJUSTMENT) {
      recommendations.push({
        id: 'log-more',
        kind: 'tip',
        title: 'Registra más días antes de cambiar calorías',
        detail: 'Tu peso se sale del rango, pero no sé cuánto estás comiendo realmente. Registra al menos 10 de los últimos 14 días para poder proponer un ajuste fiable.',
        rationale: [...rationaleBase, `Días con registro (últimos ${intake.windowDays}): ${intake.loggedDays}.`],
      });
    } else if (!caloriesAdherent) {
      recommendations.push({
        id: 'adherence',
        kind: 'tip',
        title: 'Primero acércate al objetivo actual',
        detail: `Tu media registrada (${round0(intake.avgCalories)} kcal) se aleja más de un 10 % del objetivo (${targets.calories} kcal). Cambiar el objetivo no ayudaría hasta que lo cumplas con regularidad.`,
        rationale: [...rationaleBase, `Media de ${intake.loggedDays} días registrados: ${round0(intake.avgCalories)} kcal.`],
      });
    } else {
      const wantsMore = rate < rateMin;
      const step = calorieStep(targets.calories);
      const floor = Math.max(input.bmr ?? 1500, 1200);
      const proposedCalories = wantsMore ? targets.calories + step : Math.max(targets.calories - step, floor);
      if (proposedCalories !== targets.calories) {
        const direction = wantsMore ? 'subir' : 'bajar';
        recommendations.push({
          id: 'calorie-adjust',
          kind: 'adjustment',
          title: `Propuesta: ${direction} ${Math.abs(proposedCalories - targets.calories)} kcal al día`,
          detail: `Cumples el objetivo calórico, pero el peso evoluciona ${wantsMore ? 'más despacio' : 'más deprisa'} de lo previsto. El cambio es pequeño a propósito; reevalúa en 2-3 semanas.`,
          rationale: [
            ...rationaleBase,
            `Adherencia: media de ${round0(intake.avgCalories)} kcal en ${intake.loggedDays} días registrados.`,
            'Proteína y grasas se mantienen; la variación se aplica a los carbohidratos.',
            ...(goal === 'lose' && rate < rateMin ? ['Una pérdida demasiado rápida aumenta el riesgo de perder masa muscular.'] : []),
          ],
          proposal: withCarbsForCalories({ ...targets, calories: proposedCalories }),
        });
      }
    }
  }

  /* 2. Proteína */
  if (weightKg) {
    const perKg = targets.protein / weightKg;
    if (perKg < 1.6) {
      const protein = round0(weightKg * (goal === 'lose' ? 2 : 1.8));
      recommendations.push({
        id: 'protein-target',
        kind: 'adjustment',
        title: `Propuesta: subir la proteína a ${protein} g`,
        detail: 'Para ganar o conservar masa muscular con entrenamiento de fuerza, la evidencia sitúa la ingesta útil entre 1,6 y 2,2 g por kg de peso.',
        rationale: [`Objetivo actual: ${targets.protein} g (${perKg.toFixed(2)} g/kg).`, `Peso de referencia: ${round1(weightKg)} kg.`],
        proposal: withCarbsForCalories({ ...targets, protein }),
      });
    } else if (perKg > 2.5) {
      recommendations.push({
        id: 'protein-high',
        kind: 'info',
        title: 'Objetivo de proteína por encima de lo necesario',
        detail: 'Por encima de ~2,2 g/kg no hay beneficio adicional demostrado para la hipertrofia. Puedes destinar esas calorías a carbohidratos o grasas.',
        rationale: [`Objetivo actual: ${targets.protein} g (${perKg.toFixed(2)} g/kg).`],
      });
    }
    if (intake.loggedDays >= 4 && intake.avgProtein < targets.protein * 0.85) {
      recommendations.push({
        id: 'protein-intake',
        kind: 'tip',
        title: 'Estás por debajo de tu objetivo de proteína',
        detail: `Tu media es ${round0(intake.avgProtein)} g/día frente a ${targets.protein} g. Añade una fuente de proteína en cada toma (huevos, lácteos, legumbres, carne o pescado, tofu).`,
        rationale: [`Media de ${intake.loggedDays} días registrados: ${(intake.avgProtein / weightKg).toFixed(2)} g/kg.`],
      });
    }

    /* 3. Distribución de macros */
    const fatPerKg = targets.fat / weightKg;
    const fatShare = ((targets.fat * 9) / Math.max(1, targets.calories)) * 100;
    if (fatPerKg < 0.6 || fatShare < 20) {
      const fat = round0(Math.max(weightKg * 0.8, (targets.calories * 0.25) / 9));
      recommendations.push({
        id: 'fat-target',
        kind: 'adjustment',
        title: `Propuesta: subir las grasas a ${fat} g`,
        detail: 'Un mínimo de grasa (≈0,6-1 g/kg, 20-35 % de las calorías) favorece la salud hormonal y la absorción de vitaminas liposolubles.',
        rationale: [`Objetivo actual: ${targets.fat} g (${fatPerKg.toFixed(2)} g/kg, ${round0(fatShare)} % de las calorías).`],
        proposal: withCarbsForCalories({ ...targets, fat }),
      });
    }
    if (targets.carbohydrates / weightKg < 2.5 && training.sessionsPerWeek >= 3) {
      recommendations.push({
        id: 'carbs-low',
        kind: 'tip',
        title: 'Carbohidratos algo bajos para tu frecuencia de entrenamiento',
        detail: 'Con 3 o más sesiones semanales suele rendirse mejor con 3-5 g/kg de carbohidratos, salvo que estés en una fase de déficit deliberada.',
        rationale: [`Carbohidratos actuales: ${round1(targets.carbohydrates / weightKg)} g/kg.`, `Sesiones planificadas: ${training.sessionsPerWeek}/semana.`],
      });
    }

    /* 4. Distribución de comidas */
    const perMealMin = round0(weightKg * 0.3);
    const perMealMax = round0(weightKg * 0.4);
    if (intake.loggedDays >= 4 && (intake.avgMealSlots < 3 || intake.topSlotProteinShare > 0.5)) {
      recommendations.push({
        id: 'meal-distribution',
        kind: 'tip',
        title: 'Reparte mejor la proteína a lo largo del día',
        detail: `Procura 3-5 tomas con unos ${perMealMin}-${perMealMax} g de proteína cada una (0,3-0,4 g/kg). Concentrarla en una sola comida aprovecha peor el estímulo de síntesis proteica.`,
        rationale: [
          `Tomas con registro por día: ${intake.avgMealSlots.toFixed(1)}.`,
          `La toma con más proteína concentra de media el ${round0(intake.topSlotProteinShare * 100)} % del total.`,
        ],
      });
    }

    /* 5. Alrededor del entrenamiento */
    if (todayTraining.isTraining) {
      recommendations.push({
        id: 'training-day',
        kind: 'tip',
        title: `Hoy entrenas${todayTraining.type ? ` (${todayTraining.type})` : ''}: alimentación alrededor de la sesión`,
        detail: `Una comida con carbohidratos y proteína 1-3 h antes, y ${perMealMin}-${perMealMax} g de proteína en las horas posteriores. Bebe agua durante la sesión. El tipo de día no cambia por sí solo tus necesidades de calorías.`,
        rationale: ['Plan de hoy según tu calendario.', 'La ventana post-entreno es amplia: lo importante es el total diario de proteína y energía.'],
      });
    } else {
      recommendations.push({
        id: 'rest-day',
        kind: 'info',
        title: 'Día de descanso',
        detail: 'Mantén la proteína en tu objetivo: la recuperación y el crecimiento muscular ocurren también en los días sin entrenar. No hace falta recortar calorías de forma drástica.',
        rationale: ['Según tu calendario no hay entrenamiento hoy.'],
      });
    }

    /* 6. Recuperación */
    if (training.setsPerWeek >= 10 && intake.loggedDays >= 4 && intake.avgProtein / weightKg < 1.6) {
      recommendations.push({
        id: 'recovery-protein',
        kind: 'tip',
        title: 'Recuperación: tu proteína es baja para tu volumen de entrenamiento',
        detail: 'Con tu volumen semanal, una ingesta por debajo de 1,6 g/kg puede limitar la recuperación y la ganancia de masa muscular.',
        rationale: [`Series semanales planificadas: ${training.setsPerWeek}.`, `Proteína media registrada: ${(intake.avgProtein / weightKg).toFixed(2)} g/kg.`],
      });
    }
    if (goal === 'lose' && weightAnalysis.status === 'ok' && weightAnalysis.weeklyChangePercent < -1 && training.setsPerWeek >= 10) {
      recommendations.push({
        id: 'recovery-deficit',
        kind: 'warning',
        title: 'Déficit agresivo con volumen de entrenamiento alto',
        detail: 'Perder más del 1 % del peso por semana mientras entrenas mucho compromete la recuperación y el rendimiento. Valora reducir el déficit.',
        rationale: [`Ritmo: ${weightAnalysis.weeklyChangePercent.toFixed(2)} % por semana.`, `Series semanales: ${training.setsPerWeek}.`],
      });
    }
  } else {
    recommendations.push({
      id: 'weight-missing',
      kind: 'info',
      title: 'Añade tu peso para personalizar la proteína y las grasas',
      detail: 'Registra tu peso corporal en Progreso o en tu perfil. Sin él solo puedo mostrar valores absolutos.',
      rationale: [],
    });
  }

  /* 7. Hidratación */
  if (intake.waterDays >= 4 && input.waterGoalMl > 0 && intake.avgWaterMl < input.waterGoalMl * 0.7) {
    recommendations.push({
      id: 'hydration',
      kind: 'tip',
      title: 'Hidratación por debajo del objetivo',
      detail: 'Una hidratación insuficiente afecta al rendimiento y a la recuperación. Reparte el agua a lo largo del día.',
      rationale: [`Media registrada: ${round0(intake.avgWaterMl)} ml frente a ${input.waterGoalMl} ml.`],
    });
  }

  /* 8. Peso y rendimiento */
  if (performance && weightAnalysis.status === 'ok') {
    const change = performance.averageChangePercent;
    const rate = weightAnalysis.weeklyChangePercent;
    const common = [`Carga media registrada: ${change >= 0 ? '+' : ''}${change.toFixed(1)} % en ${performance.exercisesTracked} ejercicio(s).`, `Peso: ${rate >= 0 ? '+' : ''}${rate.toFixed(2)} % por semana.`];
    if (goal === 'lose' && change < -5) {
      recommendations.push({
        id: 'performance-cut',
        kind: 'tip',
        title: 'Tus cargas bajan durante la definición',
        detail: 'Una caída sostenida del rendimiento puede indicar déficit excesivo, poco descanso o poca proteína. Revisa el ritmo de pérdida y la recuperación.',
        rationale: common,
      });
    } else if (goal === 'gain' && change < 0 && rate > rateMin) {
      recommendations.push({
        id: 'performance-gain',
        kind: 'tip',
        title: 'Subes de peso pero tus cargas no mejoran',
        detail: 'Si el peso sube y la fuerza no, puede que el excedente no esté yendo al músculo. Revisa descanso, volumen y progresión antes de aumentar calorías.',
        rationale: common,
      });
    } else if (change > 2) {
      recommendations.push({
        id: 'performance-good',
        kind: 'info',
        title: 'Tus cargas progresan',
        detail: 'Buen indicador de que la nutrición y la recuperación están acompañando al entrenamiento.',
        rationale: common,
      });
    }
  }

  const order = { warning: 0, adjustment: 1, tip: 2, info: 3 } as const;
  return recommendations.sort((a, b) => order[a.kind] - order[b.kind]);
}
