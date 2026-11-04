import { addDaysToKey, daysBetween, dayTotals } from '../nutrition/calc';
import { weightedSets } from './muscle';
import { adherentWeekKeys, sessionDates } from './metrics';
import { collectValidSets } from './validation';
import { leagueMuscles, type GamCtx, type LeagueMuscle } from './types';
import { localKey, parseKey, weekStartOf } from '../workoutLog';

export const SEASON_START = '2026-01-05';
export const SEASON_DAYS = 28;

const names = ['Temporada de Sócrates', 'Temporada de Platón', 'Temporada de Aristóteles', 'Temporada de Epicteto', 'Temporada de Séneca', 'Temporada de Marco Aurelio', 'Temporada de Heráclito', 'Temporada de Pitágoras', 'Temporada de Zenón', 'Temporada de Epicuro'];

export type SeasonChallenge = { id: string; label: string; current: number; target: number; done: boolean };
export type SeasonInfo = {
  index: number;
  name: string;
  start: string;
  end: string;
  daysLeft: number;
  focus: LeagueMuscle;
  challenges: SeasonChallenge[];
  reward: string;
};

export function seasonIndex(date: string): number {
  return Math.max(0, Math.floor(daysBetween(SEASON_START, date) / SEASON_DAYS));
}

export function seasonInfo(ctx: GamCtx, date = ctx.today): SeasonInfo {
  const index = seasonIndex(date);
  const start = addDaysToKey(SEASON_START, index * SEASON_DAYS);
  const end = addDaysToKey(start, SEASON_DAYS - 1);
  const focus = leagueMuscles[index % leagueMuscles.length];
  const upTo = end < ctx.today ? end : ctx.today;

  const trained = sessionDates(ctx.workoutLog, ctx.plan, upTo).filter((d) => d >= start);
  const weeks = [...new Set(trained.map((d) => localKey(weekStartOf(parseKey(d)))))];
  const adherent = adherentWeekKeys(ctx.plan, new Set(trained), weeks, upTo).length;
  const nutritionDays = Object.keys(ctx.entriesByDay).filter((d) => d >= start && d <= upTo && dayTotals(ctx.entriesByDay[d]).hasData).length;
  const focusSets = Math.round(weightedSets(collectValidSets(ctx.workoutLog, upTo).filter((s) => !s.review), focus, start, upTo));
  const reviewed = ctx.state.reviews.filter((d) => d >= start && d <= end).length;

  const make = (id: string, label: string, current: number, target: number): SeasonChallenge => ({ id, label, current: Math.min(current, target), target, done: current >= target });
  return {
    index,
    name: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`,
    start,
    end,
    daysLeft: Math.max(0, daysBetween(ctx.today, end)),
    focus,
    reward: 'Marco cosmético para tu Vitrina (sin ventajas competitivas).',
    challenges: [
      make('sesiones', 'Completa 10 entrenamientos', trained.length, 10),
      make('semanas', 'Cumple lo planificado en 3 semanas', adherent, 3),
      make('nutricion', 'Registra tu alimentación 14 días', nutritionDays, 14),
      make('foco', `Foco ${focus}: 40 series ponderadas`, focusSets, 40),
      make('revision', 'Haz tu revisión mensual', reviewed, 1),
    ],
  };
}
