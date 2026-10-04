export interface WeightAdjustmentInput {
  lastWeight: number;
  lastReps: number;
}

export function adjustWeight({ lastWeight, lastReps }: WeightAdjustmentInput): number {
  if (lastReps >= 10) return Number((lastWeight + 2.5).toFixed(1));
  if (lastReps >= 8) return Number((lastWeight + 1.25).toFixed(1));
  if (lastReps <= 6) return Number((lastWeight - 2.5).toFixed(1));
  return Number(lastWeight.toFixed(1));
}

export const routines = {
  push: [
    { name: 'Bench Press', sets: 4, reps: 8 },
    { name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
    { name: 'Shoulder Press', sets: 3, reps: 12 },
  ],
};
