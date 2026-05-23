// ─────────────────────────────────────────────────────────────────────────────
// Global test setup — runs ONCE per Vitest test process before any test file.
//
// Responsibilities:
//   1. Load `.env.test` so TEST_DATABASE_URL is available (and so devs don't
//      have to export it manually each shell session).
//   2. Validate TEST_DATABASE_URL is set.
//   3. Refuse to run if TEST_DATABASE_URL is the same as DATABASE_URL — this
//      is a destructive guard. Tests TRUNCATE the entire DB between cases,
//      so pointing them at the dev DB would wipe real data.
//   4. Run `prisma migrate deploy` so the test DB schema is in sync before
//      any test starts. This is the non-interactive variant of `migrate dev`
//      — it never prompts, never resets, just applies pending migrations.
//
// All logs use the `[setup]` prefix so the trace is easy to find when
// debugging CI output.
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const log = (msg: string): void => {
  console.log(`[setup] ${msg}`);
};

// 1. Load .env.test if it exists. Path is relative to the server package root
//    because Vitest runs with cwd = apps/server.
const envTestPath = resolve(process.cwd(), '.env.test');
if (existsSync(envTestPath)) {
  log(`loading env from ${envTestPath}`);
  dotenv.config({ path: envTestPath });
} else {
  log('.env.test not found — relying on process env (this is normal in CI)');
}

// 2. Validate TEST_DATABASE_URL is present.
const testDbUrl = process.env['TEST_DATABASE_URL'];
if (!testDbUrl) {
  throw new Error(
    '[setup] TEST_DATABASE_URL is not set. Copy apps/server/.env.test.example ' +
      'to apps/server/.env.test (or export the variable) before running tests.',
  );
}

// 3. Safety guard — never let tests run against the dev DB.
const devDbUrl = process.env['DATABASE_URL'];
if (devDbUrl && devDbUrl === testDbUrl) {
  throw new Error(
    '[setup] TEST_DATABASE_URL is identical to DATABASE_URL. Refusing to run ' +
      'tests against the dev database (tests TRUNCATE all tables).',
  );
}

log(`test DB target: ${redactUrl(testDbUrl)}`);

// 4. Apply migrations. We point Prisma at TEST_DATABASE_URL by overriding
//    DATABASE_URL for this child process only — `prisma migrate deploy`
//    reads from DATABASE_URL by convention.
log('running `prisma migrate deploy` against test DB…');
try {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
    },
  });
  log('migrations applied');
} catch (err) {
  log('migrations FAILED — is the test Postgres running? (docker compose -f docker-compose.test.yml up -d)');
  throw err;
}

/**
 * Strip password from a Postgres URL for safe logging.
 *
 * `postgresql://user:secret@host/db` → `postgresql://user:***@host/db`
 */
function redactUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}
