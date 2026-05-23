// ─────────────────────────────────────────────────────────────────────────────
// Invariants: workout composition rules that aren't obvious from the schema.
//
// Why they matter for Atlas:
//   • Programs like 5/3/1 or PHUL legitimately use the same exercise twice in
//     one workout (e.g. "bench press heavy" + "bench press back-off"). The
//     schema must NOT block this — and historically people add `@@unique`
//     prematurely. We pin the current behavior with a test so a future "let's
//     just add a uniqueness constraint" PR fails CI loudly.
//
//   • During a live session a user may improvise — add an exercise the plan
//     didn't include. WorkoutSessionExercise.workoutExerciseId is nullable
//     specifically to allow this. The test protects the nullability.
//
// What would break without these tests:
//   Someone could "tighten up" the schema (well-intentioned), break double-
//   exercise programs, and we'd only find out when a user reports a 500.
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

describe('workout invariants', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await disconnect();
  });

  it('the same exercise can appear twice in a workout', async () => {
    console.log('[test] same exercise twice in workout — START');

    const user = await makeUser();
    const exercise = await makeExercise({ name: 'Bench Press' });
    const routine = await makeRoutine(user.id);
    const workout = await makeWorkout(routine.id);

    console.log('[assert] inserting first occurrence');
    const first = await makeWorkoutExercise(workout.id, exercise.id, { order: 0 });
    console.log('[assert] inserting second occurrence — should succeed (no @@unique)');
    const second = await makeWorkoutExercise(workout.id, exercise.id, { order: 1 });

    expect(first.id).not.toBe(second.id);

    const count = await prisma.workoutExercise.count({
      where: { workoutId: workout.id, exerciseId: exercise.id },
    });
    console.log(`[assert] occurrences in workout = ${count} (expect 2)`);
    expect(count).toBe(2);
  });

  it('a session can record an ad-hoc exercise (workoutExerciseId = null)', async () => {
    console.log('[test] session exercise with null workoutExerciseId — START');

    const user = await makeUser();
    const exercise = await makeExercise();
    const routine = await makeRoutine(user.id);
    const workout = await makeWorkout(routine.id);

    const session = await prisma.workoutSession.create({
      data: { userId: user.id, workoutId: workout.id },
    });

    console.log('[assert] creating session exercise without workoutExerciseId');
    const sessionExercise = await prisma.workoutSessionExercise.create({
      data: {
        sessionId: session.id,
        exerciseId: exercise.id,
        // workoutExerciseId intentionally omitted — represents an ad-hoc
        // exercise the user added during the live session.
      },
    });

    console.log(`[assert] workoutExerciseId = ${sessionExercise.workoutExerciseId} (expect null)`);
    expect(sessionExercise.workoutExerciseId).toBeNull();
  });
});
