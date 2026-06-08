// ─────────────────────────────────────────────────────────────────────────────
// Not-found middleware (design §1)
//
// Catches all unmatched routes and returns a 404 JSON response.
//
// MUST be mounted AFTER all route handlers but BEFORE the error handler.
// This ensures that any unmatched request is caught here rather than falling
// through to the error handler (which handles thrown errors, not missing routes).
// ─────────────────────────────────────────────────────────────────────────────

import type { RequestHandler } from 'express';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    statusCode: 404,
  });
};
