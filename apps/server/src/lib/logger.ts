// ─────────────────────────────────────────────────────────────────────────────
// Pino logger factory (REQ-5, design §5)
//
// buildLogger(env, stream?):
//   - Production: single-line JSON to stdout (or provided stream)
//   - Non-production: pino-pretty transport (colorized, human-readable)
//   - Redacts auth/cookie headers from log output
//   - LOG_LEVEL controls verbosity (set by env, conditionally defaulted)
//
// The optional `stream` parameter is for testing — pass a Writable to capture
// log output without spawning a child pino-pretty process.
// ─────────────────────────────────────────────────────────────────────────────

import pino from 'pino';
import type { Env } from '../config/env.schema.js';
import type { Writable } from 'node:stream';

export type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
  fatal: (obj: unknown, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

/**
 * Build a Pino logger instance from the application environment.
 *
 * @param env    - Validated application environment (provides LOG_LEVEL, NODE_ENV)
 * @param stream - Optional writable stream (used in tests to capture output)
 */
export function buildLogger(env: Env, stream?: Writable): Logger {
  const redact = {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.headers.authorization',
      '*.headers.cookie',
    ],
    censor: '[redacted]',
  };

  // In production (or when an explicit stream is provided), emit raw JSON.
  // In dev/test without a stream, use pino-pretty for human-readable output.
  if (env.NODE_ENV === 'production' || stream) {
    return pino(
      {
        level: env.LOG_LEVEL,
        redact,
      },
      stream as pino.DestinationStream,
    );
  }

  // Non-production without explicit stream: use pino-pretty transport
  return pino({
    level: env.LOG_LEVEL,
    redact,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
      },
    },
  });
}
