// ─────────────────────────────────────────────────────────────────────────────
// Invariants for required fields and Postgres enum constraints.
//
// Why they matter for Atlas:
//   • PersonalRecord is meaningless without a user + exercise. Missing FKs
//     would corrupt the leaderboard / progression graph.
//   • The `ExerciseSource` enum no longer includes `wger` — we dropped that
//     integration. Postgres rejects unknown enum values at INSERT time. If
//     a future migration accidentally re-introduced `wger` (or renamed the
//     enum), this test fails fast.
//   • ExerciseCategory must reject typos like 'cardiosomething' — guarding
//     against bugs where the app passes a free-form string.
//
// What would break without these tests:
//   We could silently lose referential integrity (orphan PRs) or accept bad
//   enum values (UI rendering ?? for unknown category).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, truncateAll, disconnect } from '../helpers/db.js';
import { makeUser, makeExercise } from '../helpers/factories.js';

describe('enum and NOT NULL invariants', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await disconnect();
  });

  it('PersonalRecord requires userId AND exerciseId', async () => {
    console.log('[test] PR requires userId + exerciseId — START');

    const user = await makeUser();
    const exercise = await makeExercise();

    // We bypass Prisma's TypeScript checks via $executeRaw because Prisma's
    // generated types refuse to even compile a missing-FK insert. We want to
    // verify the DATABASE rejects it, not just the TS type system.
    console.log('[assert] insert PR without userId — should fail');
    await expect(
      prisma.$executeRaw`
        INSERT INTO "PersonalRecord" ("id", "exerciseId", "weight", "reps", "achievedAt", "createdAt")
        VALUES ('pr_test_no_user', ${exercise.id}, 100, 5, NOW(), NOW())
      `,
    ).rejects.toThrow();

    console.log('[assert] insert PR without exerciseId — should fail');
    await expect(
      prisma.$executeRaw`
        INSERT INTO "PersonalRecord" ("id", "userId", "weight", "reps", "achievedAt", "createdAt")
        VALUES ('pr_test_no_ex', ${user.id}, 100, 5, NOW(), NOW())
      `,
    ).rejects.toThrow();
  });

  it('Exercise.externalSource rejects the removed `wger` value', async () => {
    console.log('[test] externalSource cannot be wger (enum value removed) — START');

    // Use raw SQL to bypass Prisma's TS type which doesn't even include
    // 'wger' as a valid value. The point is to confirm Postgres itself
    // rejects the string — proving the migration that dropped it actually
    // ran against the test DB.
    console.log('[assert] raw insert with externalSource=wger — should throw');
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "Exercise"
          ("id", "name", "category", "muscleGroup", "equipment", "difficulty", "externalSource", "createdAt", "updatedAt")
        VALUES
          ('ex_wger', 'Bench', 'compound', 'chest', 'barbell', 'intermediate', 'wger', NOW(), NOW())
      `),
    ).rejects.toThrow();
  });

  it('Exercise.category rejects an unknown enum value', async () => {
    console.log('[test] ExerciseCategory rejects unknown value — START');

    console.log('[assert] raw insert with category=not_a_real_category — should throw');
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "Exercise"
          ("id", "name", "category", "muscleGroup", "equipment", "difficulty", "createdAt", "updatedAt")
        VALUES
          ('ex_badcat', 'Bench', 'not_a_real_category', 'chest', 'barbell', 'intermediate', NOW(), NOW())
      `),
    ).rejects.toThrow();
  });
});
