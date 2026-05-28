// ─────────────────────────────────────────────────────────────────────────────
// Server entry point — process lifecycle owner.
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
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';

const app = createApp({ env, logger, prisma });

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`Server running on ${env.HOST}:${env.PORT} [${env.NODE_ENV}]`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Full shutdown() pure function will be implemented in T-10 (slice 2).
// This stub handles SIGTERM/SIGINT and ensures clean shutdown for now.

let shuttingDown = false;

const onSignal = (sig: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ sig }, 'shutdown: received signal, stopping server');

  server.close(() => {
    prisma.$disconnect()
      .then(() => {
        logger.info('shutdown: complete');
        process.exit(0);
      })
      .catch((err) => {
        logger.error({ err }, 'shutdown: prisma disconnect failed');
        process.exit(1);
      });
  });
};

process.on('SIGTERM', onSignal);
process.on('SIGINT', onSignal);
