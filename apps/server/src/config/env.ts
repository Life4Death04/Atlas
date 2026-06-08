// ─────────────────────────────────────────────────────────────────────────────
// Boot-time env singleton (REQ-10)
//
// Parses process.env via the Zod schema and exports a validated `env` object.
// On validation failure, logs each missing/invalid field and exits non-zero.
//
// NOTE: dotenv/config is loaded in server.ts (the process entry point) BEFORE
// this module is first imported. Do NOT re-import dotenv here.
//
// For tests that need to call parseEnv with controlled input, import directly
// from './env.schema.js' — that module has no side effects.
// ─────────────────────────────────────────────────────────────────────────────

export { parseEnv } from './env.schema.js';
export type { Env } from './env.schema.js';

import { envSchema } from './env.schema.js';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
