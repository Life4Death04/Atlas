// ─────────────────────────────────────────────────────────────────────────────
// App factory (REQ-1, REQ-11)
//
// createApp(deps) returns a configured Express instance with all middleware
// and module routers mounted — but does NOT call app.listen().
//
// This is the test seam: supertest imports createApp() directly without
// binding a TCP port, keeping tests fast and port-collision-free.
//
// Middleware order (design §1):
//   helmet → cors → requestId → pinoHttp
//     → /api router: (rateLimit → bodyParser → modules) → notFound → errorHandler
// ─────────────────────────────────────────────────────────────────────────────

import express, { type Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Env } from './config/env.schema.js';
import { buildErrorMiddleware } from './middlewares/error.middleware.js';
import { requestId } from './middlewares/request-id.middleware.js';
import { buildRequestLogger } from './middlewares/request-logger.middleware.js';
import { notFound } from './middlewares/not-found.middleware.js';
import { buildRateLimit } from './middlewares/rate-limit.middleware.js';
import { healthModule } from './modules/health/index.js';

export type Logger = {
  // Pino-compatible signature: (obj, msg?) or (msg)
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
  fatal?: (obj: unknown, msg?: string) => void;
  child?: (bindings: Record<string, unknown>) => Logger;
};

// Duck-typed minimum interface: covers what createApp actually uses, and is
// narrow enough on parameters that real PrismaClient is structurally assignable
// (TS function-parameter contravariance — see `server.ts` createApp call).
// Keep this decoupled from `@prisma/client` types so app.ts stays test-friendly.
export type PrismaLike = {
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>;
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
  const { env, logger } = deps;
  const app = express();

  // ── Global middleware (REQ-6, design §6) ─────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

  // requestId MUST come before pinoHttp (so customProps can read req.requestId)
  app.use(requestId);

  // pinoHttp MUST come before routes (so req.log is available in handlers)
  app.use(buildRequestLogger(logger));

  // ── API router ────────────────────────────────────────────────────────────
  const apiRouter = express.Router();

  // Rate limiter MUST come before body parser to reject over-limit requests early.
  // Mounted on /api sub-router so req.path is relative (R4): '/health' not '/api/health'.
  // Health and ready paths are skipped via the rate-limit skip predicate.
  apiRouter.use(buildRateLimit(env));

  // Body parser — limit configurable via env (REQ-9)
  // Mounted on the /api sub-router, not globally
  apiRouter.use(express.json({ limit: env.BODY_LIMIT }));

  // ── Module routers (REQ-11 — one declarative list) ────────────────────────
  // Adding a new module requires only appending to this array.
  // No per-module imports scattered across the file.
  const modules: Module[] = [healthModule(deps)];
  for (const m of modules) {
    apiRouter.use('/', m.router);
  }

  app.use('/api', apiRouter);

  // notFound MUST be after all routes but BEFORE the error handler
  app.use(notFound);

  // ── Error handler (must be last) ──────────────────────────────────────────
  app.use(buildErrorMiddleware(deps.logger, deps.env));

  return app;
}
