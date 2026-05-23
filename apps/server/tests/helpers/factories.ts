// ─────────────────────────────────────────────────────────────────────────────
// Test factories.
//
// What is a factory?
//   A small function that creates a valid model row with sensible defaults so
//   tests don't have to hand-write every field. Each factory:
//     • Fills required fields with random/unique values
//     • Accepts an `overrides` object to customize specific fields per test
//     • Returns the persisted row
//
// Why we use them:
//   Without factories, every test repeats the same boilerplate ("make a user
//   with auth0Id… and email… and routine with…"). Factories keep tests
//   focused on the invariant being tested instead of the data setup.
//
// Uniqueness:
//   We use `crypto.randomUUID()` to guarantee unique emails / auth0Ids
//   across tests in the same process — no faker dependency needed. Tests
//   that need a specific value just pass it via `overrides`.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import { prisma } from './db.js';

// Override types use the same shape Prisma's `create({ data })` accepts.
// We keep them loose (`Record<string, unknown>`) on purpose — tightly typing
// each factory's overrides to the Prisma Create input adds friction for very
// little safety in tests. If a test passes a bad field, Prisma will throw at
// runtime with a clear error.
type Overrides = Record<string, unknown>;

/** Create a User with random unique auth0Id + email. */
export async function makeUser(overrides: Overrides = {}) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      auth0Id: `auth0|${id}`,
      email: `user-${id}@test.local`,
      ...overrides,
    },
  });
}

/** Create an Exercise with all required fields populated. */
export async function makeExercise(overrides: Overrides = {}) {
  const id = randomUUID();
  return prisma.exercise.create({
    data: {
      name: `Test Exercise ${id.slice(0, 8)}`,
      category: 'compound',
      muscleGroup: 'chest',
      equipment: 'barbell',
      difficulty: 'intermediate',
      ...overrides,
    },
  });
}

/** Create a Routine owned by `userId`. */
export async function makeRoutine(userId: string, overrides: Overrides = {}) {
  return prisma.routine.create({
    data: {
      userId,
      name: `Routine ${randomUUID().slice(0, 8)}`,
      ...overrides,
    },
  });
}

/** Create a Workout inside `routineId`. */
export async function makeWorkout(routineId: string, overrides: Overrides = {}) {
  return prisma.workout.create({
    data: {
      routineId,
      name: `Workout ${randomUUID().slice(0, 8)}`,
      ...overrides,
    },
  });
}

/** Create a WorkoutExercise row tying `exerciseId` to `workoutId`. */
export async function makeWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  overrides: Overrides = {},
) {
  return prisma.workoutExercise.create({
    data: {
      workoutId,
      exerciseId,
      ...overrides,
    },
  });
}
