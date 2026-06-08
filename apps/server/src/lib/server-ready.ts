// ─────────────────────────────────────────────────────────────────────────────
// emitServerReady — pure module (CONV-1, REQ-5, design §5)
//
// Writes 'SERVER_READY\n' to stdout for integration test stdout listeners,
// but ONLY when NODE_ENV !== 'production'.
//
// Rationale: production stdout is strict NDJSON (pino). A bare non-JSON line
// corrupts log parsers. Integration tests run with NODE_ENV=test, so they
// still receive the signal without any production impact.
//
// This module has ZERO side effects — no env singleton import, no process.env
// access. All inputs are injected, making this trivially testable.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a machine-readable ready marker to the given writable stream.
 *
 * The marker is gated on `env.NODE_ENV !== 'production'` to keep production
 * stdout clean NDJSON per design REQ-5.
 *
 * @param env    - Object containing NODE_ENV (injected — no singleton access).
 * @param stdout - Writable target (defaults to process.stdout in production use).
 */
export function emitServerReady(
  env: { NODE_ENV: string },
  stdout: { write(s: string): unknown },
): void {
  if (env.NODE_ENV !== 'production') {
    stdout.write('SERVER_READY\n');
  }
}
