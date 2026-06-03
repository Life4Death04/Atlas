// ─────────────────────────────────────────────────────────────────────────────
// Health module (REQ-2, REQ-3, REQ-11, design §3)
//
// Exports healthModule(deps) → { basePath, router } value object.
// app.ts mounts this by adding it to the modules array — no per-module imports.
//
// Adding a new feature requires only adding it to the modules array in app.ts.
// This satisfies REQ-11 (feature-modular layout invariant).
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleDeps, Module } from '../../app.js';
import { createHealthRouter } from './routes.js';

/**
 * Build and return the health module value object.
 *
 * @param deps - Injected module dependencies (prisma, env, logger)
 */
export function healthModule(deps: ModuleDeps): Module {
  return {
    basePath: '/api',
    router: createHealthRouter(deps),
  };
}
