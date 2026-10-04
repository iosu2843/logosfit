export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'cardio';

export type WorkoutDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number;
  notes?: string;
  muscleGroup: MuscleGroup;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  difficulty: WorkoutDifficulty;
  durationMinutes: number;
  focus: MuscleGroup[];
  exercises: WorkoutExercise[];
}

export interface WorkoutSession {
  id: string;
  workoutId: string;
  startedAt: string;
  completedAt?: string;
  totalDurationSeconds: number;
  completed: boolean;
}

export const defaultWorkoutPlans: WorkoutPlan[] = [
  {
    id: 'full-body-strength',
    name: 'Full Body Strength',
    difficulty: 'beginner',
    durationMinutes: 35,
    focus: ['chest', 'back', 'legs', 'core'],
    exercises: [
      {
        id: 'push-up',
        name: 'Push Up',
        sets: 3,
        reps: 12,
        restSeconds: 45,
        muscleGroup: 'chest',
      },
      {
        id: 'squat',
        name: 'Bodyweight Squat',
        sets: 3,
        reps: 15,
        restSeconds: 45,
        muscleGroup: 'legs',
      },
      {
        id: 'row',
        name: 'Bent-Over Row',
        sets: 3,
        reps: 12,
        restSeconds: 45,
        muscleGroup: 'back',
      },
    ],
  },
];

export function getWorkoutById(workouts: WorkoutPlan[], workoutId: string): WorkoutPlan | undefined {
  return workouts.find((workout) => workout.id === workoutId);
}

export function calculateWorkoutDuration(exercises: WorkoutExercise[]): number {
  const totalExerciseTime = exercises.reduce((total, exercise) => {
    return total + exercise.sets * (exercise.reps * 2 + exercise.restSeconds);
  }, 0);

  return Math.ceil(totalExerciseTime / 60);
}
