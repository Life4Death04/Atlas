// ─────────────────────────────────────────────────────────────────────────────
// Test JWT helpers (REQ-13)
//
// signTestJWT — signs a JWT with the test RS256 private key fixture.
// TEST_PUBLIC_KEY — the corresponding public key string for parseEnv calls.
//
// These helpers are TEST-ONLY. The keypair in tests/fixtures/test-keypair/
// MUST NEVER be reused outside of tests.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignJWT, importPKCS8 } from 'jose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYPAIR_DIR = resolve(__dirname, '../fixtures/test-keypair');

// Read the PEM files once at module load. Lines starting with '#' are comments
// — strip them before passing to PEM parsers that expect pure PEM content.
function stripComments(pem: string): string {
  return pem
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n');
}

const rawPrivate = readFileSync(resolve(KEYPAIR_DIR, 'private.pem'), 'utf-8');
const rawPublic = readFileSync(resolve(KEYPAIR_DIR, 'public.pem'), 'utf-8');

const PRIVATE_KEY_PEM = stripComments(rawPrivate);

/**
 * RS256 public key PEM string for use in `parseEnv({ TEST_JWT_PUBLIC_KEY: TEST_PUBLIC_KEY })`.
 *
 * This is the test-only key — never use in production.
 */
export const TEST_PUBLIC_KEY: string = stripComments(rawPublic);

export interface JWTClaims {
  sub?: string;
  /** Auth0 namespaced email claim */
  'https://atlas.app/email'?: string;
  /** Auth0 namespaced name claim */
  'https://atlas.app/name'?: string;
  [key: string]: unknown;
}

export interface SignOptions {
  /** Token expiry — default '1h' */
  expiresIn?: string;
  /** JWT audience — default 'https://test-api.example.com' */
  audience?: string;
  /** JWT issuer — default 'https://test.auth0.com/' */
  issuer?: string;
}

/**
 * Sign a test JWT with RS256 using the bundled test private key.
 *
 * Defaults to a 1-hour expiry, test audience, and test issuer.
 * Use `claims` to supply `sub`, email, and name as needed by the test scenario.
 *
 * @example
 * const token = await signTestJWT({ sub: 'auth0|test123', 'https://atlas.app/email': 'a@b.io' });
 */
export async function signTestJWT(
  claims: JWTClaims = {},
  opts: SignOptions = {},
): Promise<string> {
  const {
    expiresIn = '1h',
    audience = 'https://test-api.example.com',
    issuer = 'https://test.auth0.com/',
  } = opts;

  const privateKey = await importPKCS8(PRIVATE_KEY_PEM, 'RS256');

  const jwt = new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresIn);

  if (claims.sub != null) {
    jwt.setSubject(claims.sub);
  }

  return jwt.sign(privateKey);
}
