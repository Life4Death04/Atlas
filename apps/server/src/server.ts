// ─────────────────────────────────────────────────────────────────────────────
// Server entry point — process lifecycle owner (T-10, REQ-4, design §10)
//
// Responsibilities (and ONLY these):
//   1. Load environment variables (dotenv — must be first)
//   2. Parse and validate env
//   3. Build infrastructure (logger, prisma client)
//   4. Create the Express app via createApp(deps)
//   5. Bind to a TCP port
//   6. Register graceful shutdown handlers
//
// There are NO route definitions here. Routes live in src/app.ts and modules.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import type http from 'node:http';
import { env } from './config/env.js';
import { buildLogger } from './lib/logger.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';
import type { Logger } from './app.js';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShutdownDeps = {
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
 * This is exported for unit-testing; the signal wiring is below.
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

// ── Boot ──────────────────────────────────────────────────────────────────────

const logger = buildLogger(env);

const app = createApp({ env, logger, prisma });

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`Server running on ${env.HOST}:${env.PORT} [${env.NODE_ENV}]`);
});

// ── Signal wiring ─────────────────────────────────────────────────────────────

let shuttingDown = false;

const onSignal = (sig: string): void => {
  if (shuttingDown) return; // ignore duplicate signals
  shuttingDown = true;

  shutdown(sig, {
    server,
    prisma,
    logger,
    timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  })
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      logger.error({ err }, 'shutdown: unexpected error');
      process.exit(1);
    });
};

process.on('SIGTERM', onSignal);
process.on('SIGINT', onSignal);
