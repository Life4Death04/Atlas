// ─────────────────────────────────────────────────────────────────────────────
// Health endpoint smoke test (REQ-1, REQ-2, REQ-12)
//
// Asserts:
//   1. GET /api/health returns 200 with body.status === 'ok'
//   2. No TCP port is bound — supertest drives the app directly via createApp()
//   3. The response includes uptime as a non-negative number
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes uptime as a non-negative number', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('does not call prisma (liveness — no DB dependency)', async () => {
    const { vi } = await import('vitest');
    const mockQueryRaw = vi.fn().mockRejectedValue(new Error('DB down'));
    const app = buildTestApp({ prisma: { $queryRaw: mockQueryRaw } as never });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
