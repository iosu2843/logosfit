import { describe, expect, it } from 'vitest';
import { buildReport, buildLeaderboard } from './engine';
import { cumXP, levelInfo } from './xp';
import { divisionFor, settleSeason } from './leagues';
import { muscleWeights } from './exerciseMap';
import { collectValidSets } from './validation';
import { computeMetrics } from './metrics';
import { bestMark } from './milestones';
import { defaultGamState, normalizeGamState } from './store';
import type { GamCtx } from './types';
import type { WorkoutLog } from '../workoutLog';

const dayLog = (exercise: string, group: string, sets: Array<[number, number]>, finishedAt = '2026-03-02T18:00:00'): WorkoutLog[string] => ({
  dayName: 'Día',
  dayType: 'Push',
  finishedAt,
  exercises: { [exercise]: { sets: sets.length, target: sets.length, weight: 0, group, setLogs: sets.map(([weight, reps]) => ({ weight, reps })) } },
});

const ctxWith = (log: WorkoutLog, today = '2026-03-10'): GamCtx => ({
  today,
  workoutLog: log,
  plan: {},
  bodyWeight: [],
  entriesByDay: {},
  nutrition: { recipes: 0, proteinGoal: 150, calorieTarget: null },
  profile: { name: 'Test', complete: false, weightKg: 80 },
  state: defaultGamState(),
});

describe('validación', () => {
  it('descarta calentamientos, valores imposibles y limita series', () => {
    const log: WorkoutLog = {
      '2026-03-02': {
        ...dayLog('Press banca', 'Pecho', [[60, 5]]),
        exercises: { 'Press banca': { sets: 4, target: 4, weight: 0, group: 'Pecho', setLogs: [{ weight: 20, reps: 10, warmup: true }, { weight: 9999, reps: 5 }, { weight: 60, reps: 500 }, { weight: 60, reps: 5 }] } },
      },
    };
    expect(collectValidSets(log)).toHaveLength(1);
  });

  it('marca para revisión un salto anómalo sin descartarlo', () => {
    const log: WorkoutLog = {
      '2026-03-02': dayLog('Press banca', 'Pecho', [[60, 5]]),
      '2026-03-04': dayLog('Press banca', 'Pecho', [[62, 5]]),
      '2026-03-06': dayLog('Press banca', 'Pecho', [[120, 5]]),
    };
    const sets = collectValidSets(log);
    expect(sets.filter((s) => s.review)).toHaveLength(1);
    expect(sets).toHaveLength(3);
  });
});

describe('Iron Milestones', () => {
  it('exige un mínimo de repeticiones y separa ejercicios', () => {
    const log: WorkoutLog = { '2026-03-02': dayLog('Press de pecho sentado', 'Pecho', [[100, 1], [60, 8]]) };
    const sets = collectValidSets(log);
    expect(bestMark(sets, 'weight', 3)).toBe(60);
    expect(bestMark(sets, 'weight', 1)).toBe(100);
    const report = buildReport(ctxWith(log));
    expect(report.achievements.find((a) => a.def.id === 'iron:press-sentado:60')?.status).toBe('unlocked');
    expect(report.achievements.find((a) => a.def.id === 'iron:press-convergente:40')?.status).not.toBe('unlocked');
  });
});

describe('XP, niveles y ligas', () => {
  it('la curva es creciente y llega al nivel 100', () => {
    expect(cumXP(1)).toBe(0);
    expect(cumXP(2)).toBeLessThan(cumXP(3));
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(10 ** 7).level).toBe(100);
    expect(levelInfo(10 ** 7).title).toBe('Areté Suprema');
  });

  it('asigna divisiones por puntuación', () => {
    expect(divisionFor(0).name).toBe('Academia');
    expect(divisionFor(9500).name).toBe('Olimpo');
  });

  it('asciende solo con mínimo de participantes y puntuación suficiente', () => {
    const few = settleSeason([{ id: 'a', score: 900, division: 1 }, { id: 'b', score: 600, division: 1 }]);
    expect(few.a).toBe('permanece');
    const group = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, score: 1300 - i * 400, division: 1 }));
    const result = settleSeason(group);
    expect(result.a).toBe('asciende');
    expect(result.e).toBe('desciende');
  });
});

describe('reparto muscular', () => {
  it('reparte cada serie con pesos que suman 1 y respeta ejercicios simples', () => {
    const press = muscleWeights('Press banca');
    expect(Object.values(press).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1);
    expect(muscleWeights('Prensa de piernas')).toEqual({ Piernas: 1 });
    expect(muscleWeights('Curl con barra recta')).toEqual({ 'Bíceps': 1 });
  });
});

describe('informe completo', () => {
  const log: WorkoutLog = {
    '2026-03-02': dayLog('Press banca', 'Pecho', [[60, 8], [60, 8]]),
    '2026-03-04': dayLog('Press banca', 'Pecho', [[65, 8]]),
    '2026-03-06': dayLog('Press banca', 'Pecho', [[70, 8]]),
  };

  it('métricas monótonas y fecha de desbloqueo coherente', () => {
    const ctx = ctxWith(log);
    expect(computeMetrics(ctx, '2026-03-03').sessions).toBeLessThanOrEqual(computeMetrics(ctx, '2026-03-10').sessions);
    const report = buildReport(ctx);
    const first = report.achievements.find((a) => a.def.id === 'disc-1');
    expect(first?.unlockedAt).toBe('2026-03-02');
    expect(report.level.xp).toBeGreaterThan(0);
    expect(report.muscles.find((m) => m.muscle === 'Pecho')!.score).toBeGreaterThan(report.muscles.find((m) => m.muscle === 'Piernas')!.score);
  });

  it('los datos vacíos no rompen el informe', () => {
    const report = buildReport(ctxWith({}));
    expect(report.unlockedCount).toBe(0);
    expect(report.logos.total).toBeGreaterThanOrEqual(0);
    expect(report.cups).toHaveLength(11);
  });

  it('los logros desbloqueados no se duplican', () => {
    const ids = buildReport(ctxWith(log)).achievements.map((a) => a.def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('clasificación y estado', () => {
  const entries = [
    { id: 'a', name: 'A', visibility: 'public' as const, hideRankings: false, logos: 500, muscles: {} },
    { id: 'b', name: 'B', visibility: 'private' as const, hideRankings: false, logos: 900, muscles: {} },
    { id: 'c', name: 'C', visibility: 'private' as const, hideRankings: false, logos: 100, muscles: {}, self: true },
  ];

  it('oculta perfiles privados salvo el propio', () => {
    const rows = buildLeaderboard(entries, 'logos');
    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
    expect(rows[1].self).toBe(true);
  });

  it('normaliza estado corrupto', () => {
    expect(normalizeGamState('basura')).toEqual(defaultGamState());
    expect(normalizeGamState({ visibility: 'x', custom: [{ id: 1 }] }).visibility).toBe('private');
  });
});

