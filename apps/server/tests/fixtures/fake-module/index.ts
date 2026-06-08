// ─────────────────────────────────────────────────────────────────────────────
// Fake module fixture (T-11, REQ-11, design §3)
//
// A minimal module that follows the module-mount convention:
//   - Factory function (deps: ModuleDeps) → { basePath: string; router: Router }
//   - Exports a single GET /fake-hello route
//   - Self-contained: no imports from server.ts, env.ts (singleton), logger.ts,
//     or error.middleware.ts
//
// Use in tests to verify the module-mount convention without touching any
// foundation files.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import type { ModuleDeps, Module } from '../../../src/app.js';

/**
 * Fake module factory — conforms to the module-mount convention (design §3).
 *
 * Returns a value object { basePath, router } with one test route.
 * Each call creates an independent router instance.
 */
export function fakeModule(_deps: ModuleDeps): Module {
  const router = Router();

  router.get('/fake-hello', (_req, res) => {
    res.json({ message: 'hello from fake module' });
  });

  return {
    basePath: '/api',
    router,
  };
}
