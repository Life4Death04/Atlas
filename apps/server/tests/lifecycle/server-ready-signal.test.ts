// ─────────────────────────────────────────────────────────────────────────────
// emitServerReady() unit tests (CONV-1)
//
// Verifies that:
//   - SERVER_READY is written to stdout when NODE_ENV !== 'production'
//   - SERVER_READY is NOT written to stdout when NODE_ENV === 'production'
//
// This guards design §5 / REQ-5: production stdout must be clean NDJSON;
// a bare non-JSON line would corrupt strict log parsers.
//
// TDD: Tests written RED before emitServerReady() exists in src/lib/server-ready.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { emitServerReady } from '../../src/lib/server-ready.js';

describe('emitServerReady() (CONV-1, REQ-5)', () => {
  it('writes SERVER_READY\\n to stdout when NODE_ENV is "test"', () => {
    const mockStdout = { write: vi.fn() };

    emitServerReady({ NODE_ENV: 'test' }, mockStdout);

    expect(mockStdout.write).toHaveBeenCalledOnce();
    expect(mockStdout.write).toHaveBeenCalledWith('SERVER_READY\n');
  });

  it('writes SERVER_READY\\n to stdout when NODE_ENV is "development"', () => {
    const mockStdout = { write: vi.fn() };

    emitServerReady({ NODE_ENV: 'development' }, mockStdout);

    expect(mockStdout.write).toHaveBeenCalledOnce();
    expect(mockStdout.write).toHaveBeenCalledWith('SERVER_READY\n');
  });

  it('does NOT write anything to stdout when NODE_ENV is "production"', () => {
    const mockStdout = { write: vi.fn() };

    emitServerReady({ NODE_ENV: 'production' }, mockStdout);

    expect(mockStdout.write).not.toHaveBeenCalled();
  });
});
