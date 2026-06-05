// ─────────────────────────────────────────────────────────────────────────────
// Central error handler (T-9, REQ-7, design §7)
//
// Handles all errors thrown by route handlers or other middleware.
// Order matters — matches are first-wins:
//   1. ApiError       → passthrough (status, code, message, requestId)
//   2. ZodError       → 400 VALIDATION_ERROR + details.fieldErrors
//   3. entity.too.large → 413 PAYLOAD_TOO_LARGE + requestId
//   4. Prisma P2xxx   → normalized via prisma-errors.ts (409, 404, or 500)
//   5. fallback       → 500 INTERNAL_ERROR (message redacted to client)
//
// Logging:
//   5xx: logger.error({ err, requestId, method, url })
//   4xx: logger.warn({ code, requestId, method, url })
//
// Stack traces: included in details.stack ONLY when NODE_ENV !== 'production'.
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../shared/ApiError.js';
import { isPrismaKnownError, normalizePrismaError } from '../shared/prisma-errors.js';
import type { Logger } from '../app.js';
import type { Env } from '../config/env.schema.js';

/**
 * Build the central error handler with an injected logger and env.
 *
 * Called from createApp(deps) so the handler uses the same logger instance
 * and env as the rest of the application.
 */
export function buildErrorMiddleware(logger: Logger, env: Env): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = (req as Request & { requestId?: string }).requestId ?? 'unknown';
    const { method, url } = req;
    const isProduction = env.NODE_ENV === 'production';

    // ── 1. ApiError — passthrough ───────────────────────────────────────────
    if (err instanceof ApiError) {
      logger.warn({ code: err.code, requestId, method, url }, err.message);
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
        requestId,
        ...(err.details !== undefined && { details: err.details }),
      });
      return;
    }

    // ── 2. ZodError — validation failure ────────────────────────────────────
    if (err instanceof ZodError) {
      const fieldErrors = err.flatten().fieldErrors;
      logger.warn({ code: 'VALIDATION_ERROR', requestId, method, url }, 'Validation error');
      res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        requestId,
        details: { fieldErrors },
      });
      return;
    }

    // ── 3. Body-parser entity.too.large (413) ─────────────────────────────
    const errWithType = err as Error & { type?: string; status?: number };
    if (errWithType.type === 'entity.too.large' || errWithType.status === 413) {
      logger.warn({ code: 'PAYLOAD_TOO_LARGE', requestId, method, url }, 'Payload too large');
      res.status(413).json({
        error: 'Payload too large',
        code: 'PAYLOAD_TOO_LARGE',
        statusCode: 413,
        requestId,
      });
      return;
    }

    // ── 4. PrismaClientKnownRequestError — normalize ──────────────────────
    if (isPrismaKnownError(err)) {
      const apiError = normalizePrismaError(err);
      if (apiError.statusCode >= 500) {
        logger.error({ err, requestId, method, url }, apiError.message);
      } else {
        logger.warn({ code: apiError.code, requestId, method, url }, apiError.message);
      }
      res.status(apiError.statusCode).json({
        error: apiError.message,
        code: apiError.code,
        statusCode: apiError.statusCode,
        requestId,
      });
      return;
    }

    // ── 5. Fallback — unknown error ────────────────────────────────────────
    const unknownErr = err instanceof Error ? err : new Error(String(err));
    logger.error({ err: unknownErr, requestId, method, url }, unknownErr.message);

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      requestId,
      ...(!isProduction && { details: { stack: unknownErr.stack } }),
    });
  };
}
