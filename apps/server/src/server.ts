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
import { env } from './config/env.js';
import { buildLogger } from './lib/logger.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';
import { shutdown } from './lib/shutdown.js';

// ── Boot ──────────────────────────────────────────────────────────────────────

const logger = buildLogger(env);

const app = createApp({ env, logger, prisma });

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`Server running on ${env.HOST}:${env.PORT} [${env.NODE_ENV}]`);
  // Emit a machine-readable ready line for integration test stdout listeners (S6).
  // Printed unconditionally — harmless in production, essential for CI test stability.
  process.stdout.write('SERVER_READY\n');
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
