import { describe, expect, it } from 'vitest';
import { isDayCompleted, isDayStarted, recentSessions, sessionVolume, setExerciseProgress, type WorkoutLog } from './workoutLog';

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
