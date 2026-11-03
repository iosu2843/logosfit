import { addDaysToKey, average, linearTrend, parseDateKey } from './calc';
import type { ProgressPoint } from './types';

export type TrainingDayLike = {
  name: string;
  type: string;
  exercises: Array<{ name: string; group: string; kind?: string }>;
};
export type MetricsLike = Record<string, { sets: number; reps: number; weight: number } | undefined>;

export type TrainingSummary = {
  sessionsPerWeek: number;
  setsPerWeek: number;
  setsByGroup: Record<string, number>;
  /** 0 = domingo … 6 = sábado, igual que Date.getDay(). */
  trainingWeekdays: number[];
  typeByWeekday: Record<number, string>;
};

export function summarizeTraining(plan: Record<number, TrainingDayLike | undefined>, metrics: MetricsLike): TrainingSummary {
  const setsByGroup: Record<string, number> = {};
  const trainingWeekdays: number[] = [];
  const typeByWeekday: Record<number, string> = {};
  let setsPerWeek = 0;

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const day = plan[weekday];
    if (!day || day.exercises.length === 0) continue;
    trainingWeekdays.push(weekday);
    typeByWeekday[weekday] = day.type;
    for (const exercise of day.exercises) {
      if (exercise.kind === 'cardio') continue;
      const sets = metrics[exercise.name]?.sets ?? 3;
      setsByGroup[exercise.group] = (setsByGroup[exercise.group] ?? 0) + sets;
      setsPerWeek += sets;
    }
  }
  return { sessionsPerWeek: trainingWeekdays.length, setsPerWeek, setsByGroup, trainingWeekdays, typeByWeekday };
}

export type DayTrainingInfo = { isTraining: boolean; type?: string; name?: string; exerciseCount: number };

export function trainingInfoForDate(plan: Record<number, TrainingDayLike | undefined>, dateKey: string): DayTrainingInfo {
  const day = plan[parseDateKey(dateKey).getDay()];
  if (!day || day.exercises.length === 0) return { isTraining: false, exerciseCount: 0 };
  return { isTraining: true, type: day.type, name: day.name, exerciseCount: day.exercises.length };
}

export type PerformanceSummary = { exercisesTracked: number; averageChangePercent: number };

/** Variación media de las cargas registradas en las últimas semanas (tendencia, no primer vs último dato). */
export function performanceTrend(loads: Record<string, ProgressPoint[]>, endKey: string, windowDays = 56): PerformanceSummary | null {
  const startKey = addDaysToKey(endKey, -windowDays);
  const changes: number[] = [];
  for (const points of Object.values(loads)) {
    const recent = points.filter((point) => point.date >= startKey && point.date <= endKey && point.value > 0);
    const trend = linearTrend(recent);
    if (!trend || recent.length < 3 || trend.spanDays < 14 || trend.first <= 0) continue;
    changes.push(((trend.slopePerWeek * (trend.spanDays / 7)) / trend.first) * 100);
  }
  if (changes.length === 0) return null;
  return { exercisesTracked: changes.length, averageChangePercent: average(changes) };
}
