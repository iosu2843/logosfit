export type WorkoutExerciseLog = { sets: number; target: number; weight: number };
export type WorkoutDayLog = {
  dayName: string;
  dayType: string;
  exercises: Record<string, WorkoutExerciseLog>;
  finishedAt?: string;
};
export type WorkoutLog = Record<string, WorkoutDayLog>;

export type PlannedExercise = { name: string };

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

export function sessionVolume(log: WorkoutDayLog): number {
  return Object.values(log.exercises).reduce((total, entry) => total + entry.sets * entry.weight, 0);
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
