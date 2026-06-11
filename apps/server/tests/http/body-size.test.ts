// ─────────────────────────────────────────────────────────────────────────────
// Body size limit tests (REQ-9)
//
// Tests:
//   - Small JSON body is accepted normally
//   - Oversized body returns 413 with PAYLOAD_TOO_LARGE code and requestId
//
// TDD: RED written first (T-8) — rate-limit middleware must be mounted and body-size
// limit wired in the /api router before this can pass.
// T-9 unlocked full error-shape assertions (code + requestId).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import { parseEnv } from '../../src/config/env.schema.js';
import { TEST_PUBLIC_KEY } from '../helpers/auth.js';

/** Env with a small body limit for testing */
function makeSmallBodyEnv() {
  return parseEnv({
    NODE_ENV: 'test',
    PORT: '3001',
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
    CLIENT_URL: 'http://localhost:5173',
    AUTH0_DOMAIN: 'test.auth0.com',
    AUTH0_AUDIENCE: 'https://test-api.example.com',
    BODY_LIMIT: '1kb',
    // REQ-13 — required for NODE_ENV=test
    TEST_JWT_PUBLIC_KEY: TEST_PUBLIC_KEY,
  });
}

/** Generate a JSON body of approximately the specified byte size */
function buildBody(approxBytes: number): string {
  const padding = 'x'.repeat(approxBytes);
  return JSON.stringify({ data: padding });
}

describe('Body size limit middleware (REQ-9)', () => {
  it('accepts a small JSON body normally', async () => {
    const env = makeSmallBodyEnv();
    const app = buildTestApp({ env });

    const res = await request(app)
      .post('/api/health') // health route doesn't handle POST; should 404 but body is parsed
      .set('Content-Type', 'application/json')
      .send({ ok: true });

    // Not 400/413 — body was accepted (404 because POST /api/health is not a handler,
    // but the important thing is it's not 413)
    expect(res.status).not.toBe(413);
    expect(res.status).not.toBe(400);
  });

  it('returns 413 for oversized body (4kb > 1kb limit)', async () => {
    const env = makeSmallBodyEnv();
    const app = buildTestApp({ env });

    const oversizedBody = buildBody(4 * 1024); // ~4kb

    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(oversizedBody);

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.requestId).toBeDefined();
  });
});
