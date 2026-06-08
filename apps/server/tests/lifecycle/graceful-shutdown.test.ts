// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown tests (T-10, REQ-4, design §10)
//
// Tests:
//   Unit:
//     - shutdown() calls server.close, then prisma.$disconnect in order
//     - shutdown() returns 0 on clean drain
//     - shutdown() logs info with reason
//
//   Integration:
//     - Child process spawned via node (compiled JS), receives SIGTERM, exits 0
//     - Uses dist/src/server.js — built during T-13 or by explicit build step
//
// TDD: Tests written RED before shutdown() function is extracted.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// ── Unit tests — fakes + call-order verification ─────────────────────────────

describe('shutdown() pure function (unit, T-10)', () => {
  // Import shutdown directly from the pure module — no server.ts side effects
  let shutdown: (reason: string, deps: import('../../src/lib/shutdown.js').ShutdownDeps) => Promise<number>;

  beforeEach(async () => {
    // Dynamic import of the pure shutdown module (no side effects)
    const mod = await import('../../src/lib/shutdown.js');
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
      server: fakeServer as unknown as import('node:http').Server,
      prisma: fakePrisma,
      logger: fakeLogger as unknown as import('../../src/lib/shutdown.js').ShutdownDeps['logger'],
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
      server: fakeServer as unknown as import('node:http').Server,
      prisma: fakePrisma,
      logger: fakeLogger as unknown as import('../../src/lib/shutdown.js').ShutdownDeps['logger'],
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
      server: fakeServer as unknown as import('node:http').Server,
      prisma: fakePrisma,
      logger: fakeLogger as unknown as import('../../src/lib/shutdown.js').ShutdownDeps['logger'],
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
  // S14: use fileURLToPath instead of .pathname — Windows-safe path resolution
  const serverRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const distServerJs = path.join(serverRoot, 'dist', 'src', 'server.js');

  beforeAll(() => {
    // Build the server if dist doesn't exist (idempotent — tsc is a no-op if up to date)
    if (!existsSync(distServerJs)) {
      execSync('pnpm build', { cwd: serverRoot, stdio: 'pipe' });
    }
  });

  it('server process exits 0 after SIGTERM within 5s', async () => {
    // Spawn the compiled JS directly via node — no tsx wrapper, single process.
    // SIGTERM goes directly to the Node process, which triggers our shutdown handler.
    const child = spawn('node', [distServerJs], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3099', // specific high port to avoid conflicts in CI
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_AUDIENCE: 'https://test-api.example.com',
        SHUTDOWN_TIMEOUT_MS: '3000',
        LOG_LEVEL: 'warn', // suppress info output; 'silent' is not a valid pino level in env schema
      },
      stdio: 'pipe',
    });

    // S6: Wait for the server to emit 'SERVER_READY' on stdout before sending SIGTERM.
    // This replaces the fixed 1.5s sleep — the test only unblocks when the server
    // is truly listening, making it reliable on both fast and slow CI machines.
    // A 5s hard timeout prevents the test from hanging if the line is never emitted.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server did not emit SERVER_READY within 5 seconds'));
      }, 5000);

      let buffer = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        if (buffer.includes('SERVER_READY')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    // Send SIGTERM to the spawned Node process
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
