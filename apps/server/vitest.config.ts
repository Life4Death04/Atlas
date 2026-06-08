// ─────────────────────────────────────────────────────────────────────────────
// Vitest configuration for the Atlas server package.
//
// Why two projects:
//   • "unit" project — env/config, HTTP (supertest), lib tests — no DB needed.
//     No setupFiles; runs pnpm test for fast feedback without a Postgres server.
//
//   • "integration" project — schema/ tests that TRUNCATE real DB rows.
//     Keeps setupFiles: ['tests/setup.ts'] which validates TEST_DATABASE_URL,
//     runs `prisma migrate deploy`, and loads `.env.test`.
//
// Other choices:
//   • pool: 'forks' + singleFork: true
//       DB tests share a single Postgres instance. Serial execution prevents
//       cross-test contamination.
//
//   • globals: false
//       We import describe/it/expect explicitly. Keeps test files honest and
//       compatible with TypeScript NodeNext module resolution.
//
//   • testTimeout: 30000
//       DB tests wait for Postgres + migrations; 30s avoids flakiness on slow CI.
//
//   • include patterns
//       Unit:        tests/config/**, tests/http/**, tests/lib/**, tests/lifecycle/**,
//                   tests/structure/**
//       Integration: tests/schema/**
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Surface console.log output during tests so the verbose traces we add
    // actually show up — Vitest hides logs by default unless a test fails.
    silent: false,
    projects: [
      {
        // ── Unit / HTTP / lib tests (no DB required) ──────────────────────
        test: {
          name: 'unit',
          include: [
            'tests/config/**/*.test.ts',
            'tests/http/**/*.test.ts',
            'tests/lib/**/*.test.ts',
            'tests/lifecycle/**/*.test.ts',
            'tests/structure/**/*.test.ts',
            'tests/helpers/**/*.test.ts',
          ],
          // Lightweight setup: loads .env.test vars so any transitive import
          // of src/config/env.ts (boot-time singleton) doesn't call process.exit.
          // NO database migrations — these tests use mock prisma.
          setupFiles: ['tests/setup-unit.ts'],
        },
      },
      {
        // ── Integration tests (DB required) ──────────────────────────────
        test: {
          name: 'integration',
          include: ['tests/schema/**/*.test.ts'],
          setupFiles: ['tests/setup.ts'],
        },
      },
    ],
  },
});
