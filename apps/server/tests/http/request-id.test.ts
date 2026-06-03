// ─────────────────────────────────────────────────────────────────────────────
// Request ID middleware tests (REQ-6)
//
// Tests X-Request-Id header behavior:
//   - Valid incoming header is honored (round-trips unchanged)
//   - Malformed header is rejected → UUID v4 generated
//   - Missing header → UUID v4 generated
//
// TDD: RED written first — references request-id.middleware.ts that does not exist yet.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';

/** Simple UUID v4 regex */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('X-Request-Id middleware', () => {
  it('honors a valid incoming X-Request-Id header', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'req-abc-123');

    expect(res.headers['x-request-id']).toBe('req-abc-123');
    expect(res.status).toBe(200);
  });

  it('generates a UUID when X-Request-Id header is malformed', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', '!!bad header!!');

    expect(UUID_V4.test(res.headers['x-request-id'] ?? '')).toBe(true);
    expect(res.status).toBe(200);
  });

  it('generates a UUID when X-Request-Id header is missing', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/health');

    expect(UUID_V4.test(res.headers['x-request-id'] ?? '')).toBe(true);
    expect(res.status).toBe(200);
  });

  it('rejects a header with printable chars outside ASCII range', async () => {
    const app = buildTestApp();
    // Non-printable characters (space char = 0x20 which is just at boundary; DEL = 0x7F is outside)
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', '\x00invalid\x7F');

    expect(UUID_V4.test(res.headers['x-request-id'] ?? '')).toBe(true);
  });
});
