import { addDaysToKey, dayTotals } from '../nutrition/calc';
import { estimateOneRepMax, localKey, parseKey, weekStartOf } from '../workoutLog';
import { adherentWeekKeys, sessionDates } from './metrics';
import { collectValidSets } from './validation';
import type { AchievementState, GamCtx } from './types';

export const MAX_LEVEL = 100;

/** XP acumulada necesaria para alcanzar el nivel L. Curva suave: el nivel 100 requiere ~39.400 XP. */
export const cumXP = (level: number) => Math.round(40 * Math.pow(Math.max(0, level - 1), 1.5));

const titles: Array<[number, string]> = [
  [1, 'Discípulo'], [6, 'Iniciado'], [11, 'Atleta'], [21, 'Asceta'], [31, 'Discípulo de Aristóteles'], [41, 'Estoico'],
  [51, 'Estratega'], [61, 'Sabio'], [71, 'Maestro'], [81, 'Semidiós'], [91, 'Héroe'], [100, 'Areté Suprema'],
];

export const titleForLevel = (level: number) => [...titles].reverse().find(([from]) => level >= from)![1];

export type LevelInfo = { level: number; title: string; xp: number; currentFloor: number; nextAt: number | null; progress: number };

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && cumXP(level + 1) <= xp) level += 1;
  const currentFloor = cumXP(level);
  const nextAt = level >= MAX_LEVEL ? null : cumXP(level + 1);
  const progress = nextAt === null ? 1 : (xp - currentFloor) / (nextAt - currentFloor);
  return { level, title: titleForLevel(level), xp, currentFloor, nextAt, progress };
}

export type XpEvent = { date: string; xp: number; label: string };

export const xpRules = { trainingDay: 20, personalRecord: 10, recordsPerDayCap: 3, nutritionDay: 5, nutritionDaysPerWeekCap: 5, adherentWeek: 40 };

/**
 * Libro de XP derivado de los datos. Cada fuente tiene tope: los logros se cobran una vez, los récords hasta 3 al día y la nutrición
 * hasta 5 días por semana. El XP premia hábitos y progresión, no solo el peso levantado.
 */
export function buildXpLedger(ctx: GamCtx, unlocked: AchievementState[]): XpEvent[] {
  const events: XpEvent[] = [];
  unlocked.forEach((item) => {
    if (item.unlockedAt && item.def.xp > 0) events.push({ date: item.unlockedAt, xp: item.def.xp, label: `Logro: ${item.def.name}` });
  });

  const trained = sessionDates(ctx.workoutLog, ctx.plan, ctx.today);
  trained.forEach((date) => events.push({ date, xp: xpRules.trainingDay, label: 'Entrenamiento completado' }));

  const sets = collectValidSets(ctx.workoutLog, ctx.today).filter((set) => !set.review);
  const byExercise: Record<string, Record<string, number>> = {};
  sets.forEach((set) => {
    const days = (byExercise[set.exercise] ??= {});
    days[set.date] = Math.max(days[set.date] ?? 0, estimateOneRepMax(set.weight, set.reps));
  });
  const recordsByDay: Record<string, number> = {};
  Object.values(byExercise).forEach((days) => {
    let best = 0;
    Object.keys(days).sort().forEach((date, index) => {
      if (index > 0 && days[date] > best) recordsByDay[date] = (recordsByDay[date] ?? 0) + 1;
      best = Math.max(best, days[date]);
    });
  });
  Object.entries(recordsByDay).forEach(([date, count]) =>
    events.push({ date, xp: Math.min(count, xpRules.recordsPerDayCap) * xpRules.personalRecord, label: 'Récords personales' }),
  );

  const perWeek: Record<string, number> = {};
  Object.keys(ctx.entriesByDay).sort().forEach((date) => {
    if (date > ctx.today || !dayTotals(ctx.entriesByDay[date]).hasData) return;
    const week = localKey(weekStartOf(parseKey(date)));
    perWeek[week] = (perWeek[week] ?? 0) + 1;
    if (perWeek[week] <= xpRules.nutritionDaysPerWeekCap) events.push({ date, xp: xpRules.nutritionDay, label: 'Día de nutrición registrado' });
  });

  const trainedSet = new Set(trained);
  const weeks = [...new Set(trained.map((date) => localKey(weekStartOf(parseKey(date)))))];
  adherentWeekKeys(ctx.plan, trainedSet, weeks, ctx.today).forEach((week) => {
    const end = addDaysToKey(week, 6);
    if (end <= ctx.today) events.push({ date: end, xp: xpRules.adherentWeek, label: 'Semana completa' });
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export const totalXp = (events: XpEvent[]) => events.reduce((sum, event) => sum + event.xp, 0);
