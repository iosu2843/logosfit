export type SetLog = { weight: number; reps: number; warmup?: boolean };
export type WorkoutExerciseLog = {
  sets: number;
  target: number;
  weight: number;
  group?: string;
  setLogs?: SetLog[];
  pr?: boolean;
};
export type WorkoutDayLog = {
  dayName: string;
  dayType: string;
  exercises: Record<string, WorkoutExerciseLog>;
  finishedAt?: string;
};
export type WorkoutLog = Record<string, WorkoutDayLog>;

export type PlannedExercise = { name: string; group?: string; kind?: string };
export type PlanLike = Record<number, { exercises: PlannedExercise[] } | undefined>;

const lowerBodyGroups = ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos'];
const heavyGroups = ['Pecho', 'Espalda', 'Cuádriceps', 'Isquiotibiales', 'Glúteos'];
const weeklySetsWarning = 20;

export function localKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function shiftDate(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
  return next;
}

function parseKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

export function isExerciseDone(entry: WorkoutExerciseLog | undefined): boolean {
  return Boolean(entry) && entry!.target > 0 && entry!.sets >= entry!.target;
}

export function countCompletedExercises(planned: PlannedExercise[], log: WorkoutDayLog | undefined): number {
  return planned.filter((exercise) => isExerciseDone(log?.exercises[exercise.name])).length;
}

export function isDayCompleted(planned: PlannedExercise[], log: WorkoutDayLog | undefined): boolean {
  return planned.length > 0 && countCompletedExercises(planned, log) === planned.length;
}

export function isDayStarted(log: WorkoutDayLog | undefined): boolean {
  return Boolean(log) && Object.values(log!.exercises).some((entry) => entry.sets > 0);
}

export function dayHasRecord(log: WorkoutDayLog | undefined): boolean {
  return Boolean(log) && Object.values(log!.exercises).some((entry) => entry.pr);
}

export function topWeight(entry: WorkoutExerciseLog): number {
  return entry.setLogs?.length ? Math.max(...entry.setLogs.map((set) => set.weight)) : entry.weight;
}

function entryVolume(entry: WorkoutExerciseLog): number {
  return entry.setLogs?.length
    ? entry.setLogs.reduce((total, set) => total + set.weight * set.reps, 0)
    : entry.sets * entry.weight;
}

export function sessionVolume(log: WorkoutDayLog): number {
  return Object.values(log.exercises).reduce((total, entry) => total + entryVolume(entry), 0);
}

export function sessionSets(log: WorkoutDayLog): number {
  return Object.values(log.exercises).reduce((total, entry) => total + entry.sets, 0);
}

export function recentSessions(log: WorkoutLog, limit = 10): Array<{ date: string; log: WorkoutDayLog }> {
  return Object.entries(log)
    .filter(([, value]) => isDayStarted(value))
    .map(([date, value]) => ({ date, log: value }))
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, limit);
}

export function setExerciseProgress(
  log: WorkoutLog,
  date: string,
  day: { name: string; type: string },
  exerciseName: string,
  entry: WorkoutExerciseLog,
): WorkoutLog {
  const current = log[date];
  return {
    ...log,
    [date]: {
      dayName: day.name,
      dayType: day.type,
      finishedAt: current?.finishedAt,
      exercises: { ...(current?.exercises ?? {}), [exerciseName]: entry },
    },
  };
}

export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const value = reps === 1 ? weight : weight * (1 + reps / 30);
  return Math.round(value * 10) / 10;
}

export function bestOneRepMax(log: WorkoutLog, exerciseName: string): number {
  let best = 0;
  Object.values(log).forEach((day) => {
    day.exercises[exerciseName]?.setLogs?.forEach((set) => {
      best = Math.max(best, estimateOneRepMax(set.weight, set.reps));
    });
  });
  return best;
}

export function personalBest(log: WorkoutLog, exerciseName: string, beforeDate: string): number {
  let best = 0;
  Object.entries(log).forEach(([date, day]) => {
    const entry = day.exercises[exerciseName];
    if (date < beforeDate && entry && entry.sets > 0) best = Math.max(best, topWeight(entry));
  });
  return best;
}

export function recordIds<T extends { id: string; value: number }>(points: T[]): Set<string> {
  const records = new Set<string>();
  let best = 0;
  points.forEach((point, index) => {
    if (index > 0 && point.value > best) records.add(point.id);
    best = Math.max(best, point.value);
  });
  return records;
}

export function volumeByGroup(log: WorkoutLog, fromKey: string, toKey: string): Record<string, { sets: number; volume: number }> {
  const result: Record<string, { sets: number; volume: number }> = {};
  Object.entries(log).forEach(([date, day]) => {
    if (date < fromKey || date > toKey) return;
    Object.values(day.exercises).forEach((entry) => {
      if (!entry.group || entry.group === 'Cardio' || entry.sets <= 0) return;
      const current = result[entry.group] ?? { sets: 0, volume: 0 };
      result[entry.group] = { sets: current.sets + entry.sets, volume: current.volume + entryVolume(entry) };
    });
  });
  return result;
}

export function weeklyAdherence(plan: PlanLike, log: WorkoutLog, weekStart: Date): { planned: number; completed: number } {
  let planned = 0;
  let completed = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const date = shiftDate(weekStart, offset);
    const exercises = plan[date.getDay()]?.exercises ?? [];
    if (exercises.length === 0) continue;
    planned += 1;
    if (isDayCompleted(exercises, log[localKey(date)])) completed += 1;
  }
  return { planned, completed };
}

export function currentStreak(plan: PlanLike, log: WorkoutLog, today: Date): number {
  let streak = 0;
  for (let offset = 0; offset < 400; offset += 1) {
    const date = shiftDate(today, -offset);
    const exercises = plan[date.getDay()]?.exercises ?? [];
    if (exercises.length === 0) continue;
    if (isDayCompleted(exercises, log[localKey(date)])) streak += 1;
    else if (offset > 0) break;
  }
  return streak;
}

export type WeightSuggestion = { weight: number; increased: boolean; reason: string };

export function suggestNextWeight(
  log: WorkoutLog,
  exercise: { name: string; group?: string },
  planned: { reps: number },
  beforeDate: string,
): WeightSuggestion | null {
  const dates = Object.keys(log).filter((date) => date < beforeDate && log[date].exercises[exercise.name]?.setLogs?.length).sort();
  const lastDate = dates[dates.length - 1];
  if (!lastDate) return null;
  const entry = log[lastDate].exercises[exercise.name];
  const top = topWeight(entry);
  if (top <= 0) return null;
  const completed = isExerciseDone(entry) && entry.setLogs!.every((set) => set.reps >= planned.reps);
  if (!completed) {
    return { weight: top, increased: false, reason: `No completaste todas las series con ${planned.reps} reps con ${top} kg: mantén la carga.` };
  }
  const increment = lowerBodyGroups.includes(exercise.group ?? '') ? 5 : 2.5;
  return {
    weight: top + increment,
    increased: true,
    reason: `Completaste ${entry.sets} series con ≥${planned.reps} reps usando ${top} kg: sube ${increment} kg.`,
  };
}

export function suggestRestSeconds(group: string | undefined): number {
  if (group && heavyGroups.includes(group)) return 120;
  if (group === 'Hombros') return 90;
  return 60;
}

export function recoveryWarnings(plan: PlanLike, log: WorkoutLog, date: Date, today: Date): string[] {
  const exercises = (plan[date.getDay()]?.exercises ?? []).filter((exercise) => exercise.group && exercise.group !== 'Cardio');
  const groups = [...new Set(exercises.map((exercise) => exercise.group as string))];
  const dateKey = localKey(date);
  const yesterdayKey = localKey(shiftDate(date, -1));
  const yesterdayLog = log[yesterdayKey];
  const previousPlan = (plan[shiftDate(date, -1).getDay()]?.exercises ?? []).map((exercise) => exercise.group);
  const weekAgoKey = localKey(shiftDate(date, -7));
  const weeklyVolume = volumeByGroup(log, weekAgoKey, localKey(shiftDate(date, -1)));
  const warnings: string[] = [];

  groups.forEach((group) => {
    const trainedYesterday = Object.values(yesterdayLog?.exercises ?? {}).some((entry) => entry.group === group && entry.sets > 0);
    const plannedYesterday = date >= shiftDate(today, 0) && previousPlan.includes(group) && !yesterdayLog;
    if (trainedYesterday || plannedYesterday) {
      warnings.push(`${group}: se trabajó o está programado el día anterior. Conviene dejar unas 48 h de recuperación entre sesiones del mismo grupo.`);
    }
    const weekly = weeklyVolume[group];
    if (weekly && weekly.sets >= weeklySetsWarning && dateKey >= localKey(today)) {
      warnings.push(`${group}: ${weekly.sets} series en los últimos 7 días. Es un volumen alto; valora reducirlo si notas fatiga.`);
    }
  });
  return warnings;
}

export function weekStartOf(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return shiftDate(date, -offset);
}

export function shiftWeeks(date: Date, weeks: number): Date {
  return shiftDate(date, weeks * 7);
}

export { parseKey };

