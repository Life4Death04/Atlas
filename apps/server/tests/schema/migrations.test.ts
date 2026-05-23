// ─────────────────────────────────────────────────────────────────────────────
// Invariant: every Prisma migration in `prisma/migrations/` must apply cleanly.
//
// Why it matters for Atlas:
//   Migrations are the schema's source of truth. If one ever lands in a
//   "failed" state (logged_at IS NOT NULL but finished_at IS NULL), the
//   production deploy will refuse to start, and we can lose hours debugging
//   a checksum mismatch. Catching that drift in CI prevents merging a
//   broken migration to main.
//
// What would break without this:
//   A bad migration could slip into main, deploys to staging/prod would
//   fail, and rolling forward requires a manual fix in the production DB —
//   exactly the operational pain a personal project should avoid.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterAll } from 'vitest';
import { prisma, disconnect } from '../helpers/db.js';

describe('migrations', () => {
  afterAll(async () => {
    await disconnect();
  });

  it('all migrations applied without failure', async () => {
    console.log('[test] all migrations applied without failure — START');

    // _prisma_migrations is Prisma's bookkeeping table. Each row represents
    // one migration directory under prisma/migrations/.
    //   • started_at: filled when prisma began applying it
    //   • finished_at: filled when it completed successfully
    //   • logs: error output if it failed
    // If finished_at IS NULL for any row, that migration was never confirmed
    // complete — it's effectively broken.
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM _prisma_migrations
    `;
    const total = Number(rows[0]?.count ?? 0);
    console.log(`[assert] _prisma_migrations row count = ${total} (expect > 0)`);
    expect(total).toBeGreaterThan(0);

    const failed = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM _prisma_migrations WHERE finished_at IS NULL
    `;
    const failedCount = Number(failed[0]?.count ?? 0);
    console.log(`[assert] failed migrations = ${failedCount} (expect 0)`);
    expect(failedCount).toBe(0);
  });
});
