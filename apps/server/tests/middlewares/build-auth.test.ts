// ─────────────────────────────────────────────────────────────────────────────
// buildAuth factory tests (REQ-13)
//
// Verifies that buildAuth(env) dispatches correctly based on NODE_ENV:
//   - test env  → secret = TEST_JWT_PUBLIC_KEY, tokenSigningAlg = 'RS256'
//                  validates a locally signed JWT; zero outbound network calls
//   - prod env  → issuerBaseURL = https://${AUTH0_DOMAIN}, audience = AUTH0_AUDIENCE
//                  (we verify the middleware is constructed; no live Auth0 call)
//
// Network isolation: spy on globalThis.fetch to assert zero outbound calls
// when a test-mode token is validated.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { parseEnv } from '../../src/config/env.schema.js';
import { TEST_PUBLIC_KEY, signTestJWT } from '../helpers/auth.js';
import { buildAuth } from '../../src/middlewares/auth.middleware.js';

// ── Env factories ─────────────────────────────────────────────────────────────

function makeTestEnv() {
  return parseEnv({
    NODE_ENV: 'test',
    PORT: '3001',
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
    CLIENT_URL: 'http://localhost:5173',
    AUTH0_DOMAIN: 'test.auth0.com',
    AUTH0_AUDIENCE: 'https://test-api.example.com',
    TEST_JWT_PUBLIC_KEY: TEST_PUBLIC_KEY,
  });
}

function makeProdEnv() {
  return parseEnv({
    NODE_ENV: 'production',
    PORT: '3001',
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
    CLIENT_URL: 'http://localhost:5173',
    AUTH0_DOMAIN: 'prod.auth0.com',
    AUTH0_AUDIENCE: 'https://prod-api.example.com',
  });
}

// ── Minimal request/response/next helpers ─────────────────────────────────────

function makeReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    method: 'GET',
    url: '/test',
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('buildAuth factory (REQ-13)', () => {
  describe('env dispatch', () => {
    it('returns a RequestHandler (function) for NODE_ENV=test', () => {
      const env = makeTestEnv();
      const middleware = buildAuth(env);
      expect(typeof middleware).toBe('function');
    });

    it('returns a RequestHandler (function) for NODE_ENV=production', () => {
      const env = makeProdEnv();
      const middleware = buildAuth(env);
      expect(typeof middleware).toBe('function');
    });
  });

  describe('test env — local RS256 validation', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on globalThis.fetch to assert zero outbound network calls
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Network call detected — should not reach out in test mode'),
      );
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('accepts a valid locally-signed RS256 JWT in NODE_ENV=test', async () => {
      const env = makeTestEnv();
      const middleware = buildAuth(env);

      const token = await signTestJWT({
        sub: 'auth0|test123',
        'https://atlas.app/email': 'test@example.com',
      });

      const req = makeReq(`Bearer ${token}`);
      const res = makeRes();

      await new Promise<void>((resolve, reject) => {
        const next: NextFunction = (err?: unknown) => {
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve();
        };
        middleware(req, res, next);
      });

      // If we reach here, the middleware called next() without an error → token accepted
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects a JWT with an invalid signature in NODE_ENV=test', async () => {
      const env = makeTestEnv();
      const middleware = buildAuth(env);

      // Tamper the token by altering the signature segment
      const token = await signTestJWT({ sub: 'auth0|test456' });
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      const req = makeReq(`Bearer ${tamperedToken}`);
      const res = makeRes();

      const err = await new Promise<unknown>((resolve) => {
        const next: NextFunction = (e?: unknown) => resolve(e);
        middleware(req, res, next);
      });

      // next() should have been called with an error (401 UnauthorizedError)
      expect(err).toBeDefined();
      expect(err).toBeInstanceOf(Error);
    });

    it('makes zero outbound fetch calls when validating a test-mode JWT', async () => {
      const env = makeTestEnv();
      const middleware = buildAuth(env);

      const token = await signTestJWT({ sub: 'auth0|nofetch' });
      const req = makeReq(`Bearer ${token}`);
      const res = makeRes();

      await new Promise<void>((resolve, reject) => {
        const next: NextFunction = (err?: unknown) => {
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve();
        };
        middleware(req, res, next);
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('production env — Auth0 JWKS config', () => {
    it('does not call fetch at construction time for prod env', () => {
      // buildAuth should not eagerly fetch JWKS — only when a request arrives
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      const env = makeProdEnv();

      buildAuth(env);

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
