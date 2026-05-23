// ─────────────────────────────────────────────────────────────────────────────
// Invariant: ON DELETE CASCADE chains down the entire ownership tree.
//
// Why it matters for Atlas:
//   When a user is deleted (e.g. GDPR right-to-erasure, account closure), we
//   must remove all their derived data — routines, workouts, sessions, PRs.
//   Leaving orphan rows would be a privacy violation and a slow data leak.
//   Similarly, deleting a Workout must clean up its planned exercises and
//   sets so we don't accumulate dangling configuration.
//
// What would break without this:
//   Stale routines/workouts would persist forever, the `Routine.userId` FK
//   would point at a nonexistent user, and queries like "list user's
//   workouts" would either explode (FK violation on read) or quietly return
//   ghost data.
//
// What's tested here:
//   • Deleting User → cascades to Routines (and their Workouts via Routine),
//     WorkoutSessions, PersonalRecords.
//   • Deleting Workout → cascades to WorkoutExercises → ExerciseSets.
//   • Exercise itself is NOT deleted (it lives in the shared library) —
//     we verify the exercise survives a user deletion.
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

describe('cascade deletes', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await disconnect();
  });

  it('deleting a User cascades to Routines, Workouts, Sessions, PersonalRecords', async () => {
    console.log('[test] delete user cascades to all owned data — START');

    // Build a fully populated user graph:
    //   User → Routine → Workout
    //   User → WorkoutSession (refs Workout, no cascade on Workout side)
    //   User → PersonalRecord
    const user = await makeUser();
    const exercise = await makeExercise();
    const routine = await makeRoutine(user.id);
    const workout = await makeWorkout(routine.id);
    await makeWorkoutExercise(workout.id, exercise.id);

    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        workoutId: workout.id,
      },
    });

    await prisma.personalRecord.create({
      data: {
        userId: user.id,
        exerciseId: exercise.id,
        weight: 100,
        reps: 5,
      },
    });

    // Snapshot counts BEFORE delete so the assertion message is informative.
    const before = await counts(user.id);
    console.log('[setup] pre-delete counts:', before);
    expect(before.routines).toBe(1);
    expect(before.workouts).toBe(1);
    expect(before.sessions).toBe(1);
    expect(before.prs).toBe(1);

    console.log('[assert] deleting user — should cascade');
    await prisma.user.delete({ where: { id: user.id } });

    const after = await counts(user.id);
    console.log('[assert] post-delete counts (expect all 0):', after);
    expect(after.routines).toBe(0);
    expect(after.workouts).toBe(0);
    expect(after.sessions).toBe(0);
    expect(after.prs).toBe(0);

    // Exercise library should NOT be touched — it's shared.
    const exerciseStillThere = await prisma.exercise.findUnique({ where: { id: exercise.id } });
    console.log(`[assert] exercise library row survives: ${exerciseStillThere !== null}`);
    expect(exerciseStillThere).not.toBeNull();
  });

  it('deleting a Workout cascades to WorkoutExercises and ExerciseSets', async () => {
    console.log('[test] delete workout cascades to WorkoutExercise + ExerciseSet — START');

    const user = await makeUser();
    const exercise = await makeExercise();
    const routine = await makeRoutine(user.id);
    const workout = await makeWorkout(routine.id);
    const we = await makeWorkoutExercise(workout.id, exercise.id);

    await prisma.exerciseSet.createMany({
      data: [
        { workoutExerciseId: we.id, setNumber: 1, targetReps: 5 },
        { workoutExerciseId: we.id, setNumber: 2, targetReps: 5 },
        { workoutExerciseId: we.id, setNumber: 3, targetReps: 5 },
      ],
    });

    const weBefore = await prisma.workoutExercise.count({ where: { workoutId: workout.id } });
    const setsBefore = await prisma.exerciseSet.count({ where: { workoutExerciseId: we.id } });
    console.log(`[setup] pre-delete: workoutExercises=${weBefore}, sets=${setsBefore}`);
    expect(weBefore).toBe(1);
    expect(setsBefore).toBe(3);

    console.log('[assert] deleting workout — WE + sets should disappear');
    await prisma.workout.delete({ where: { id: workout.id } });

    const weAfter = await prisma.workoutExercise.count({ where: { workoutId: workout.id } });
    const setsAfter = await prisma.exerciseSet.count({ where: { workoutExerciseId: we.id } });
    console.log(`[assert] post-delete: workoutExercises=${weAfter} (expect 0), sets=${setsAfter} (expect 0)`);
    expect(weAfter).toBe(0);
    expect(setsAfter).toBe(0);
  });
});

/** Count owned rows for a given user — used for before/after cascade assertions. */
async function counts(userId: string): Promise<{
  routines: number;
  workouts: number;
  sessions: number;
  prs: number;
}> {
  const [routines, workouts, sessions, prs] = await Promise.all([
    prisma.routine.count({ where: { userId } }),
    prisma.workout.count({ where: { routine: { userId } } }),
    prisma.workoutSession.count({ where: { userId } }),
    prisma.personalRecord.count({ where: { userId } }),
  ]);
  return { routines, workouts, sessions, prs };
}
