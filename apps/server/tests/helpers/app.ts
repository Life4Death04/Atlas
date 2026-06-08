// ─────────────────────────────────────────────────────────────────────────────
// Test app factory (REQ-1, REQ-12)
//
// buildTestApp() creates a configured Express application using createApp()
// with a silent logger and a minimal mock prisma — no real DB, no real port.
//
// Usage:
//   const app = buildTestApp();
//   await request(app).get('/api/health').expect(200);
//
// Override specific deps for targeted tests:
//   const app = buildTestApp({ prisma: { $queryRaw: vi.fn().mockResolvedValue([]) } as never });
// ─────────────────────────────────────────────────────────────────────────────

import pino from 'pino';
import { createApp } from '../../src/app.js';
import type { ModuleDeps, PrismaLike } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.schema.js';

/** Silent test env — satisfies all required fields, no external connections. */
const testEnv = parseEnv({
  NODE_ENV: 'test',
  PORT: '3001',
  HOST: '0.0.0.0',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
  CLIENT_URL: 'http://localhost:5173',
  AUTH0_DOMAIN: 'test.auth0.com',
  AUTH0_AUDIENCE: 'https://test-api.example.com',
  ASCEND_API_BASE_URL: 'https://oss.exercisedb.dev/api/v1',
});

/** Silent logger — suppresses all output during tests. */
const silentLogger = pino({ level: 'silent' });

/** No-op mock prisma — safe to use in tests that don't need DB. */
const mockPrisma: PrismaLike = {
  $queryRaw: async () => [],
  $disconnect: async () => undefined,
};

/**
 * Create a test Express application with default silent/mock deps.
 *
 * @param overrides - Partial deps to override (e.g. { prisma: customMock }).
 */
export function buildTestApp(overrides: Partial<ModuleDeps> = {}) {
  return createApp({
    env: testEnv,
    logger: silentLogger,
    prisma: mockPrisma,
    ...overrides,
  });
}
