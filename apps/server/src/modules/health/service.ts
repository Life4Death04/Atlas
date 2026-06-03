// ─────────────────────────────────────────────────────────────────────────────
// Readiness check service (REQ-3, design §11)
//
// readinessCheck(prisma, timeoutMs):
//   - Races a DB ping against a timeout
//   - Returns { ok: true } on success, { ok: false, error } on failure/timeout
//   - Pure async function — easy to unit test with mock prisma
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaLike } from '../../app.js';

export type ReadinessResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Ping the database and race against a timeout.
 *
 * @param prisma  - Prisma client (or compatible mock)
 * @param timeoutMs - Max ms to wait for DB response before returning { ok: false }
 */
export async function readinessCheck(
  prisma: PrismaLike,
  timeoutMs: number,
): Promise<ReadinessResult> {
  const ping = prisma.$queryRaw`SELECT 1`.then(() => ({ ok: true } as const));

  const timeout = new Promise<{ ok: false; error: string }>((resolve) =>
    setTimeout(() => resolve({ ok: false, error: 'db_timeout' }), timeoutMs),
  );

  try {
    return await Promise.race([ping, timeout]);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'db_error' };
  }
}
