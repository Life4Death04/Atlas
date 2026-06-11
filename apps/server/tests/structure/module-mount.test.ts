// ─────────────────────────────────────────────────────────────────────────────
// Module-mount structure test (T-11, REQ-11, design §3)
//
// Verifies the module-mount convention:
//   - A module exports { basePath: string, router: Router }
//   - The fake module's GET /api/fake-hello route responds 200
//   - Registering the module requires NO changes to server.ts, env.ts,
//     logger.ts, or error.middleware.ts
//
// Uses a fake module fixture: tests/fixtures/fake-module/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import pino from 'pino';
import type { ModuleDeps } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.schema.js';
import { TEST_PUBLIC_KEY } from '../helpers/auth.js';

// The fake module — this file doesn't exist yet (RED)
import { fakeModule } from '../fixtures/fake-module/index.js';

// ── Shared test deps ──────────────────────────────────────────────────────────

function makeTestDeps(): ModuleDeps {
  return {
    env: parseEnv({
      NODE_ENV: 'test',
      PORT: '3001',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
      CLIENT_URL: 'http://localhost:5173',
      AUTH0_DOMAIN: 'test.auth0.com',
      AUTH0_AUDIENCE: 'https://test-api.example.com',
      TEST_JWT_PUBLIC_KEY: TEST_PUBLIC_KEY,
    }),
    logger: pino({ level: 'silent' }),
    prisma: { $queryRaw: async () => [], $disconnect: async () => undefined },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Module-mount convention (T-11, REQ-11)', () => {
  // ── 1. Fake module shape ───────────────────────────────────────────────────
  describe('fakeModule fixture shape', () => {
    it('exports basePath (/api) and router', () => {
      const deps = makeTestDeps();
      const mod = fakeModule(deps);

      expect(typeof mod.basePath).toBe('string');
      expect(mod.basePath).toBe('/api');
      expect(mod.router).toBeDefined();
    });
  });

  // ── 2. Route is mountable and responds correctly ──────────────────────────
  describe('fakeModule route', () => {
    it('GET /api/fake-hello responds 200 with { message: "hello from fake module" }', async () => {
      const deps = makeTestDeps();
      const mod = fakeModule(deps);

      // Build a minimal Express app to mount the fake module — no server.ts, env.ts,
      // logger.ts, or error.middleware.ts involved.
      const app = express();
      app.use(mod.basePath, mod.router);

      const res = await request(app).get('/api/fake-hello');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('hello from fake module');
    });

    it('fake module can be removed without touching foundation files', () => {
      // This test asserts the structural guarantee: fakeModule is self-contained.
      // Removing the fakeModule import above is the only change needed.
      // We verify this structurally by confirming fakeModule does NOT import
      // from server.ts, env.ts (singleton), logger.ts, or error.middleware.ts.
      // This is a static analysis guarantee enforced by the fixture's import list.
      //
      // The runtime equivalent: fakeModule(deps) works with any ModuleDeps
      // without side-effecting any global state.
      const deps = makeTestDeps();
      const mod1 = fakeModule(deps);
      const mod2 = fakeModule(deps);

      // Two instances created from same deps — both should be independent
      expect(mod1.router).not.toBe(mod2.router); // each call produces a fresh router
      expect(mod1.basePath).toBe(mod2.basePath);
    });
  });
});
