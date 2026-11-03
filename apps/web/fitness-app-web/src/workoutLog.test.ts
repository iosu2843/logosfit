import { describe, expect, it } from 'vitest';
import { currentStreak, estimateOneRepMax, isDayCompleted, isDayStarted, recentSessions, recordIds, recoveryWarnings, sessionVolume, setExerciseProgress, suggestNextWeight, suggestRestSeconds, volumeByGroup, weeklyAdherence, type WorkoutLog } from './workoutLog';

const day = { name: 'Martes', type: 'Push' };
const planned = [{ name: 'Press banca' }, { name: 'Fondos' }];

describe('workout log', () => {
  it('marks a day complete only when every planned exercise reached its sets', () => {
    let log: WorkoutLog = setExerciseProgress({}, '2026-11-03', day, 'Press banca', { sets: 3, target: 3, weight: 60 });
    expect(isDayStarted(log['2026-11-03'])).toBe(true);
    expect(isDayCompleted(planned, log['2026-11-03'])).toBe(false);
    log = setExerciseProgress(log, '2026-11-03', day, 'Fondos', { sets: 3, target: 3, weight: 0 });
    expect(isDayCompleted(planned, log['2026-11-03'])).toBe(true);
  });

  it('computes volume and lists the latest sessions first', () => {
    let log: WorkoutLog = setExerciseProgress({}, '2026-11-01', day, 'Press banca', { sets: 2, target: 3, weight: 50 });
    log = setExerciseProgress(log, '2026-11-03', day, 'Press banca', { sets: 3, target: 3, weight: 60 });
    expect(sessionVolume(log['2026-11-03'])).toBe(180);
    expect(recentSessions(log).map((item) => item.date)).toEqual(['2026-11-03', '2026-11-01']);
  });
});

describe('progression, records and recovery', () => {
  const plan = {
    1: { exercises: [{ name: 'Press banca', group: 'Pecho' }] },
    2: { exercises: [{ name: 'Press inclinado', group: 'Pecho' }] },
  };
  const mon = { name: 'Lunes', type: 'Push' };

  it('suggests +2.5 kg after a fully completed exercise and keeps load otherwise', () => {
    const done = setExerciseProgress({}, '2026-11-02', mon, 'Press banca', { sets: 2, target: 2, weight: 60, group: 'Pecho', setLogs: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }] });
    expect(suggestNextWeight(done, { name: 'Press banca', group: 'Pecho' }, { reps: 10 }, '2026-11-09')).toMatchObject({ weight: 62.5, increased: true });
    const missed = setExerciseProgress({}, '2026-11-02', mon, 'Press banca', { sets: 2, target: 2, weight: 60, group: 'Pecho', setLogs: [{ weight: 60, reps: 10 }, { weight: 60, reps: 7 }] });
    expect(suggestNextWeight(missed, { name: 'Press banca', group: 'Pecho' }, { reps: 10 }, '2026-11-09')).toMatchObject({ weight: 60, increased: false });
    expect(suggestNextWeight({}, { name: 'Press banca' }, { reps: 10 }, '2026-11-09')).toBeNull();
  });

  it('estimates 1RM, records and rest by group', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(80, 10)).toBe(106.7);
    expect(recordIds([{ id: 'a', value: 50 }, { id: 'b', value: 60 }, { id: 'c', value: 55 }]).has('b')).toBe(true);
    expect(suggestRestSeconds('Cuádriceps')).toBe(120);
    expect(suggestRestSeconds('Bíceps')).toBe(60);
  });

  it('computes adherence, streak and volume per group', () => {
    const log = setExerciseProgress(setExerciseProgress({}, '2026-11-02', mon, 'Press banca', { sets: 3, target: 3, weight: 60, group: 'Pecho', setLogs: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }, { weight: 60, reps: 10 }] }), '2026-11-03', { name: 'Martes', type: 'Push' }, 'Press inclinado', { sets: 1, target: 3, weight: 40, group: 'Pecho' });
    const monday = new Date('2026-11-02T12:00:00');
    expect(weeklyAdherence(plan, log, monday)).toEqual({ planned: 2, completed: 1 });
    expect(currentStreak(plan, log, new Date('2026-11-03T12:00:00'))).toBe(1);
    expect(volumeByGroup(log, '2026-11-01', '2026-11-07').Pecho).toEqual({ sets: 4, volume: 1800 + 40 });
  });

  it('warns about training the same group on consecutive days', () => {
    const log = setExerciseProgress({}, '2026-11-02', mon, 'Press banca', { sets: 3, target: 3, weight: 60, group: 'Pecho' });
    const warnings = recoveryWarnings(plan, log, new Date('2026-11-03T12:00:00'), new Date('2026-11-03T12:00:00'));
    expect(warnings[0]).toContain('Pecho');
  });
});
