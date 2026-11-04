import { addDaysToKey } from '../nutrition/calc';
import { localKey, parseKey, weekStartOf } from '../workoutLog';
import { adherentWeekKeys, sessionDates } from './metrics';
import type { AchievementState, GamCtx } from './types';
import type { MuscleScore } from './muscle';

/** Pesos configurables del Logos Score; suman 1. */
export const scoreWeights = { fuerza: 0.25, disciplina: 0.25, nutricion: 0.15, progreso: 0.2, logros: 0.15 };
export const LOGOS_MAX = 10000;
/** Tope de puntos que puede aportar una semana, para que una semana extrema no desequilibre el total. */
export const WEEKLY_POINT_CAP = 500;

export type LogosScore = {
  total: number;
  dimensions: Record<keyof typeof scoreWeights, number>;
  weeklyPoints: number;
  improvement: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function recentWeeks(count: number, today: string): string[] {
  const start = localKey(weekStartOf(parseKey(today)));
  return Array.from({ length: count }, (_, i) => addDaysToKey(start, -7 * i));
}

function dimensions(ctx: GamCtx, today: string, muscles: MuscleScore[], achievements: AchievementState[]) {
  const weeks = recentWeeks(8, today);
  const trained = sessionDates(ctx.workoutLog, ctx.plan, today);
  const trainedSet = new Set(trained);
  const adherent = adherentWeekKeys(ctx.plan, trainedSet, weeks, today).length;
  const nutritionWeeks = weeks.filter((week) => {
    let days = 0;
    for (let i = 0; i < 7; i += 1) {
      const entries = ctx.entriesByDay[addDaysToKey(week, i)];
      if (entries && entries.some((entry) => entry.kind === 'meal')) days += 1;
    }
    return days >= 5;
  }).length;
  const base = achievements.filter((item) => !item.def.meta && item.def.category !== 'propios');
  return {
    fuerza: muscles.reduce((sum, m) => sum + m.parts.strength, 0) / muscles.length,
    disciplina: adherent / 8,
    nutricion: nutritionWeeks / 8,
    progreso: muscles.reduce((sum, m) => sum + m.parts.progression, 0) / muscles.length,
    logros: base.length ? base.filter((item) => item.status === 'unlocked').length / base.length : 0,
  };
}

export function computeLogosScore(ctx: GamCtx, muscles: MuscleScore[], achievements: AchievementState[]): LogosScore {
  const now = dimensions(ctx, ctx.today, muscles, achievements);
  const before = dimensions(ctx, addDaysToKey(ctx.today, -28), muscles, achievements);
  const weighted = (dims: typeof now) => (Object.keys(scoreWeights) as Array<keyof typeof scoreWeights>).reduce((sum, key) => sum + clamp01(dims[key]) * scoreWeights[key], 0);
  const total = Math.round(weighted(now) * LOGOS_MAX);
  const improvement = Math.round((weighted(now) - weighted(before)) * LOGOS_MAX);
  const weeklyPoints = Math.min(WEEKLY_POINT_CAP, Math.max(0, improvement));
  return { total, dimensions: now, weeklyPoints, improvement };
}
