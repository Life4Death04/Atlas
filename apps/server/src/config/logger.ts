// ─────────────────────────────────────────────────────────────────────────────
// Legacy logger stub — replaces the removed Winston logger.
//
// This file will be DELETED and replaced by src/lib/logger.ts (Pino) in T-6
// (slice 2). It exists here only to keep server.ts compilable after winston
// removal (T-1). It uses console.* so startup logs still appear in dev.
//
// Do NOT add functionality here — full Pino logger is T-6.
// ─────────────────────────────────────────────────────────────────────────────

export const logger = {
  info: (...args: unknown[]) => console.log('[info]', ...args),
  warn: (...args: unknown[]) => console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
  debug: (...args: unknown[]) => console.debug('[debug]', ...args),
};
