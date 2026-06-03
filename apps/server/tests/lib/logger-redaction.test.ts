// ─────────────────────────────────────────────────────────────────────────────
// Logger tests (REQ-5)
//
// Tests the buildLogger factory:
//   - Production mode emits single-line parseable JSON
//   - Sensitive headers (Authorization, Cookie) are redacted
//   - LOG_LEVEL is honored (entries below threshold are suppressed)
//
// TDD: RED written first — references src/lib/logger.ts that does not exist yet.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { buildLogger } from '../../src/lib/logger.js';
import { parseEnv } from '../../src/config/env.schema.js';

/** Create an env for testing with given overrides */
function makeEnv(overrides: Record<string, string> = {}) {
  return parseEnv({
    NODE_ENV: 'test',
    PORT: '3001',
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
    CLIENT_URL: 'http://localhost:5173',
    AUTH0_DOMAIN: 'test.auth0.com',
    AUTH0_AUDIENCE: 'https://test-api.example.com',
    ...overrides,
  });
}

/**
 * Capture pino log output to a string by passing a custom Writable stream.
 * Collects the lines written during the callback execution.
 */
async function captureLog(
  fn: (logger: ReturnType<typeof buildLogger>) => void,
  envOverrides: Record<string, string> = {},
): Promise<string[]> {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString().trim());
      callback();
    },
  });

  const env = makeEnv(envOverrides);
  const logger = buildLogger(env, stream);
  fn(logger);

  // Allow async writes to flush
  await new Promise((resolve) => setImmediate(resolve));
  return lines.filter(Boolean);
}

describe('buildLogger', () => {
  it('emits parseable JSON in production mode', async () => {
    const lines = await captureLog(
      (logger) => logger.info('hello from prod'),
      { NODE_ENV: 'production', LOG_LEVEL: 'info' },
    );

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.msg).toBe('hello from prod');
    expect(typeof parsed.time).toBe('number');
  });

  it('redacts Authorization header from logged objects', async () => {
    const lines = await captureLog(
      (logger) =>
        logger.info(
          { req: { headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' } } },
          'request received',
        ),
      { NODE_ENV: 'production', LOG_LEVEL: 'info' },
    );

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.req.headers.authorization).toBe('[redacted]');
    // Non-sensitive headers are preserved
    expect(parsed.req.headers['content-type']).toBe('application/json');
  });

  it('redacts Cookie header from logged objects', async () => {
    const lines = await captureLog(
      (logger) =>
        logger.info(
          { req: { headers: { cookie: 'sid=supersecret; token=abc' } } },
          'request received',
        ),
      { NODE_ENV: 'production', LOG_LEVEL: 'info' },
    );

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.req.headers.cookie).toBe('[redacted]');
  });

  it('suppresses log entries below the configured LOG_LEVEL', async () => {
    const lines = await captureLog(
      (logger) => {
        logger.info('this should be suppressed');
        logger.warn('this should appear');
      },
      { NODE_ENV: 'production', LOG_LEVEL: 'warn' },
    );

    // Only the warn-level entry should appear
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.msg).toBe('this should appear');
    expect(parsed.level).toBe(40); // pino level number for 'warn'
  });
});
