import type { JWTPayload } from 'express-oauth2-jwt-bearer';

declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload;
    }
  }
}
