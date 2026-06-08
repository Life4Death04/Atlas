// ─────────────────────────────────────────────────────────────────────────────
// Pure graceful-shutdown function (C2 — extracted from server.ts)
//
// This module has ZERO module-level side effects: no dotenv, no env parse,
// no PrismaClient instantiation, no TCP bind, no signal registration.
//
// It is the only export that unit tests need to import in order to test
// the shutdown behaviour without triggering server.ts side effects.
//
// Design ref: design §10 (Graceful Shutdown)
// ─────────────────────────────────────────────────────────────────────────────

import type http from 'node:http';
import type { Logger } from '../app.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShutdownDeps = {
  server: http.Server;
  prisma: { $disconnect: () => Promise<void> };
  logger: Logger;
  timeoutMs: number;
};

// ── Pure shutdown function (design §10) ───────────────────────────────────────

/**
 * Gracefully shut down the server.
 *
 * Call order:
 *   1. Set a force-exit timeout (unref'd — won't keep process alive on its own).
 *   2. Stop accepting new connections (server.close).
 *   3. Disconnect from the database (prisma.$disconnect).
 *   4. Clear the force-exit timeout.
 *   5. Return 0 (clean exit).
 *
 * If the drain takes longer than timeoutMs, logs a warning and exits 1 immediately.
 * This is exported for unit-testing; the signal wiring lives in server.ts.
 *
 * @param reason   - Signal name or reason string for logging.
 * @param deps     - Injectable dependencies (server, prisma, logger, timeoutMs).
 * @returns        - Exit code (0 = clean, 1 = forced).
 */
export async function shutdown(reason: string, deps: ShutdownDeps): Promise<number> {
  const { server, prisma: prismaClient, logger, timeoutMs } = deps;

  logger.info({ reason }, 'shutdown: stopping accept');

  // Force-exit timer — unref'd so it doesn't prevent a clean exit
  const forceExit = setTimeout(() => {
    logger.warn({ timeoutMs }, 'shutdown: drain timeout, forcing exit');
    process.exit(1);
  }, timeoutMs);
  forceExit.unref();

  // Stop accepting new connections; wait for existing ones to finish
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // Disconnect from the database
  await prismaClient.$disconnect();

  // Cancel the force-exit timer (clean drain completed)
  clearTimeout(forceExit);

  logger.info('shutdown: complete');
  return 0;
}
