// ─────────────────────────────────────────────────────────────────────────────
// Env schema contract tests (REQ-10, REQ-13)
//
// These tests validate that the Zod env schema:
//   1. Exits non-zero (throws) when DATABASE_URL is missing
//   2. Exits non-zero (throws) when LOG_LEVEL has an invalid value
//   3. Parses a complete valid env and returns typed values (PORT as number)
//   4. (REQ-13) Fails-fast naming TEST_JWT_PUBLIC_KEY when NODE_ENV=test and key is absent
//
// Because env.ts exits the process on failure, we test the parseEnv() exported
// function directly so we can control the input without side-effects.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../src/config/env.schema.js';

// Placeholder PEM — structure valid for schema validation; not used for real crypto here.
const TEST_PEM_STUB =
  '-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAMock\n-----END PUBLIC KEY-----\n';

const validBase = {
  NODE_ENV: 'test',
  PORT: '3001',
  HOST: '0.0.0.0',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
  CLIENT_URL: 'http://localhost:5173',
  AUTH0_DOMAIN: 'example.auth0.com',
  AUTH0_AUDIENCE: 'https://api.example.com',
  ASCEND_API_BASE_URL: 'https://oss.exercisedb.dev/api/v1',
  LOG_LEVEL: 'info',
  SHUTDOWN_TIMEOUT_MS: '10000',
  READINESS_DB_TIMEOUT_MS: '2000',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX: '100',
  BODY_LIMIT: '1mb',
  // REQ-13 — required for NODE_ENV=test
  TEST_JWT_PUBLIC_KEY: TEST_PEM_STUB,
};

describe('parseEnv', () => {
  it('throws when DATABASE_URL is missing', () => {
    const input = { ...validBase };
    delete (input as Record<string, unknown>)['DATABASE_URL'];
    expect(() => parseEnv(input)).toThrow(/DATABASE_URL/);
  });

  it('throws when LOG_LEVEL is invalid', () => {
    const input = { ...validBase, LOG_LEVEL: 'shouty' };
    expect(() => parseEnv(input)).toThrow(/LOG_LEVEL/);
  });

  it('parses valid env and returns PORT as a number', () => {
    const result = parseEnv(validBase);
    expect(result.PORT).toBe(3001);
    expect(typeof result.PORT).toBe('number');
  });

  it('applies conditional LOG_LEVEL default: debug in non-production', () => {
    const input = { ...validBase };
    delete (input as Record<string, unknown>)['LOG_LEVEL'];
    const result = parseEnv({ ...input, NODE_ENV: 'development' });
    expect(result.LOG_LEVEL).toBe('debug');
  });

  it('applies conditional LOG_LEVEL default: info in production', () => {
    const input = { ...validBase };
    delete (input as Record<string, unknown>)['LOG_LEVEL'];
    const result = parseEnv({ ...input, NODE_ENV: 'production' });
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('DIRECT_URL is required and throws when missing', () => {
    const input = { ...validBase };
    delete (input as Record<string, unknown>)['DIRECT_URL'];
    expect(() => parseEnv(input)).toThrow(/DIRECT_URL/);
  });

  it('PORT defaults to 3001 when not set', () => {
    const input = { ...validBase };
    delete (input as Record<string, unknown>)['PORT'];
    const result = parseEnv(input);
    expect(result.PORT).toBe(3001);
  });

  it('HOST defaults to 0.0.0.0 when not set', () => {
    const input = { ...validBase };
    delete (input as Record<string, unknown>)['HOST'];
    const result = parseEnv(input);
    expect(result.HOST).toBe('0.0.0.0');
  });

  // ── REQ-13 — Env-driven auth factory fail-fast ────────────────────────────
  it('throws naming TEST_JWT_PUBLIC_KEY when NODE_ENV=test and key is absent', () => {
    const input = { ...validBase, NODE_ENV: 'test' };
    delete (input as Record<string, unknown>)['TEST_JWT_PUBLIC_KEY'];
    expect(() => parseEnv(input)).toThrow(/TEST_JWT_PUBLIC_KEY/);
  });

  it('throws naming TEST_JWT_PUBLIC_KEY when NODE_ENV=test and key is empty string', () => {
    const input = { ...validBase, NODE_ENV: 'test', TEST_JWT_PUBLIC_KEY: '' };
    expect(() => parseEnv(input)).toThrow(/TEST_JWT_PUBLIC_KEY/);
  });

  it('accepts valid env when NODE_ENV=test and TEST_JWT_PUBLIC_KEY is provided', () => {
    const input = { ...validBase, NODE_ENV: 'test', TEST_JWT_PUBLIC_KEY: TEST_PEM_STUB };
    expect(() => parseEnv(input)).not.toThrow();
  });

  it('accepts valid env when NODE_ENV=development without TEST_JWT_PUBLIC_KEY', () => {
    const input = { ...validBase, NODE_ENV: 'development' };
    delete (input as Record<string, unknown>)['TEST_JWT_PUBLIC_KEY'];
    expect(() => parseEnv(input)).not.toThrow();
  });
});
