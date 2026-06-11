// ─────────────────────────────────────────────────────────────────────────────
// Rate limit middleware tests (REQ-8)
//
// Tests:
//   - RateLimit-* headers present on normal (under-limit) requests
//   - 429 response with code RATE_LIMITED and requestId when over limit
//   - Health and ready routes are exempt from rate limiting
//
// TDD: RED written first — references rate-limit.middleware.ts that does not exist yet.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import { parseEnv } from '../../src/config/env.schema.js';
import { TEST_PUBLIC_KEY } from '../helpers/auth.js';

/** Small env with low rate-limit for testing */
function makeLowLimitEnv(max: number) {
  return parseEnv({
    NODE_ENV: 'test',
    PORT: '3001',
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
    CLIENT_URL: 'http://localhost:5173',
    AUTH0_DOMAIN: 'test.auth0.com',
    AUTH0_AUDIENCE: 'https://test-api.example.com',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX: String(max),
    // REQ-13 — required for NODE_ENV=test
    TEST_JWT_PUBLIC_KEY: TEST_PUBLIC_KEY,
  });
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Rate limit middleware (REQ-8)', () => {
  it('includes RateLimit-* headers on a normal (under-limit) request', async () => {
    const env = makeLowLimitEnv(10);
    const app = buildTestApp({ env });

    // Use a non-exempt path (404 is fine — it's rate-limited and will have headers)
    const res = await request(app).get('/api/some-other-route');

    // Not 429 — we are under the limit
    expect(res.status).not.toBe(429);
    // standardHeaders: true (= draft-6) → RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    // legacyHeaders: false → no X-RateLimit-* headers
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('returns 429 with RATE_LIMITED code and requestId when over limit', async () => {
    const env = makeLowLimitEnv(2);
    const app = buildTestApp({ env });

    // Use a non-exempt path so rate-limiting applies
    // Send 2 requests to exhaust the limit, then a 3rd that should be blocked
    await request(app).get('/api/some-route');
    await request(app).get('/api/some-route');
    const res = await request(app).get('/api/some-route');

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(UUID_V4.test(res.body.requestId ?? '')).toBe(true);
  });

  it('does not rate-limit GET /api/health even when over limit (R4 — skip predicate)', async () => {
    // The rate limiter is mounted on the /api sub-router, so req.path is
    // relative: '/health', NOT '/api/health'. The skip predicate checks '/health'.
    // This test verifies that the skip works even when the global limit is 1.
    const env = makeLowLimitEnv(1);
    const app = buildTestApp({ env });

    // Both health requests should succeed regardless of limit
    const res1 = await request(app).get('/api/health');
    const res2 = await request(app).get('/api/health');
    const res3 = await request(app).get('/api/health');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });

  it('does not rate-limit GET /api/ready even when over limit', async () => {
    const env = makeLowLimitEnv(1);
    const app = buildTestApp({ env });

    // All ready requests should respond (503 is fine — it's not rate-limited)
    const res1 = await request(app).get('/api/ready');
    const res2 = await request(app).get('/api/ready');
    const res3 = await request(app).get('/api/ready');

    // Status is not 429 (could be 200 or 503 depending on mock prisma)
    expect(res1.status).not.toBe(429);
    expect(res2.status).not.toBe(429);
    expect(res3.status).not.toBe(429);
  });
});
