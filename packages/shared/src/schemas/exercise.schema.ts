import { z } from 'zod';

export const muscleGroupSchema = z.enum([
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'core', 'quads', 'hamstrings', 'glutes', 'calves', 'full_body',
]);

export const equipmentSchema = z.enum([
  'barbell', 'dumbbell', 'cable', 'machine',
  'bodyweight', 'kettlebell', 'resistance_band', 'other',
]);

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const exerciseFilterSchema = z.object({
  muscleGroup: muscleGroupSchema.optional(),
  equipment: equipmentSchema.optional(),
  difficulty: difficultySchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ExerciseFilterInput = z.infer<typeof exerciseFilterSchema>;
