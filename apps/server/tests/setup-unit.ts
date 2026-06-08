// ─────────────────────────────────────────────────────────────────────────────
// Lightweight setup for unit / HTTP / lib tests.
//
// Responsibilities:
//   1. Load `.env.test` (or `.env`) so the boot-time env.ts singleton has
//      enough vars to parse without calling process.exit.
//   2. NO database migrations — these tests use mock deps only.
//
// Tests that directly call `parseEnv({ ... })` don't need any of this — they
// supply their own input. But importing `src/config/env.ts` as a side-effect
// (e.g. transitively through other src imports) requires a valid process.env.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const envTestPath = resolve(process.cwd(), '.env.test');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
