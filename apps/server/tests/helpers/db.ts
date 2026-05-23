// ─────────────────────────────────────────────────────────────────────────────
// Test DB client + utilities.
//
// Why a separate client (not the singleton from src/config/prisma.ts):
//   The singleton reads DATABASE_URL at import time and points at the dev
//   database. Tests need TEST_DATABASE_URL. We instantiate a dedicated client
//   here so a stray import of the singleton can never accidentally let a test
//   talk to the dev DB.
//
// We use the same PrismaPg adapter pattern as production for parity — the
// schema generator (`provider = "prisma-client"`) expects a driver adapter.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

const connectionString = process.env['TEST_DATABASE_URL'];
if (!connectionString) {
  // setup.ts validates this too, but importing this module without setup
  // (e.g. via a future REPL helper) should fail loudly rather than silently
  // connecting to undefined.
  throw new Error('[db] TEST_DATABASE_URL is not set — import order issue?');
}

const adapter = new PrismaPg({ connectionString });

/**
 * Prisma client bound to the test database.
 *
 * Use this in tests instead of importing from `src/config/prisma.ts`.
 */
export const prisma = new PrismaClient({ adapter });

/**
 * Wipe every user table in the public schema.
 *
 * Strategy:
 *   • Query `information_schema.tables` to discover every base table in the
 *     public schema. This means new models added to schema.prisma are picked
 *     up automatically — we don't have to maintain a hand-written list.
 *   • Skip `_prisma_migrations` so we don't have to re-run migrations on
 *     every test.
 *   • TRUNCATE ... RESTART IDENTITY CASCADE: removes all rows, resets serial
 *     sequences, and follows FKs so we don't have to order the truncations.
 *
 * Called from `beforeEach` in every test file to guarantee a clean slate.
 */
export async function truncateAll(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (rows.length === 0) {
    console.log('[db] no tables to truncate (DB may be empty)');
    return;
  }

  // Quote each identifier to handle case-sensitive table names like "User".
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  console.log(`[db] truncating ${rows.length} tables`);
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

/**
 * Close the Prisma connection pool. Call in `afterAll` so the test process
 * exits cleanly instead of hanging on open connections.
 */
export async function disconnect(): Promise<void> {
  console.log('[db] disconnecting test client');
  await prisma.$disconnect();
}
