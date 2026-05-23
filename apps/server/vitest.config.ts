// ─────────────────────────────────────────────────────────────────────────────
// Vitest configuration for the Atlas server package.
//
// Why these choices:
//   • pool: 'forks' + singleFork: true
//       Database tests share a single Postgres instance and TRUNCATE between
//       tests. Running them in parallel forks/threads would cause cross-test
//       contamination (one test wiping data while another inserts). A single
//       fork keeps everything serial and predictable.
//
//   • globals: false
//       We import `describe`, `it`, `expect`, etc. explicitly. This keeps the
//       test files honest about their dependencies and plays nicely with
//       TypeScript NodeNext module resolution.
//
//   • testTimeout: 30000
//       DB tests have to wait for Postgres connections, migrations, and
//       cascading deletes. 30s is generous but avoids flakiness on slower
//       CI runners.
//
//   • setupFiles: ['tests/setup.ts']
//       Runs once per test process — validates env, runs `prisma migrate
//       deploy` against the test DB, and loads `.env.test` so local dev
//       doesn't need to export TEST_DATABASE_URL manually.
//
//   • include: ['tests/**/*.test.ts']
//       Keeps tests isolated under `tests/` so they never collide with
//       production code or Prisma's generated files.
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 30000,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Surface console.log output during tests so the verbose traces we add
    // actually show up — Vitest hides logs by default unless a test fails.
    silent: false,
  },
});
