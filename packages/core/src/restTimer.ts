export interface RestTimerState {
  isRunning: boolean;
  secondsLeft: number;
  totalSeconds: number;
}

export function createRestTimer(totalSeconds: number): RestTimerState {
  return {
    isRunning: false,
    secondsLeft: totalSeconds,
    totalSeconds,
  };
}

export function tickRestTimer(timer: RestTimerState): RestTimerState {
  if (!timer.isRunning || timer.secondsLeft <= 0) {
    return timer;
  }

  return {
    ...timer,
    secondsLeft: Math.max(0, timer.secondsLeft - 1),
    isRunning: timer.secondsLeft - 1 > 0,
  };
}

export function startRestTimer(timer: RestTimerState): RestTimerState {
  if (timer.secondsLeft <= 0) {
    return { ...timer, isRunning: false, secondsLeft: timer.totalSeconds };
  }

  return { ...timer, isRunning: true };
}

export function pauseRestTimer(timer: RestTimerState): RestTimerState {
  return { ...timer, isRunning: false };
}

export function resetRestTimer(timer: RestTimerState): RestTimerState {
  return { ...timer, isRunning: false, secondsLeft: timer.totalSeconds };
}

export function formatRestTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
