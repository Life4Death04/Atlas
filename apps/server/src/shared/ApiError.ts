// ─────────────────────────────────────────────────────────────────────────────
// ApiError — typed HTTP errors (REQ-7)
//
// Moved from src/utils/ApiError.ts. Updated to add `details?: unknown` param
// (backward-compatible — all existing call sites with 3 args are unaffected).
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static badRequest(message: string) {
    return new ApiError(400, 'BAD_REQUEST', message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
