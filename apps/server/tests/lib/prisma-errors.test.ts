// ─────────────────────────────────────────────────────────────────────────────
// prisma-errors.ts unit tests (REQ-7, T-4)
//
// Asserts that normalizePrismaError maps Prisma error codes to HTTP ApiErrors.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { normalizePrismaError } from '../../src/shared/prisma-errors.js';
import { ApiError } from '../../src/shared/ApiError.js';

// Minimal fake PrismaClientKnownRequestError — avoids importing @prisma/client
// in unit tests (which would need the generated client).
function makePrismaError(code: string): Error & { code: string } {
  const err = new Error(`Prisma error ${code}`) as Error & { code: string };
  err.name = 'PrismaClientKnownRequestError';
  err.code = code;
  return err;
}

describe('normalizePrismaError', () => {
  it('maps P2002 (unique constraint) → 409 conflict', () => {
    const err = makePrismaError('P2002');
    const result = normalizePrismaError(err);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.statusCode).toBe(409);
    expect(result.code).toBe('CONFLICT');
    expect(result.message).toBe('Resource already exists');
  });

  it('maps P2025 (record not found) → 404 not_found', () => {
    const err = makePrismaError('P2025');
    const result = normalizePrismaError(err);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.statusCode).toBe(404);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe('Resource not found');
  });

  it('maps other P2xxx codes → 500 internal_error', () => {
    const err = makePrismaError('P2003');
    const result = normalizePrismaError(err);
    expect(result).toBeInstanceOf(ApiError);
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('Internal server error');
  });

  it('maps P2034 (transaction conflict) → 500 internal_error', () => {
    const err = makePrismaError('P2034');
    const result = normalizePrismaError(err);
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});
