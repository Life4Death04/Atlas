// ─────────────────────────────────────────────────────────────────────────────
// Readiness endpoint tests (REQ-3)
//
// Tests the GET /api/ready endpoint which checks DB connectivity.
// Uses mock prisma — no real DB needed.
//
// TDD: RED written first — references src/modules/health/ that does not exist yet.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';

describe('GET /api/ready', () => {
  it('returns 200 with status ready when DB ping succeeds', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildTestApp({ prisma: mockPrisma as never });
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('returns 503 with code not_ready when DB query rejects', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const app = buildTestApp({ prisma: mockPrisma as never });
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('NOT_READY');
  });

  it('returns 503 with code not_ready when DB query times out', async () => {
    // Use a very short timeout (10ms) so the test completes quickly without
    // needing fake timers. The $queryRaw promise never resolves, so the
    // timeout race wins after 10ms.
    const mockPrisma = {
      $queryRaw: vi.fn().mockReturnValue(new Promise(() => undefined)),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const { parseEnv } = await import('../../src/config/env.schema.js');
    const { TEST_PUBLIC_KEY: testPubKey } = await import('../helpers/auth.js');
    const testEnv = parseEnv({
      NODE_ENV: 'test',
      PORT: '3001',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
      CLIENT_URL: 'http://localhost:5173',
      AUTH0_DOMAIN: 'test.auth0.com',
      AUTH0_AUDIENCE: 'https://test-api.example.com',
      READINESS_DB_TIMEOUT_MS: '10',
      // REQ-13 — required for NODE_ENV=test
      TEST_JWT_PUBLIC_KEY: testPubKey,
    });

    const app = buildTestApp({ prisma: mockPrisma as never, env: testEnv });
    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('NOT_READY');
  }, 5000);
});
