// ─────────────────────────────────────────────────────────────────────────────
// Test app factory (REQ-1, REQ-12, REQ-13)
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
import { vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { ModuleDeps, PrismaLike } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.schema.js';
import { TEST_PUBLIC_KEY } from './auth.js';

/** Silent test env — satisfies all required fields, no external connections. */
export const testEnv = parseEnv({
  NODE_ENV: 'test',
  PORT: '3001',
  HOST: '0.0.0.0',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
  CLIENT_URL: 'http://localhost:5173',
  AUTH0_DOMAIN: 'test.auth0.com',
  AUTH0_AUDIENCE: 'https://test-api.example.com',
  ASCEND_API_BASE_URL: 'https://oss.exercisedb.dev/api/v1',
  // REQ-13 — required for NODE_ENV=test
  TEST_JWT_PUBLIC_KEY: TEST_PUBLIC_KEY,
});

/** Silent logger — suppresses all output during tests. */
const silentLogger = pino({ level: 'silent' });

// Mock prisma type widened with user.upsert for Slice 1 test helpers.
// TODO(Slice 2): Replace with PrismaLike once it is widened with user.upsert.
type MockPrisma = PrismaLike & {
  user: { upsert: ReturnType<typeof vi.fn> };
};

/**
 * No-op mock prisma — safe to use in tests that don't need DB.
 *
 * Includes `user.upsert` mock for provisioning middleware tests (REQ-AP-1).
 * The `MockPrisma` type extends `PrismaLike` with user. Slice 2 will widen
 * the canonical `PrismaLike` type and this local extension can be removed.
 */
export const mockPrisma: MockPrisma = {
  $queryRaw: async () => [],
  $disconnect: async () => undefined,
  user: {
    upsert: vi.fn(),
  },
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
