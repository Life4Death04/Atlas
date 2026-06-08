// ─────────────────────────────────────────────────────────────────────────────
// Rate limit middleware (REQ-8, design §8)
//
// buildRateLimit(env):
//   - windowMs and max from env (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)
//   - standardHeaders: true  → RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
//   - legacyHeaders: false   → no X-RateLimit-* headers
//   - skip: /health and /ready are exempt (R4: req.path is relative to /api
//     sub-router mount, so it's '/health' not '/api/health')
//   - Custom 429 handler with code RATE_LIMITED and requestId from req.requestId
//
// MUST be mounted on the /api sub-router so req.path is relative:
//   /health matches req.path === '/health', not req.path === '/api/health'
// ─────────────────────────────────────────────────────────────────────────────

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import type { Env } from '../config/env.schema.js';

/**
 * Build the rate limit middleware from environment configuration.
 *
 * @param env - Validated application environment (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)
 */
export function buildRateLimit(env: Env) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,   // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
    legacyHeaders: false,    // No X-RateLimit-* headers

    // R4: req.path on a sub-router is relative to the mount point.
    // Since rate-limit is mounted on the /api router, '/health' matches '/api/health'.
    skip: (req: Request) => req.path === '/health' || req.path === '/ready',

    // Custom 429 handler — includes code and requestId in response
    handler: (req: Request, res) => {
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        statusCode: 429,
        requestId: req.requestId,
      });
    },
  });
}
