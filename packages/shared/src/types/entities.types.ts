export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'resistance_band'
  | 'other';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type ExerciseCategory =
  | 'compound'
  | 'isolation'
  | 'cardio'
  | 'stretching'
  | 'plyometric'
  | 'other';

export type ExerciseSource = 'wger' | 'exercisedb' | 'custom';

export type User = {
  id: string;
  auth0Id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  activeRoutineId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Exercise = {
  id: string;
  name: string;
  description: string | null;
  category: ExerciseCategory;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: DifficultyLevel;
  externalId: string | null;
  externalSource: ExerciseSource | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Routine = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Workout = {
  id: string;
  routineId: string;
  name: string;
  dayOfWeek: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutExercise = {
  id: string;
  workoutId: string;
  exerciseId: string;
  order: number;
  restSeconds: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseSet = {
  id: string;
  workoutExerciseId: string;
  setNumber: number;
  targetReps: number | null;
  targetWeight: number | null;
  targetRpe: number | null;
  notes: string | null;
};

export type WorkoutSession = {
  id: string;
  userId: string;
  workoutId: string;
  startedAt: string;
  completedAt: string | null;
  durationSec: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutSessionExercise = {
  id: string;
  sessionId: string;
  exerciseId: string;
  workoutExerciseId: string | null;
  order: number;
  notes: string | null;
};

export type WorkoutSessionSet = {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  plannedReps: number | null;
  actualReps: number | null;
  plannedWeight: number | null;
  actualWeight: number | null;
  completed: boolean;
  completedAt: string | null;
  notes: string | null;
};

export type PersonalRecord = {
  id: string;
  userId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  sessionId: string | null;
  achievedAt: string;
  createdAt: string;
};
