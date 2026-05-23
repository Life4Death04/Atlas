import type { DifficultyLevel, Equipment, ExerciseCategory, ExerciseSource, MuscleGroup } from '../../generated/prisma/client.js';
import type { AscendExercise } from './ascendapi.client.js';

// ─── Mapping tables ───────────────────────────────────────────────────────────

// API's specific muscle names → our MuscleGroup enum
const MUSCLE_MAP: Record<string, MuscleGroup> = {
  // chest
  pectorals: 'chest',
  'serratus anterior': 'chest',
  chest: 'chest',
  // back
  lats: 'back',
  'upper back': 'back',
  trapezius: 'back',
  spine: 'back',
  'levator scapulae': 'back',
  back: 'back',
  rhomboids: 'back',
  // shoulders
  delts: 'shoulders',
  deltoids: 'shoulders',
  shoulders: 'shoulders',
  // biceps
  biceps: 'biceps',
  'biceps brachii': 'biceps',
  // triceps
  triceps: 'triceps',
  'triceps brachii': 'triceps',
  // forearms
  forearms: 'forearms',
  brachioradialis: 'forearms',
  'wrist extensors': 'forearms',
  'wrist flexors': 'forearms',
  // core
  abs: 'core',
  core: 'core',
  'hip flexors': 'core',
  obliques: 'core',
  'transverse abdominis': 'core',
  // quads
  quadriceps: 'quads',
  quads: 'quads',
  adductors: 'quads',
  abductors: 'quads',
  // hamstrings
  hamstrings: 'hamstrings',
  // glutes
  glutes: 'glutes',
  'gluteus maximus': 'glutes',
  'gluteus medius': 'glutes',
  // calves
  calves: 'calves',
  'gastrocnemius': 'calves',
  soleus: 'calves',
  ankles: 'calves',
  feet: 'calves',
  // full_body
  'cardiovascular system': 'full_body',
  neck: 'full_body',
};

// API's broad bodyPart names → our MuscleGroup enum
// Used as primary mapping; targetMuscles resolves ambiguous cases like "upper arms"
const BODYPART_MAP: Record<string, MuscleGroup> = {
  back: 'back',
  cardio: 'full_body',
  chest: 'chest',
  'lower arms': 'forearms',
  'lower legs': 'calves',
  neck: 'full_body',
  shoulders: 'shoulders',
  'upper arms': 'full_body', // resolved below via targetMuscles
  'upper legs': 'full_body', // resolved below via targetMuscles
  waist: 'core',
};

// API equipment names → our Equipment enum
const EQUIPMENT_MAP: Record<string, Equipment> = {
  assisted: 'other',
  band: 'resistance_band',
  'resistance band': 'resistance_band',
  barbell: 'barbell',
  'ez barbell': 'barbell',
  'olympic barbell': 'barbell',
  'trap bar': 'barbell',
  'body weight': 'bodyweight',
  cable: 'cable',
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  'leverage machine': 'machine',
  'smith machine': 'machine',
  'sled machine': 'machine',
  'skierg machine': 'machine',
  'stepmill machine': 'machine',
  'stationary bike': 'machine',
  'upper body ergometer': 'machine',
  'bosu ball': 'other',
  'medicine ball': 'other',
  roller: 'other',
  rope: 'other',
  'stability ball': 'other',
  tire: 'other',
  weighted: 'other',
  'wheel roller': 'other',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapMuscleGroup(raw: AscendExercise): MuscleGroup {
  // First try to resolve from targetMuscles (most specific)
  for (const m of raw.targetMuscles) {
    const mapped = MUSCLE_MAP[m.toLowerCase()];
    if (mapped) return mapped;
  }
  // Fall back to bodyParts
  for (const b of raw.bodyParts) {
    const mapped = BODYPART_MAP[b.toLowerCase()];
    if (mapped && mapped !== 'full_body') return mapped;
  }
  return 'full_body';
}

function mapSecondaryMuscles(raw: AscendExercise): MuscleGroup[] {
  const primary = mapMuscleGroup(raw);
  const seen = new Set<MuscleGroup>([primary]);
  const result: MuscleGroup[] = [];

  for (const m of raw.secondaryMuscles) {
    const mapped = MUSCLE_MAP[m.toLowerCase()];
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      result.push(mapped);
    }
  }
  return result;
}

function mapEquipment(raw: AscendExercise): Equipment {
  for (const e of raw.equipments) {
    const mapped = EQUIPMENT_MAP[e.toLowerCase()];
    if (mapped) return mapped;
  }
  return 'other';
}

function mapCategory(raw: AscendExercise): ExerciseCategory {
  if (raw.bodyParts.includes('cardio')) return 'cardio';
  // Compound heuristic: exercises targeting 2+ distinct muscle groups
  const distinctMuscles = new Set([...raw.targetMuscles, ...raw.secondaryMuscles]).size;
  return distinctMuscles >= 3 ? 'compound' : 'isolation';
}

// ─── Main transform ───────────────────────────────────────────────────────────

export interface TransformedExercise {
  externalId: string;
  name: string;
  description: null;
  category: ExerciseCategory;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: DifficultyLevel;
  externalSource: ExerciseSource;
  lastSyncedAt: Date;
}

export function transformExercise(raw: AscendExercise): TransformedExercise {
  return {
    externalId: `edb_${raw.exerciseId}`,
    name: raw.name,
    description: null,
    category: mapCategory(raw),
    muscleGroup: mapMuscleGroup(raw),
    secondaryMuscles: mapSecondaryMuscles(raw),
    equipment: mapEquipment(raw),
    difficulty: 'intermediate' as DifficultyLevel,
    externalSource: 'exercisedb' as ExerciseSource,
    lastSyncedAt: new Date(),
  };
}
