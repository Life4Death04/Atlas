// ─────────────────────────────────────────────────────────────────────────────
// App factory (REQ-1, REQ-11)
//
// createApp(deps) returns a configured Express instance with all middleware
// and module routers mounted — but does NOT call app.listen().
//
// This is the test seam: supertest imports createApp() directly without
// binding a TCP port, keeping tests fast and port-collision-free.
//
// Boot sequence (server.ts):
//   loadEnv → buildLogger → buildPrismaClient → createApp(deps)
//     → app.listen(env.PORT, env.HOST) → registerShutdownHooks(...)
// ─────────────────────────────────────────────────────────────────────────────

import express, { type Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Env } from './config/env.schema.js';
import { buildErrorMiddleware } from './middlewares/error.middleware.js';

export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export type PrismaLike = {
  $queryRaw: (...args: unknown[]) => Promise<unknown>;
  $disconnect: () => Promise<void>;
};

export type ModuleDeps = {
  env: Env;
  logger: Logger;
  prisma: PrismaLike;
};

export type Module = {
  basePath: string;
  router: Router;
};

/**
 * Build and return a configured Express application.
 *
 * All middleware and module routers are mounted here. No I/O side effects.
 */
export function createApp(deps: ModuleDeps): express.Application {
  const { env } = deps;
  const app = express();

  // ── Global middleware ─────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

  // ── API router ────────────────────────────────────────────────────────────
  const apiRouter = express.Router();

  // Body parser — limit configurable via env (REQ-9)
  apiRouter.use(express.json({ limit: env.BODY_LIMIT }));

  // ── Health route (temporary inline — REQ-2, REQ-12) ──────────────────────
  // This inline route is a placeholder until T-5 extracts it to
  // src/modules/health/ in slice 2. It satisfies REQ-2 and REQ-12 today.
  apiRouter.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.use('/api', apiRouter);

  // ── Error handler (must be last) ──────────────────────────────────────────
  app.use(buildErrorMiddleware(deps.logger));

  return app;
}
