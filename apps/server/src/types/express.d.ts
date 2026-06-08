import type { JWTPayload } from 'express-oauth2-jwt-bearer';

declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload;
      /** Correlation ID — set by requestId middleware on every request. */
      requestId: string;
    }
  }
}
