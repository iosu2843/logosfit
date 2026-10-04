export type CoachTone = 'encouraging' | 'motivating' | 'focused';

export interface AIInsight {
  message: string;
  tone: CoachTone;
  confidence: number;
}

export interface WorkoutProgress {
  completedWorkouts: number;
  weeklyGoal: number;
  averageRecovery: number;
  consistencyScore: number;
}

export function generateCoachMessage(progress: WorkoutProgress): AIInsight {
  const ratio = progress.completedWorkouts / Math.max(progress.weeklyGoal, 1);

  if (ratio >= 1) {
    return {
      message: 'Excellent consistency this week. You are on track to maintain your momentum.',
      tone: 'motivating',
      confidence: 0.94,
    };
  }

  if (progress.consistencyScore >= 70) {
    return {
      message: 'You are close to hitting your goal. A short, focused session will help you build momentum.',
      tone: 'encouraging',
      confidence: 0.82,
    };
  }

  return {
    message: 'Focus on a smaller, sustainable session. Progress comes from consistency, not perfection.',
    tone: 'focused',
    confidence: 0.76,
  };
}

export function estimateRecoveryStatus(recoveryMinutes: number): 'low' | 'moderate' | 'high' {
  if (recoveryMinutes < 30) return 'low';
  if (recoveryMinutes < 60) return 'moderate';
  return 'high';
}
