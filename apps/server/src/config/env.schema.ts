import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Env schema definition (REQ-10)
//
// Exported as a pure module — no process.env access, no side effects.
// Import this in tests to call parseEnv() with controlled inputs.
// Import src/config/env.ts in production code to get the validated singleton.
// ─────────────────────────────────────────────────────────────────────────────

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    AUTH0_DOMAIN: z.string(),
    AUTH0_AUDIENCE: z.string(),
    ASCEND_API_BASE_URL: z.string().url().default('https://oss.exercisedb.dev/api/v1'),
    // LOG_LEVEL is optional at input — default applied conditionally in transform.
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .optional(),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    READINESS_DB_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    BODY_LIMIT: z.string().default('1mb'),
  })
  .transform((raw) => ({
    ...raw,
    // Conditional LOG_LEVEL default: debug for non-production, info for production.
    LOG_LEVEL: raw.LOG_LEVEL ?? (raw.NODE_ENV === 'production' ? 'info' : 'debug'),
  }));

export type Env = z.output<typeof envSchema>;

/**
 * Parse and validate an env record.
 *
 * Throws a descriptive Error if any required field is missing or invalid.
 * The message names each offending field so operators know exactly what to fix.
 *
 * @example
 * // In tests: call with a controlled object — no process.exit triggered.
 * const env = parseEnv({ DATABASE_URL: 'postgresql://...', ... });
 */
export function parseEnv(input: Record<string, unknown>): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    const lines = Object.entries(fields)
      .map(([k, msgs]) => `  ${k}: ${(msgs ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${lines}`);
  }
  return result.data;
}
