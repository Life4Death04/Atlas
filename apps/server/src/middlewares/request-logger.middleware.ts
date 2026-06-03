// ─────────────────────────────────────────────────────────────────────────────
// Request logger middleware (REQ-5, design §5)
//
// Wraps the pino-http middleware with:
//   - Custom props that bind requestId to every request log entry
//   - Custom log level: 5xx → error, 4xx → warn, otherwise → info
//
// MUST be mounted AFTER requestId middleware so customProps can read req.requestId.
// MUST be mounted BEFORE routes so req.log is available in handlers.
// ─────────────────────────────────────────────────────────────────────────────

import { pinoHttp } from 'pino-http';
import type { RequestHandler } from 'express';
import type { Logger } from '../app.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Build the pino-http request logger middleware.
 *
 * @param logger - Pino logger instance (built by buildLogger in server.ts)
 */
export function buildRequestLogger(logger: Logger): RequestHandler {
  const middleware = pinoHttp({
    // Pass our pre-built logger so pino-http uses the same instance
    // with the same level, redact paths, and transport settings.
    // The cast is needed because our Logger type is narrower than pino.Logger.
    logger: logger as never,

    // Bind requestId to every request log line
    customProps: (req: IncomingMessage): object => ({
      requestId: (req as unknown as { requestId?: string }).requestId,
    }),

    // Custom log level by response status
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });

  // pino-http middleware has signature (req, res, next) which matches RequestHandler
  return middleware as unknown as RequestHandler;
}
