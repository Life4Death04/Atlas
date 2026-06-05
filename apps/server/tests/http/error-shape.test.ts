// ─────────────────────────────────────────────────────────────────────────────
// Error handler shape tests (T-9, REQ-7, design §7)
//
// Tests the central error handler for all 5 error types:
//   1. ApiError — passthrough (status, code, message, requestId)
//   2. P2002 → 409 CONFLICT (via prisma-errors normalizer)
//   3. P2025 → 404 NOT_FOUND (via prisma-errors normalizer)
//   4. ZodError → 400 VALIDATION_ERROR + fieldErrors details
//   5. Unknown error → 500 INTERNAL_ERROR, message redacted to 'Internal server error'
//
// All responses must include requestId.
// Stack trace in details.stack only when NODE_ENV !== 'production'.
//
// TDD: Tests written RED before T-9 error handler rewrite.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { buildTestApp } from '../helpers/app.js';
import { ApiError } from '../../src/shared/ApiError.js';
import { buildErrorMiddleware } from '../../src/middlewares/error.middleware.js';
import { parseEnv } from '../../src/config/env.schema.js';
import pino from 'pino';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Minimal env override for tests — allows NODE_ENV control */
function makeEnv(nodeEnv: 'development' | 'test' | 'production' = 'test') {
  return parseEnv({
    NODE_ENV: nodeEnv,
    PORT: '3001',
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
    CLIENT_URL: 'http://localhost:5173',
    AUTH0_DOMAIN: 'test.auth0.com',
    AUTH0_AUDIENCE: 'https://test-api.example.com',
  });
}

/**
 * Build a minimal Express app that throws the given error on GET /error,
 * then passes it to the error handler under test.
 * Uses the same buildErrorMiddleware from production code.
 */
function buildErrorTestApp(errorFactory: () => Error, nodeEnv: 'development' | 'test' | 'production' = 'test') {
  const env = makeEnv(nodeEnv);
  const logger = pino({ level: 'silent' });

  const app = express();
  // requestId middleware — must be wired so handler can read req.requestId
  app.use((req, _res, next) => {
    (req as express.Request & { requestId: string }).requestId = 'test-request-id-123';
    next();
  });

  app.get('/error', (_req, _res, next) => {
    next(errorFactory());
  });

  app.use(buildErrorMiddleware(logger, env));
  return app;
}

/**
 * Fake a PrismaClientKnownRequestError for tests (avoids importing prisma client).
 */
function fakePrismaError(code: string): Error {
  const err = new Error(`Prisma error: ${code}`);
  err.name = 'PrismaClientKnownRequestError';
  (err as Error & { code: string }).code = code;
  return err;
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('Central error handler shape (T-9, REQ-7)', () => {
  // ── 1. ApiError passthrough ────────────────────────────────────────────────
  describe('ApiError passthrough', () => {
    it('returns statusCode, code, message, and requestId from ApiError', async () => {
      const app = buildErrorTestApp(
        () => new ApiError(422, 'UNPROCESSABLE', 'Invalid payload'),
      );

      const res = await request(app).get('/error');

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('UNPROCESSABLE');
      expect(res.body.error).toBe('Invalid payload');
      expect(res.body.statusCode).toBe(422);
      expect(res.body.requestId).toBe('test-request-id-123');
    });

    it('includes details when ApiError has them', async () => {
      const app = buildErrorTestApp(
        () => new ApiError(400, 'BAD_REQUEST', 'Validation failed', { field: 'name' }),
      );

      const res = await request(app).get('/error');

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual({ field: 'name' });
    });
  });

  // ── 2. Prisma P2002 → 409 ─────────────────────────────────────────────────
  describe('Prisma P2002 → 409 CONFLICT', () => {
    it('maps P2002 to 409 with CONFLICT code and requestId', async () => {
      const app = buildErrorTestApp(() => fakePrismaError('P2002'));

      const res = await request(app).get('/error');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
      expect(res.body.error).toBe('Resource already exists');
      expect(res.body.requestId).toBe('test-request-id-123');
    });
  });

  // ── 3. Prisma P2025 → 404 ─────────────────────────────────────────────────
  describe('Prisma P2025 → 404 NOT_FOUND', () => {
    it('maps P2025 to 404 with NOT_FOUND code and requestId', async () => {
      const app = buildErrorTestApp(() => fakePrismaError('P2025'));

      const res = await request(app).get('/error');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.error).toBe('Resource not found');
      expect(res.body.requestId).toBe('test-request-id-123');
    });
  });

  // ── 4. ZodError → 400 VALIDATION_ERROR ───────────────────────────────────
  describe('ZodError → 400 VALIDATION_ERROR', () => {
    it('returns 400 with VALIDATION_ERROR code, fieldErrors in details, requestId', async () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const parseResult = schema.safeParse({ name: 123, age: 'not-a-number' });
      const zodError = (parseResult as { success: false; error: z.ZodError }).error;

      const app = buildErrorTestApp(() => zodError);

      const res = await request(app).get('/error');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toBe('Validation error');
      expect(res.body.requestId).toBe('test-request-id-123');
      // details should have fieldErrors from Zod flatten
      expect(res.body.details).toBeDefined();
      expect(res.body.details.fieldErrors).toBeDefined();
      expect(res.body.details.fieldErrors.name).toBeDefined();
    });
  });

  // ── 5. Unknown error → 500 redacted ───────────────────────────────────────
  describe('Unknown error → 500 INTERNAL_ERROR', () => {
    it('returns 500 with redacted message and requestId', async () => {
      // Use 'production' env to ensure no stack trace leaks the original message
      const app = buildErrorTestApp(
        () => new Error('Secret DB connection string leaked!'),
        'production',
      );

      const res = await request(app).get('/error');

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
      // The 'error' field must be the safe generic message, not the original
      expect(res.body.error).toBe('Internal server error');
      expect(res.body.requestId).toBe('test-request-id-123');
      // In production, no details/stack → original message must not appear
      expect(JSON.stringify(res.body)).not.toContain('Secret DB');
    });

    it('includes stack in details.stack in non-production env', async () => {
      const app = buildErrorTestApp(
        () => new Error('test error'),
        'development',
      );

      const res = await request(app).get('/error');

      expect(res.status).toBe(500);
      expect(res.body.details).toBeDefined();
      expect(res.body.details.stack).toBeDefined();
      expect(typeof res.body.details.stack).toBe('string');
    });

    it('does NOT include stack in production env', async () => {
      const app = buildErrorTestApp(
        () => new Error('test error'),
        'production',
      );

      const res = await request(app).get('/error');

      expect(res.status).toBe(500);
      // details should be absent or stack absent in production
      const hasStack = res.body.details && res.body.details.stack;
      expect(hasStack).toBeFalsy();
    });
  });
});

// ── Integration via buildTestApp ──────────────────────────────────────────────
// Verify the error handler works end-to-end via the real app (body-size 413 shape)
describe('Error handler integration: 413 body-too-large (T-8 + T-9)', () => {
  it('returns 413 with PAYLOAD_TOO_LARGE code and requestId', async () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      PORT: '3001',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
      CLIENT_URL: 'http://localhost:5173',
      AUTH0_DOMAIN: 'test.auth0.com',
      AUTH0_AUDIENCE: 'https://test-api.example.com',
      BODY_LIMIT: '1kb',
    });
    const app = buildTestApp({ env });

    const oversizedBody = 'x'.repeat(4 * 1024);
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: oversizedBody }));

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.requestId).toBeDefined();
  });
});
