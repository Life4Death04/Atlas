// ─────────────────────────────────────────────────────────────────────────────
// Prisma → HTTP error normalizer (REQ-7, design §7)
//
// Maps PrismaClientKnownRequestError codes to ApiError instances.
// Constraint names and metadata are NEVER returned to the client (info leak);
// they should be passed to the logger by the caller.
//
// Import note: we check `err.name === 'PrismaClientKnownRequestError'` and
// access `err.code` structurally (duck-typed) to avoid importing
// @prisma/client/runtime/library in tests and to decouple from the Prisma
// client version. The caller is responsible for the instanceof check if needed.
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError } from './ApiError.js';

type PrismaErrorLike = Error & { code: string };

/**
 * Normalize a Prisma known request error into an ApiError.
 *
 * @param err - An error with a Prisma `code` property (P2xxx).
 * @returns ApiError with the appropriate HTTP status and safe client message.
 */
export function normalizePrismaError(err: PrismaErrorLike): ApiError {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      return new ApiError(409, 'CONFLICT', 'Resource already exists');

    case 'P2025':
      // Record not found
      return new ApiError(404, 'NOT_FOUND', 'Resource not found');

    default:
      // All other P2xxx codes → 500 (never leak details)
      return new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}

/**
 * Type guard: returns true if err is a Prisma known request error.
 *
 * Used by the error handler middleware to identify Prisma errors without
 * importing the full @prisma/client runtime.
 */
export function isPrismaKnownError(err: unknown): err is PrismaErrorLike {
  return (
    err instanceof Error &&
    err.name === 'PrismaClientKnownRequestError' &&
    typeof (err as PrismaErrorLike).code === 'string' &&
    (err as PrismaErrorLike).code.startsWith('P')
  );
}
