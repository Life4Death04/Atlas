import { z } from 'zod';

export const createRoutineSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateRoutineSchema = createRoutineSchema.partial();

export const createWorkoutSchema = z.object({
  name: z.string().min(1).max(100),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  order: z.number().int().min(0),
});

export const addExerciseToWorkoutSchema = z.object({
  exerciseId: z.string().uuid(),
  order: z.number().int().min(0),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(999).optional(),
  weight: z.number().min(0).optional(),
  restSeconds: z.number().int().min(0).max(600).optional(),
  notes: z.string().max(500).optional(),
});

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type AddExerciseToWorkoutInput = z.infer<typeof addExerciseToWorkoutSchema>;
