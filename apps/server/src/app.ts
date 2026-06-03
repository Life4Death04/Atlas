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
  const { env } = deps;
  const app = express();

  // ── Global middleware ─────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

  // ── API router ────────────────────────────────────────────────────────────
  const apiRouter = express.Router();

  // Body parser — limit configurable via env (REQ-9)
  apiRouter.use(express.json({ limit: env.BODY_LIMIT }));

  // ── Module routers (REQ-11 — one declarative list) ────────────────────────
  // Adding a new module requires only appending to this array.
  // No per-module imports scattered across the file.
  const modules: Module[] = [healthModule(deps)];
  for (const m of modules) {
    apiRouter.use('/', m.router);
  }

  app.use('/api', apiRouter);

  // ── Error handler (must be last) ──────────────────────────────────────────
  app.use(buildErrorMiddleware(deps.logger));

  return app;
}
