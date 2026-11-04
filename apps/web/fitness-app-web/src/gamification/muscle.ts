import { estimateOneRepMax } from '../workoutLog';
import { addDaysToKey } from '../nutrition/calc';
import { muscleWeights, primaryMuscle } from './exerciseMap';
import { bestMark, ironMilestones, type MilestoneDef } from './milestones';
import { divisionFor, nextDivision } from './leagues';
import { leagueMuscles, type AchievementState, type LeagueMuscle, type Metrics, type ValidSet } from './types';

export const MUSCLE_MAX = 10000;

/** Pesos configurables del Muscle Score. Si no hay peso corporal, la fuerza relativa se excluye y el resto se renormaliza. */
export const muscleWeightsConfig = { strength: 0.25, progression: 0.2, relative: 0.15, volume: 0.15, consistency: 0.15, achievements: 0.1 };

/** Múltiplos orientativos de 1RM estimado sobre peso corporal para considerar «completa» la fuerza relativa (no son estándares). */
const relativeReference: Partial<Record<LeagueMuscle, number>> = { Pecho: 1.25, Espalda: 1, Piernas: 2, Hombros: 0.6, 'Bíceps': 0.5, 'Tríceps': 0.8 };

export type MuscleScore = {
  muscle: LeagueMuscle;
  score: number;
  division: string;
  next: { name: string; missing: number } | null;
  parts: { strength: number; progression: number; relative: number | null; volume: number; consistency: number; achievements: number };
  records: { weight: Array<{ exercise: string; value: number }>; reps: number; sessionVolume: number; oneRepMax: number };
  nextMilestone: { exercise: string; target: number; current: number; unit: string } | null;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function defProgress(def: MilestoneDef, sets: ValidSet[] | undefined): number {
  const mark = bestMark(sets, def.metric, 3, def.added);
  const reached = def.steps.filter((step) => mark >= step).length;
  if (reached >= def.steps.length) return 1;
  const floor = reached === 0 ? 0 : def.steps[reached - 1];
  return (reached + clamp01((mark - floor) / (def.steps[reached] - floor))) / def.steps.length;
}

/** Series ponderadas por músculo en una ventana de fechas. */
export function weightedSets(sets: ValidSet[], muscle: LeagueMuscle, from: string, to: string): number {
  return sets.reduce((sum, set) => (set.date >= from && set.date <= to ? sum + (muscleWeights(set.exercise, set.group)[muscle] ?? 0) : sum), 0);
}

export function computeMuscleScores(metrics: Metrics, achievements: AchievementState[], bodyWeightKg: number | null): MuscleScore[] {
  const valid = metrics.sets.filter((set) => !set.review);
  const grouped: Record<string, ValidSet[]> = {};
  valid.forEach((set) => (grouped[set.exercise] ??= []).push(set));

  return leagueMuscles.map((muscle) => {
    const defs = ironMilestones.filter((def) => def.muscle === muscle);
    const strength = defs.length ? defs.reduce((sum, def) => sum + defProgress(def, grouped[def.exercise]), 0) / defs.length : 0;
    const progression = clamp01(metrics.prByMuscle[muscle] / 10);

    const muscleSets = valid.filter((set) => primaryMuscle(set.exercise, set.group) === muscle);
    const best1rm = Math.max(0, ...muscleSets.map((set) => estimateOneRepMax(set.weight, set.reps)));
    const reference = relativeReference[muscle];
    const relative = bodyWeightKg && reference ? clamp01(best1rm / (bodyWeightKg * reference)) : null;

    const weeklyAverage = [0, 1, 2, 3].reduce((sum, back) => sum + weightedSets(valid, muscle, addDaysToKey(metrics.asOf, -7 * (back + 1) + 1), addDaysToKey(metrics.asOf, -7 * back)), 0) / 4;
    const volume = clamp01(weeklyAverage / 12);
    const activeWeeks = [0, 1, 2, 3, 4, 5, 6, 7].filter((back) => weightedSets(valid, muscle, addDaysToKey(metrics.asOf, -7 * (back + 1) + 1), addDaysToKey(metrics.asOf, -7 * back)) > 0).length;
    const consistency = activeWeeks / 8;

    const iron = achievements.filter((item) => item.def.muscle === muscle);
    const achievementsPart = iron.length ? iron.filter((item) => item.status === 'unlocked').length / iron.length : 0;

    const w = muscleWeightsConfig;
    const parts = [
      [strength, w.strength],
      [progression, w.progression],
      [relative, w.relative],
      [volume, w.volume],
      [consistency, w.consistency],
      [achievementsPart, w.achievements],
    ] as Array<[number | null, number]>;
    const available = parts.filter(([value]) => value !== null);
    const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
    const raw = available.reduce((sum, [value, weight]) => sum + (value ?? 0) * weight, 0) / totalWeight;
    const score = Math.round(clamp01(raw) * MUSCLE_MAX);

    const weightRecords = defs
      .filter((def) => def.metric === 'weight' && !def.added)
      .map((def) => ({ exercise: def.exercise, value: bestMark(grouped[def.exercise], 'weight') }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const repRecord = Math.max(0, ...defs.filter((def) => def.metric === 'reps').map((def) => bestMark(grouped[def.exercise], 'reps')));
    const volumeBySession: Record<string, number> = {};
    muscleSets.forEach((set) => (volumeBySession[set.date] = (volumeBySession[set.date] ?? 0) + set.weight * set.reps));

    let nextMilestone: MuscleScore['nextMilestone'] = null;
    let closest = -1;
    defs.forEach((def) => {
      const mark = bestMark(grouped[def.exercise], def.metric, 3, def.added);
      const target = def.steps.find((step) => mark < step);
      if (target === undefined || mark === 0) return;
      const ratio = mark / target;
      if (ratio > closest) {
        closest = ratio;
        nextMilestone = { exercise: def.exercise, target, current: mark, unit: def.metric === 'reps' ? 'repeticiones' : def.metric === 'seconds' ? 's' : 'kg' };
      }
    });

    const next = nextDivision(score);
    return {
      muscle,
      score,
      division: divisionFor(score).name,
      next: next ? { name: next.division.name, missing: next.missing } : null,
      parts: { strength, progression, relative, volume, consistency, achievements: achievementsPart },
      records: { weight: weightRecords.slice(0, 3), reps: repRecord, sessionVolume: Math.round(Math.max(0, ...Object.values(volumeBySession))), oneRepMax: best1rm },
      nextMilestone,
    };
  });
}
