// ─────────────────────────────────────────────────────────────────────────────
// Health module routes (REQ-2, REQ-3, design §11)
//
// GET /health  — liveness check (no DB, always fast)
// GET /ready   — readiness check (DB ping via readinessCheck service)
//
// Both are mounted under /api via the module's basePath in app.ts.
// Both are exempt from rate limiting (skip predicate in rate-limit middleware).
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type RequestHandler } from 'express';
import { readinessCheck } from './service.js';
import type { ModuleDeps } from '../../app.js';

/**
 * Create and return the health module router.
 *
 * @param deps - Injected module dependencies (prisma, env, logger)
 */
export function createHealthRouter(deps: ModuleDeps): Router {
  const { prisma, env } = deps;
  const router = Router();

  // ── GET /health — liveness (no DB) ───────────────────────────────────────
  const livenessHandler: RequestHandler = (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  };

  router.get('/health', livenessHandler);

  // ── GET /ready — readiness (DB ping) ─────────────────────────────────────
  const readinessHandler: RequestHandler = async (req, res) => {
    const result = await readinessCheck(prisma, env.READINESS_DB_TIMEOUT_MS);

    if (result.ok) {
      res.json({ status: 'ready' });
      return;
    }

    res.status(503).json({
      error: 'Service not ready',
      code: 'NOT_READY',
      statusCode: 503,
      requestId: req.requestId ?? 'unknown',
      details: { reason: result.error },
    });
  };

  router.get('/ready', readinessHandler);

  return router;
}
