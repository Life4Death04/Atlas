// ─────────────────────────────────────────────────────────────────────────────
// Prisma CLI configuration (T-12, REQ-10, design §4)
//
// Uses Prisma's env() helper (from prisma/config) — NOT dotenv/config.
// dotenv/config is loaded ONCE in server.ts (the process entry point).
// Prisma CLI auto-loads .env files; this config just references the var names.
//
// DIRECT_URL: direct (non-pooled) Postgres connection required by Prisma CLI
// for migrations and schema introspection (bypasses PgBouncer/Prisma Pooler).
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seeds/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    directUrl: env('DIRECT_URL'),
  },
});
