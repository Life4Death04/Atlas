// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown tests (T-10, REQ-4, design §10)
//
// Tests:
//   Unit:
//     - shutdown() calls server.close, then prisma.$disconnect in order
//     - shutdown() returns 0 on clean drain
//     - shutdown() forced-timeout path logs warning and returns 1 (or exits 1)
//
//   Integration:
//     - Child process spawned, receives SIGTERM, exits 0 within 5s
//
// TDD: Tests written RED before shutdown() function is extracted.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';

// ── Unit tests — fakes + call-order verification ─────────────────────────────

describe('shutdown() pure function (unit, T-10)', () => {
  // We import the shutdown function under test — it doesn't exist yet (RED)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shutdown: (reason: string, deps: any) => Promise<number>;

  beforeEach(async () => {
    // Dynamic import to pick up the module under test; Vitest isolates per test
    const mod = await import('../../src/server.js');
    shutdown = mod.shutdown;
  });

  it('calls server.close() then prisma.$disconnect() in order', async () => {
    const callOrder: string[] = [];

    const fakeServer = {
      close: vi.fn((cb?: () => void) => {
        callOrder.push('server.close');
        cb?.();
      }),
    };

    const fakePrisma = {
      $disconnect: vi.fn(async () => {
        callOrder.push('prisma.$disconnect');
      }),
    };

    const fakeLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = await shutdown('SIGTERM', {
      server: fakeServer,
      prisma: fakePrisma,
      logger: fakeLogger,
      timeoutMs: 5000,
    });

    expect(callOrder).toEqual(['server.close', 'prisma.$disconnect']);
    expect(result).toBe(0);
    expect(fakeServer.close).toHaveBeenCalledOnce();
    expect(fakePrisma.$disconnect).toHaveBeenCalledOnce();
  });

  it('returns 0 on clean drain (no timeout)', async () => {
    const fakeServer = {
      close: vi.fn((cb?: () => void) => { cb?.(); }),
    };
    const fakePrisma = { $disconnect: vi.fn(async () => undefined) };
    const fakeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await shutdown('SIGINT', {
      server: fakeServer,
      prisma: fakePrisma,
      logger: fakeLogger,
      timeoutMs: 5000,
    });

    expect(result).toBe(0);
  });

  it('logs shutdown info message with reason', async () => {
    const fakeServer = {
      close: vi.fn((cb?: () => void) => { cb?.(); }),
    };
    const fakePrisma = { $disconnect: vi.fn(async () => undefined) };
    const fakeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await shutdown('SIGTERM', {
      server: fakeServer,
      prisma: fakePrisma,
      logger: fakeLogger,
      timeoutMs: 5000,
    });

    // Should log the reason at info level
    expect(fakeLogger.info).toHaveBeenCalled();
    const firstCallArg = fakeLogger.info.mock.calls[0];
    const logObj = firstCallArg[0];
    expect(logObj).toMatchObject({ reason: 'SIGTERM' });
  });
});

// ── Integration test — real child process ─────────────────────────────────────

describe('Graceful shutdown integration (T-10)', () => {
  it('server process exits 0 after SIGTERM within 5s', async () => {
    // The integration test spawns the compiled server (ts-node or tsx) and sends
    // SIGTERM, then asserts it exits 0 within 5 seconds.
    // We use tsx to run directly from source without a build step.

    const serverPath = path.resolve(
      new URL('../../src/server.ts', import.meta.url).pathname,
    );

    const envVars = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '0', // port 0 to avoid conflicts (OS picks free port)
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
      AUTH0_DOMAIN: 'test.auth0.com',
      AUTH0_AUDIENCE: 'https://test-api.example.com',
      SHUTDOWN_TIMEOUT_MS: '3000',
      LOG_LEVEL: 'silent',
    };

    const child = spawn(
      'node',
      ['--import', 'tsx/esm', serverPath],
      {
        env: envVars,
        stdio: 'pipe',
      },
    );

    // Wait for server to boot (listen for "Server running" log or give 1s)
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    // Send SIGTERM
    child.kill('SIGTERM');

    // Assert exit 0 within 5s
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Child process did not exit within 5 seconds after SIGTERM'));
      }, 5000);

      child.on('exit', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });

    expect(exitCode).toBe(0);
  }, 15000); // generous timeout for CI
});
