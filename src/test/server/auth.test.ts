/**
 * Auth system unit tests — City Gate Capital
 *
 * Tests the core authentication primitives:
 *   - Session store (create, get, delete, TTL, max sessions)
 *   - Brute-force lockout
 *   - Input validation helpers
 *
 * These are pure unit tests with no HTTP server needed.
 * They run in Node.js (not jsdom) via vitest.
 */

import { describe,expect,it } from 'vitest';

// ── Session store ─────────────────────────────────────────────────────────────

describe('generateSessionToken', () => {
  it('returns a 64-character hex string', async () => {
    const { generateSessionToken } = await import('../../server/lib/sessionStore.js');
    const token = generateSessionToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('generates unique tokens on each call', async () => {
    const { generateSessionToken } = await import('../../server/lib/sessionStore.js');
    const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));
    expect(tokens.size).toBe(100);
  });
});

// ── Input validators ──────────────────────────────────────────────────────────

describe('sanitizeString', () => {
  it('strips HTML tags', async () => {
    const { sanitizeString } = await import('../../server/lib/inputValidator.js');
    expect(sanitizeString('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('trims whitespace', async () => {
    const { sanitizeString } = await import('../../server/lib/inputValidator.js');
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('returns empty string for null/undefined', async () => {
    const { sanitizeString } = await import('../../server/lib/inputValidator.js');
    expect(sanitizeString(null as unknown as string)).toBe('');
    expect(sanitizeString(undefined as unknown as string)).toBe('');
  });

  it('enforces max length', async () => {
    const { sanitizeString } = await import('../../server/lib/inputValidator.js');
    const long = 'a'.repeat(1000);
    const result = sanitizeString(long, 100);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('preserves legitimate apostrophes, quotes and SQL keywords in free text', async () => {
    const { sanitizeString } = await import('../../server/lib/inputValidator.js');
    // Keyword blacklisting corrupted real customer data; storage is
    // parameterised, so these must survive sanitisation intact.
    expect(sanitizeString("O'Brien")).toBe("O'Brien");
    expect(sanitizeString('The "SELECT" plan')).toBe('The "SELECT" plan');
    expect(sanitizeString('note -- with dashes')).toBe('note -- with dashes');
  });

  it('strips control characters but keeps tab and newline', async () => {
    const { sanitizeString } = await import('../../server/lib/inputValidator.js');
    expect(sanitizeString('a\u0000b\u0007c')).toBe('abc');
    expect(sanitizeString('line1\nline2\tcol')).toBe('line1\nline2\tcol');
  });
});

describe('safeParseId', () => {
  it('rejects prototype-polluting keys', async () => {
    const { safeParseId } = await import('../../server/lib/inputValidator.js');
    expect(safeParseId('__proto__')).toBeNull();
    expect(safeParseId('constructor')).toBeNull();
    expect(safeParseId('prototype')).toBeNull();
  });

  it('accepts valid IDs', async () => {
    const { safeParseId } = await import('../../server/lib/inputValidator.js');
    expect(safeParseId('usr_abc123')).toBe('usr_abc123');
    expect(safeParseId('12345')).toBe('12345');
  });

  it('rejects empty strings', async () => {
    const { safeParseId } = await import('../../server/lib/inputValidator.js');
    expect(safeParseId('')).toBeNull();
    expect(safeParseId('   ')).toBeNull();
  });
});

describe('safeWalletAddress', () => {
  it('accepts valid Bitcoin addresses', async () => {
    const { safeWalletAddress } = await import('../../server/lib/inputValidator.js');
    expect(safeWalletAddress('btc', '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf')).toBeTruthy();
  });

  it('accepts valid Ethereum addresses', async () => {
    const { safeWalletAddress } = await import('../../server/lib/inputValidator.js');
    expect(safeWalletAddress('eth', '0x742d35Cc6634C0532925a3b8D4C9C2C3C2C3C2C3')).toBeTruthy();
  });

  it('rejects addresses with path traversal', async () => {
    const { safeWalletAddress } = await import('../../server/lib/inputValidator.js');
    expect(safeWalletAddress('btc', '../../../etc/passwd')).toBeNull();
  });
});

describe('stripDangerousKeys', () => {
  it('removes __proto__ key', async () => {
    const { stripDangerousKeys } = await import('../../server/lib/inputValidator.js');
    const obj = { name: 'test', __proto__: { evil: true } } as Record<string, unknown>;
    const result = stripDangerousKeys(obj);
    expect(result).not.toHaveProperty('__proto__');
    expect(result.name).toBe('test');
  });

  it('removes constructor key', async () => {
    const { stripDangerousKeys } = await import('../../server/lib/inputValidator.js');
    const obj = { name: 'test', constructor: 'evil' } as Record<string, unknown>;
    const result = stripDangerousKeys(obj);
    expect(result).not.toHaveProperty('constructor');
  });

  it('preserves safe keys', async () => {
    const { stripDangerousKeys } = await import('../../server/lib/inputValidator.js');
    const obj = { id: '123', email: 'test@example.com', balance: 1000 };
    const result = stripDangerousKeys(obj);
    expect(result.id).toBe('123');
    expect(result.email).toBe('test@example.com');
    expect(result.balance).toBe(1000);
  });
});

// ── Rate limiter ──────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows requests under the limit', async () => {
    const { checkRateLimit } = await import('../../server/lib/rateLimiter.js');
    const key = `test:${Date.now()}:${Math.random()}`;
    const result = checkRateLimit(key, { windowMs: 60_000, max: 10 });
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(9);
  });

  it('blocks requests over the limit', async () => {
    const { checkRateLimit } = await import('../../server/lib/rateLimiter.js');
    const key = `test:${Date.now()}:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 3 };
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    const result = checkRateLimit(key, opts); // 4th request
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('provides a retryAfterSec when limited', async () => {
    const { checkRateLimit } = await import('../../server/lib/rateLimiter.js');
    const key = `test:${Date.now()}:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 1 };
    checkRateLimit(key, opts);
    const result = checkRateLimit(key, opts);
    expect(result.limited).toBe(true);
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.retryAfterSec).toBeLessThanOrEqual(60);
  });
});

// ── Brute force lockout ───────────────────────────────────────────────────────

describe('bruteForce', () => {
  it('records failed attempts', async () => {
    const { recordLoginFailure, getFailCount } = await import('../../server/lib/bruteForce.js');
    const email = `test-${Date.now()}@example.com`;
    const ip = '10.0.0.1';
    await recordLoginFailure(email, ip);
    const count = await getFailCount(email);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('locks out after max attempts', async () => {
    const { recordLoginFailure, checkLockout } = await import('../../server/lib/bruteForce.js');
    const email = `lockout-${Date.now()}@example.com`;
    const ip = '10.0.0.2';
    // Record enough failures to trigger lockout (threshold is 4, locks on 5th)
    for (let i = 0; i < 6; i++) {
      await recordLoginFailure(email, ip);
    }
    const status = await checkLockout(email, ip);
    expect(status.blocked).toBe(true);
  });

  it('clears lockout on success', async () => {
    const { recordLoginFailure, recordLoginSuccess, checkLockout } = await import('../../server/lib/bruteForce.js');
    const email = `clear-${Date.now()}@example.com`;
    const ip = '10.0.0.3';
    for (let i = 0; i < 6; i++) {
      await recordLoginFailure(email, ip);
    }
    expect((await checkLockout(email, ip)).blocked).toBe(true);
    await recordLoginSuccess(email, ip);
    expect((await checkLockout(email, ip)).blocked).toBe(false);
  });
});
