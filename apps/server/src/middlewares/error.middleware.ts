import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../shared/ApiError.js';
import type { Logger } from '../app.js';

/**
 * Build the central error handler with an injected logger.
 *
 * Called from createApp(deps) so the handler uses the same logger instance
 * as the rest of the application.
 *
 * Full error handler rewrite (ZodError, Prisma errors, requestId) is T-9 (slice 2).
 * This version is backward-compatible with the current ApiError surface.
 */
export function buildErrorMiddleware(logger: Logger): ErrorRequestHandler {
  return (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
      });
      return;
    }

    logger.error(err.message, { stack: err.stack });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
  };
}

/**
 * @deprecated Use buildErrorMiddleware(logger) instead.
 * Kept for backward compatibility with any routes that import errorMiddleware
 * directly. This will be removed in the full T-9 rewrite.
 */
export const errorMiddleware:ErrorRequestHandler = buildErrorMiddleware({
  info: () => undefined,
  warn: () => undefined,
  error: console.error.bind(console),
  debug: () => undefined,
});
