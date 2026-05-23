// ─────────────────────────────────────────────────────────────────────────────
// Invariants for ExerciseSet:
//   • (workoutExerciseId, setNumber) is UNIQUE — no two sets share a number
//     inside the same exercise.
//   • Sets sort deterministically by `setNumber` (sequence drives lifting).
//
// Why they matter for Atlas:
//   A lifter sees sets as an ordered list ("Set 1, Set 2, Set 3"). If we
//   allowed two "Set 2" rows, the UI would render duplicates and PR
//   calculations would double-count. Likewise, if we return sets in random
//   order, the warmup-then-working-set logic breaks.
//
// What would break without these tests:
//   A naive `.create({ setNumber: 2 })` in a "duplicate set" feature could
//   accidentally land without the @@unique, and we'd ship corrupted set
//   ordering.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, truncateAll, disconnect } from '../helpers/db.js';
import {
  makeUser,
  makeExercise,
  makeRoutine,
  makeWorkout,
  makeWorkoutExercise,
} from '../helpers/factories.js';

describe('exercise set ordering', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await disconnect();
  });

  it('duplicate (workoutExerciseId, setNumber) is rejected', async () => {
    console.log('[test] duplicate setNumber on same workoutExercise rejected — START');

    const user = await makeUser();
    const exercise = await makeExercise();
    const routine = await makeRoutine(user.id);
    const workout = await makeWorkout(routine.id);
    const we = await makeWorkoutExercise(workout.id, exercise.id);

    console.log('[assert] first insert of setNumber=1 — should succeed');
    await prisma.exerciseSet.create({
      data: { workoutExerciseId: we.id, setNumber: 1, targetReps: 5 },
    });

    console.log('[assert] second insert of setNumber=1 — should throw (P2002)');
    await expect(
      prisma.exerciseSet.create({
        data: { workoutExerciseId: we.id, setNumber: 1, targetReps: 8 },
      }),
    ).rejects.toThrow();
  });

  it('sets are returned in setNumber ascending order when requested', async () => {
    console.log('[test] sets ordered by setNumber asc — START');

    const user = await makeUser();
    const exercise = await makeExercise();
    const routine = await makeRoutine(user.id);
    const workout = await makeWorkout(routine.id);
    const we = await makeWorkoutExercise(workout.id, exercise.id);

    // Intentionally insert out of order — the DB must not assume insertion order.
    console.log('[setup] inserting sets in order 3, 1, 2');
    await prisma.exerciseSet.create({ data: { workoutExerciseId: we.id, setNumber: 3 } });
    await prisma.exerciseSet.create({ data: { workoutExerciseId: we.id, setNumber: 1 } });
    await prisma.exerciseSet.create({ data: { workoutExerciseId: we.id, setNumber: 2 } });

    const sets = await prisma.exerciseSet.findMany({
      where: { workoutExerciseId: we.id },
      orderBy: { setNumber: 'asc' },
    });

    const numbers = sets.map((s) => s.setNumber);
    console.log(`[assert] returned order = [${numbers.join(', ')}] (expect [1, 2, 3])`);
    expect(numbers).toEqual([1, 2, 3]);
  });
});
