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

export type Exercise = {
  id: string;
  name: string;
  description: string | null;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: DifficultyLevel;
  instructions: string[];
  imageUrl: string | null;
  videoUrl: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Routine = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isActive: boolean;
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
  sets: number;
  reps: number | null;
  weight: number | null;
  restSeconds: number | null;
  notes: string | null;
};
