// ─────────────────────────────────────────────────────────────────────────────
// Invariant: each Routine can be the active routine of AT MOST ONE User.
//
// Why it matters for Atlas:
//   The product concept is "one active routine per user". A user can switch
//   between their own routines, but the same Routine row pointing to two
//   different users would create UI ambiguity ("whose active routine is this?")
//   and make "current workout" queries non-deterministic.
//
// What the schema enforces:
//   User.activeRoutineId is declared `@unique`, so the DB itself rejects two
//   users with the same activeRoutineId.
//
// What the schema does NOT enforce (deliberately documented below):
//   The DB does not check that activeRoutineId points to a Routine owned by
//   the same User. Cross-user assignment is a SERVICE-LAYER concern — the
//   application must verify `routine.userId === user.id` before setting
//   activeRoutineId.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, truncateAll, disconnect } from '../helpers/db.js';
import { makeUser, makeRoutine } from '../helpers/factories.js';

describe('active routine invariants', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await disconnect();
  });

  it('user can switch activeRoutineId between two of their own routines', async () => {
    console.log('[test] user can switch activeRoutineId between two own routines — START');

    const user = await makeUser();
    const routineA = await makeRoutine(user.id, { name: 'Routine A' });
    const routineB = await makeRoutine(user.id, { name: 'Routine B' });
    console.log(`[setup] user=${user.id} routineA=${routineA.id} routineB=${routineB.id}`);

    console.log('[assert] set active routine to A');
    const afterA = await prisma.user.update({
      where: { id: user.id },
      data: { activeRoutineId: routineA.id },
    });
    expect(afterA.activeRoutineId).toBe(routineA.id);

    console.log('[assert] switch active routine to B');
    const afterB = await prisma.user.update({
      where: { id: user.id },
      data: { activeRoutineId: routineB.id },
    });
    expect(afterB.activeRoutineId).toBe(routineB.id);
  });

  it('two users CANNOT both point activeRoutineId at the same routine', async () => {
    console.log('[test] activeRoutineId unique across users — START');

    const userA = await makeUser();
    const userB = await makeUser();
    const sharedRoutine = await makeRoutine(userA.id);
    console.log(`[setup] userA=${userA.id} userB=${userB.id} routine=${sharedRoutine.id}`);

    console.log('[assert] userA gets activeRoutineId first — should succeed');
    await prisma.user.update({
      where: { id: userA.id },
      data: { activeRoutineId: sharedRoutine.id },
    });

    console.log('[assert] userB tries to claim the same routine — should throw');
    await expect(
      prisma.user.update({
        where: { id: userB.id },
        data: { activeRoutineId: sharedRoutine.id },
      }),
    ).rejects.toThrow();
    // NOTE: Prisma surfaces this as a P2002 unique constraint error. We don't
    // pin the exact message so the test stays resilient to Prisma version
    // wording changes — what matters is that the DB rejects the write.
  });

  // ───────────────────────────────────────────────────────────────────────────
  // IMPORTANT DOCUMENTATION FOR FUTURE READERS
  //
  // The schema does NOT enforce that a User's activeRoutineId belongs to a
  // Routine they own. The following is currently legal at the database level:
  //
  //   userA.activeRoutineId = routineOwnedByUserB.id
  //
  // It is the responsibility of the SERVICE LAYER (e.g. a routines service or
  // a setActiveRoutine controller) to verify ownership before issuing the
  // update. If we ever want DB-level enforcement, options are:
  //   • Drop the FK and validate purely in code (loses referential integrity)
  //   • Add a composite FK + check constraint (Prisma doesn't model this
  //     directly — would require a raw SQL migration)
  //   • Add a trigger (also raw SQL)
  // For now, application-level enforcement is the chosen tradeoff.
  // ───────────────────────────────────────────────────────────────────────────
});
