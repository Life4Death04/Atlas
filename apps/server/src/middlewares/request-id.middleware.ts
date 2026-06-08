// ─────────────────────────────────────────────────────────────────────────────
// Request ID middleware (REQ-6, design §6)
//
// For every incoming request:
//   1. Inspect the X-Request-Id header
//   2. If present and matching the safe-printable-ASCII regex → honor it
//   3. Otherwise → generate a UUID v4 (Node 20+ crypto.randomUUID, no package)
//   4. Attach to req.requestId (typed in src/types/express.d.ts)
//   5. Echo in the X-Request-Id response header
//
// The regex ^[\x21-\x7E]{1,128}$ matches printable ASCII characters from '!'
// (0x21) through '~' (0x7E), 1 to 128 chars. Excludes space (0x20) and DEL (0x7F).
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Printable ASCII, 1–128 chars. Space (0x20) and DEL (0x7F) intentionally excluded. */
const SAFE_REQUEST_ID = /^[\x21-\x7E]{1,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
