import { addDaysToKey, dayTotals } from '../nutrition/calc';
import { estimateOneRepMax, isDayCompleted, localKey, parseKey, weekStartOf, type WorkoutLog } from '../workoutLog';
import { isCardioExercise, primaryMuscle } from './exerciseMap';
import { collectValidSets } from './validation';
import { leagueMuscles, type GamCtx, type LeagueMuscle, type Metrics, type ValidSet } from './types';

const weekKey = (date: string) => localKey(weekStartOf(parseKey(date)));

export function longestRun(weeks: Iterable<string>): number {
  const sorted = [...new Set(weeks)].sort();
  let best = 0;
  let run = 0;
  let previous = '';
  sorted.forEach((week) => {
    run = previous && addDaysToKey(previous, 7) === week ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  });
  return best;
}

/** Sesión entrenada: día con series registradas que está terminado (finishedAt) o con todos los ejercicios de la rutina completos. */
export function sessionDates(log: WorkoutLog, plan: GamCtx['plan'], upTo: string): string[] {
  return Object.keys(log)
    .filter((date) => date <= upTo)
    .filter((date) => {
      const day = log[date];
      const hasSets = Object.values(day.exercises).some((entry) => entry.sets > 0);
      if (!hasSets) return false;
      if (day.finishedAt) return true;
      return isDayCompleted(plan[parseKey(date).getDay()]?.exercises ?? [], day);
    })
    .sort();
}

export function adherentWeekKeys(plan: GamCtx['plan'], trainedSet: Set<string>, weeks: string[], asOf: string): string[] {
  return weeks
    .filter((week) => {
      let planned = 0;
      let done = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        const date = addDaysToKey(week, offset);
        if (date > asOf) break;
        const exercises = plan[parseKey(date).getDay()]?.exercises ?? [];
        if (exercises.length === 0) continue;
        planned += 1;
        if (trainedSet.has(date)) done += 1;
      }
      return planned > 0 && done >= planned;
    })
    .sort();
}
const countUpTo = (dates: string[], asOf: string) => new Set(dates.filter((date) => date <= asOf)).size;

/** Todas las métricas son acumulativas hasta `asOf`, de modo que son monótonas y permiten reconstruir cuándo se desbloqueó cada logro. */
export function computeMetrics(ctx: GamCtx, asOf: string): Metrics {
  const sets = collectValidSets(ctx.workoutLog, asOf);
  const trained = sessionDates(ctx.workoutLog, ctx.plan, asOf);
  const trainedSet = new Set(trained);
  const setsByExercise: Record<string, ValidSet[]> = {};
  sets.forEach((set) => (setsByExercise[set.exercise] ??= []).push(set));

  let totalVolume = 0;
  const sessionVol: Record<string, number> = {};
  const exerciseVol: Record<string, number> = {};
  sets.forEach((set) => {
    const volume = set.weight * set.reps;
    totalVolume += volume;
    sessionVol[set.date] = (sessionVol[set.date] ?? 0) + volume;
    const key = `${set.date}|${set.exercise}`;
    exerciseVol[key] = (exerciseVol[key] ?? 0) + volume;
  });

  const prByMuscle = Object.fromEntries(leagueMuscles.map((muscle) => [muscle, 0])) as Record<LeagueMuscle, number>;
  const prExercises = new Set<string>();
  const improved = new Set<string>();
  Object.entries(setsByExercise).forEach(([exercise, list]) => {
    const byDate: Record<string, number> = {};
    list.forEach((set) => (byDate[set.date] = Math.max(byDate[set.date] ?? 0, estimateOneRepMax(set.weight, set.reps))));
    const dates = Object.keys(byDate).sort();
    let best = 0;
    dates.forEach((date, index) => {
      if (index > 0 && byDate[date] > best) {
        prExercises.add(exercise);
        const muscle = primaryMuscle(exercise, list[0].group);
        if (muscle) prByMuscle[muscle] += 1;
      }
      best = Math.max(best, byDate[date]);
    });
    if (dates.length >= 3 && best >= byDate[dates[0]] * 1.1) improved.add(exercise);
  });

  const weeklySessions: Record<string, number> = {};
  trained.forEach((date) => (weeklySessions[weekKey(date)] = (weeklySessions[weekKey(date)] ?? 0) + 1));
  const activeWeekKeys = Object.keys(weeklySessions);

  const adherentWeeks = adherentWeekKeys(ctx.plan, trainedSet, activeWeekKeys, asOf);

  const since52 = addDaysToKey(asOf, -364);
  const weights = ctx.bodyWeight.filter((point) => point.date <= asOf);

  const cardioDates = trained.filter((date) =>
    Object.entries(ctx.workoutLog[date].exercises).some(([name, entry]) => entry.sets > 0 && isCardioExercise(name, entry.group)),
  );

  const nutritionDates = Object.keys(ctx.entriesByDay)
    .filter((date) => date <= asOf)
    .filter((date) => dayTotals(ctx.entriesByDay[date]).hasData)
    .sort();
  const nutritionByWeek: Record<string, { days: number; fullDays: number; proteinDays: number }> = {};
  let mealsLogged = 0;
  nutritionDates.forEach((date) => {
    const totals = dayTotals(ctx.entriesByDay[date]);
    mealsLogged += totals.mealCount;
    const week = (nutritionByWeek[weekKey(date)] ??= { days: 0, fullDays: 0, proteinDays: 0 });
    week.days += 1;
    if (totals.mealCount >= 3) week.fullDays += 1;
    if (ctx.nutrition.proteinGoal > 0 && totals.macros.protein >= ctx.nutrition.proteinGoal * 0.9) week.proteinDays += 1;
  });
  const nutritionWeekKeys = Object.keys(nutritionByWeek).filter((week) => nutritionByWeek[week].days >= 5);
  const harmony = nutritionWeekKeys.filter((week) => adherentWeeks.includes(week));

  const dawn = trained.some((date) => {
    const finished = ctx.workoutLog[date].finishedAt;
    return finished ? new Date(finished).getHours() < 7 : false;
  });

  return {
    asOf,
    sets,
    setsByExercise,
    trainedDates: trained,
    sessions: trained.length,
    setSessions: Object.keys(sessionVol).length,
    totalVolume: Math.round(totalVolume),
    maxSessionVolume: Math.round(Math.max(0, ...Object.values(sessionVol))),
    maxExerciseVolume: Math.round(Math.max(0, ...Object.values(exerciseVol))),
    prExercises: prExercises.size,
    prByMuscle,
    progressiveExercises: improved.size,
    maxWeeklySessions: Math.max(0, ...Object.values(weeklySessions)),
    bestAdherenceStreak: longestRun(adherentWeeks),
    distinctTrainingDays: new Set(trained.map((date) => parseKey(date).getDay())).size,
    activeWeeksIn52: activeWeekKeys.filter((week) => week >= weekKey(since52)).length,
    activeWeeks: activeWeekKeys.length,
    bodyWeightRun: longestRun(weights.map((point) => weekKey(point.date))),
    chartViews: countUpTo(ctx.state.charts, asOf),
    reviews: countUpTo(ctx.state.reviews, asOf),
    reportViews: ctx.state.reportViews.filter((date) => date <= asOf).length,
    routineEdits: ctx.state.routineEdits.filter((date) => date <= asOf).length,
    visits: countUpTo(ctx.state.visits, asOf),
    dawnWorkout: dawn,
    cardioSessions: cardioDates.length,
    cardioWeekRun: longestRun(cardioDates.map(weekKey)),
    mealsLogged,
    nutritionDays: nutritionDates.length,
    proteinWeek: Math.max(0, ...Object.values(nutritionByWeek).map((week) => week.proteinDays)),
    fullMealWeeks: Object.values(nutritionByWeek).filter((week) => week.fullDays >= 5).length,
    balancedWeeks: Object.values(nutritionByWeek).filter((week) => week.days >= 5 && week.proteinDays >= 4).length,
    nutritionWeeks: nutritionWeekKeys.length,
    harmonyRun: longestRun(harmony),
    recipes: ctx.nutrition.recipes,
    profileComplete: ctx.profile.complete,
    unlockedOthers: 0,
  };
}

