import { buildAchievements } from './achievements';
import { computeCups, type Cup } from './cups';
import { divisionFor } from './leagues';
import { computeMetrics } from './metrics';
import { computeMuscleScores, type MuscleScore } from './muscle';
import { computeLogosScore, type LogosScore } from './score';
import { seasonInfo, type SeasonInfo } from './seasons';
import { buildXpLedger, levelInfo, totalXp, type LevelInfo, type XpEvent } from './xp';
import { reviewSets } from './validation';
import type { Achievement, AchievementState, GamCtx, Metrics, Visibility } from './types';

export type GamReport = {
  achievements: AchievementState[];
  unlockedCount: number;
  level: LevelInfo;
  xpLedger: XpEvent[];
  muscles: MuscleScore[];
  logos: LogosScore;
  cups: Cup[];
  season: SeasonInfo;
  pendingReview: number;
  /** Logros nuevos desde la última vez que se marcaron como vistos. */
  newlyUnlocked: AchievementState[];
};

function candidateDates(ctx: GamCtx): string[] {
  const dates = new Set<string>([ctx.today]);
  Object.keys(ctx.workoutLog).forEach((d) => d <= ctx.today && dates.add(d));
  Object.keys(ctx.entriesByDay).forEach((d) => d <= ctx.today && dates.add(d));
  ctx.bodyWeight.forEach((p) => p.date <= ctx.today && dates.add(p.date));
  [ctx.state.visits, ctx.state.charts, ctx.state.reviews, ctx.state.reportViews, ctx.state.routineEdits].forEach((list) => list.forEach((d) => d <= ctx.today && dates.add(d)));
  return [...dates].sort();
}

/** Primera fecha en la que se cumple el logro; las métricas son acumulativas, así que la búsqueda binaria es válida. */
function unlockDate(def: Achievement, dates: string[], metricsAt: (date: string) => Metrics, today: string, firstSeen: Record<string, string>): string {
  if (def.undated) return firstSeen[def.id] ?? today;
  let lo = 0;
  let hi = dates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const p = def.progress(metricsAt(dates[mid]));
    if (p.current >= p.target) hi = mid;
    else lo = mid + 1;
  }
  return dates[lo];
}

export function buildReport(ctx: GamCtx): GamReport {
  const defs = buildAchievements(ctx.state.custom);
  const dates = candidateDates(ctx);
  const cache = new Map<string, Metrics>();
  const metricsAt = (date: string) => {
    let value = cache.get(date);
    if (!value) cache.set(date, (value = computeMetrics(ctx, date)));
    return value;
  };
  const now = metricsAt(ctx.today);

  const states: AchievementState[] = defs
    .filter((def) => !def.meta)
    .map((def) => {
      const progress = def.progress(now);
      const done = progress.current >= progress.target;
      return { def, status: done ? 'unlocked' : progress.current > 0 ? 'progress' : 'locked', progress, unlockedAt: done ? unlockDate(def, dates, metricsAt, ctx.today, ctx.state.firstSeen) : null };
    });

  const unlockedDates = states.filter((s) => s.unlockedAt).map((s) => s.unlockedAt as string).sort();
  const metaStates: AchievementState[] = defs
    .filter((def) => def.meta)
    .map((def) => {
      if (def.platinumOf) {
        const group = states.filter((s) => s.def.category === def.platinumOf || (def.platinumOf === 'fuerza' && s.def.category === 'iron'));
        const done = group.filter((s) => s.status === 'unlocked');
        const complete = group.length > 0 && done.length === group.length;
        const progress = { current: done.length, target: group.length };
        return { def, status: complete ? 'unlocked' : done.length > 0 ? 'progress' : 'locked', progress, unlockedAt: complete ? done.map((s) => s.unlockedAt as string).sort().pop() ?? ctx.today : null } as AchievementState;
      }
      const progress = def.progress({ ...now, unlockedOthers: unlockedDates.length });
      const complete = progress.current >= progress.target;
      return { def, status: complete ? 'unlocked' : progress.current > 0 ? 'progress' : 'locked', progress, unlockedAt: complete ? unlockedDates[progress.target - 1] ?? ctx.today : null } as AchievementState;
    });

  const achievements = [...states, ...metaStates];
  const unlocked = achievements.filter((s) => s.status === 'unlocked');
  const xpLedger = buildXpLedger(ctx, unlocked);
  const muscles = computeMuscleScores(now, achievements, ctx.profile.weightKg);
  const logos = computeLogosScore(ctx, muscles, achievements);

  return {
    achievements,
    unlockedCount: unlocked.length,
    level: levelInfo(totalXp(xpLedger)),
    xpLedger,
    muscles,
    logos,
    cups: computeCups(achievements, muscles),
    season: seasonInfo(ctx),
    pendingReview: reviewSets(now.sets).length,
    newlyUnlocked: unlocked.filter((s) => !ctx.state.seen.includes(s.def.id)),
  };
}

export type RankEntry = { id: string; name: string; visibility: Visibility; hideRankings: boolean; logos: number; muscles: Record<string, number>; self?: boolean };
export type RankRow = { id: string; name: string; score: number; division: string; position: number; self: boolean };

/** Clasificación entre perfiles locales: los privados y los que ocultan rankings solo ven su propia posición. */
export function buildLeaderboard(entries: RankEntry[], metric: 'logos' | string): RankRow[] {
  const value = (entry: RankEntry) => (metric === 'logos' ? entry.logos : entry.muscles[metric] ?? 0);
  return entries
    .filter((entry) => entry.self || (entry.visibility !== 'private' && !entry.hideRankings))
    .sort((a, b) => value(b) - value(a))
    .map((entry, index) => ({ id: entry.id, name: entry.name, score: value(entry), division: divisionFor(metric === 'logos' ? value(entry) : value(entry)).name, position: index + 1, self: Boolean(entry.self) }));
}

