import { estimateOneRepMax, type WorkoutLog } from '../workoutLog';
import type { ValidSet } from './types';

export const limits = {
  maxWeight: 600,
  maxReps: 100,
  /** Máximo de series por ejercicio y día que se contabilizan (evita inflar registros). */
  maxSetsPerExerciseDay: 12,
  /** Un 1RM estimado un 40 % superior al histórico se marca para revisión; nunca se descarta automáticamente. */
  reviewJump: 1.4,
  minSessionsForReview: 2,
};

type RawSet = { weight: number; reps: number; warmup?: boolean };

export function isPlausibleSet(set: RawSet): boolean {
  return Number.isFinite(set.weight) && Number.isFinite(set.reps) && set.weight >= 0 && set.weight <= limits.maxWeight && set.reps >= 1 && set.reps <= limits.maxReps;
}

/**
 * Convierte el diario de entrenamiento en series válidas: descarta calentamientos y valores imposibles,
 * limita series por ejercicio y día y marca para revisión los saltos anómalos de marca.
 */
export function collectValidSets(log: WorkoutLog, upTo?: string): ValidSet[] {
  const result: ValidSet[] = [];
  const baseline: Record<string, { best: number; sessions: number }> = {};
  Object.keys(log)
    .filter((date) => !upTo || date <= upTo)
    .sort()
    .forEach((date) => {
      Object.entries(log[date].exercises).forEach(([exercise, entry]) => {
        const raw = (entry.setLogs ?? []) as RawSet[];
        const sets = raw.filter((set) => !set.warmup && isPlausibleSet(set)).slice(0, limits.maxSetsPerExerciseDay);
        if (sets.length === 0) return;
        const state = baseline[exercise] ?? { best: 0, sessions: 0 };
        const sessionBest = Math.max(...sets.map((set) => estimateOneRepMax(set.weight, set.reps)));
        const review = state.sessions >= limits.minSessionsForReview && state.best > 0 && sessionBest > state.best * limits.reviewJump && sessionBest - state.best > 5;
        sets.forEach((set) => {
          const flagged = review && estimateOneRepMax(set.weight, set.reps) > state.best * limits.reviewJump;
          result.push({ date, exercise, group: entry.group ?? '', weight: set.weight, reps: set.reps, review: flagged });
        });
        baseline[exercise] = { best: Math.max(state.best, sessionBest), sessions: state.sessions + 1 };
      });
    });
  return result;
}

export const reviewSets = (sets: ValidSet[]) => sets.filter((set) => set.review);
