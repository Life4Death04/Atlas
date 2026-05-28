// ─────────────────────────────────────────────────────────────────────────────
// asyncHandler — wraps async route handlers to forward rejected promises to
// Express's next(err) error handler.
//
// Moved from src/utils/asyncHandler.ts (unchanged).
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
