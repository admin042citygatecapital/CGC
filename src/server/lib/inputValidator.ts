/**
 * Input validation & sanitisation helpers.
 * Pure functions — no external deps.
 *
 * Security guarantees:
 *  1. Prototype-pollution prevention — stripDangerousKeys() blocks __proto__,
 *     constructor, prototype keys from reaching any object spread or store.
 *  2. ID format validation — safeParseId() rejects anything that isn't a plain
 *     alphanumeric/underscore/hyphen string (prevents path traversal & injection).
 *  3. String sanitisation — sanitizeString() strips markup and control
 *     characters and enforces a length cap. SQL injection is prevented
 *     structurally (parameterised queries); keyword blacklisting corrupted
 *     legitimate text and was removed.
 *  4. Enum validation — isOneOf() for strict allowlist checks.
 */

// ── Prototype-pollution prevention ───────────────────────────────────────────

/** Keys that must never appear in any user-supplied object */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Strip prototype-polluting keys from a plain object.
 * Call this on any untrusted Record before spreading it into a store record.
 */
export function stripDangerousKeys<T extends Record<string, unknown>>(obj: T): T {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) === Object.prototype
    ) {
      safe[k] = stripDangerousKeys(v as Record<string, unknown>);
    } else {
      safe[k] = v;
    }
  }
  return safe as T;
}

/**
 * Coerce an untrusted value to a safe plain object, or return null.
 * Strips prototype-polluting keys automatically.
 */
export function safeObject(input: unknown): Record<string, unknown> | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  return stripDangerousKeys(input as Record<string, unknown>);
}

// ── ID validation ─────────────────────────────────────────────────────────────

/**
 * Validate and return a safe ID string, or null if invalid.
 * Accepts only alphanumeric characters, underscores, and hyphens (1-64 chars).
 * Blocks __proto__, constructor, prototype, path traversal, and injection.
 */
export function safeParseId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (DANGEROUS_KEYS.has(trimmed)) return null;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) return null;
  return trimmed;
}

// ── String sanitisation ───────────────────────────────────────────────────────

/**
 * Normalise free-text input for storage: strip markup and non-printable
 * control characters (tab/newline preserved) and enforce a length cap.
 *
 * SQL injection is prevented structurally by parameterised queries — a
 * keyword blacklist corrupted legitimate stored text ("O'Brien" → "OBrien",
 * notes containing "SELECT") without adding real security. Rendered output
 * is escaped by React; the only raw-HTML render surface is the sandboxed
 * admin email-template preview.
 */
export function sanitizeString(input: unknown, maxLen = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

/** Sanitise a short free-text note (500 char cap) */
export function sanitizeNote(input: unknown): string {
  return sanitizeString(input, 500);
}

// ── Email / password ──────────────────────────────────────────────────────────

/** Validate email format */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.length <= 254;
}

/** Validate password strength */
export function validatePassword(password: unknown): { ok: boolean; reason?: string } {
  if (typeof password !== 'string') return { ok: false, reason: 'Password must be a string' };
  if (password.length < 8)   return { ok: false, reason: 'Password must be at least 8 characters' };
  if (password.length > 128) return { ok: false, reason: 'Password too long' };
  if (!/[A-Z]/.test(password)) return { ok: false, reason: 'Password must contain at least one uppercase letter' };
  if (!/[0-9]/.test(password)) return { ok: false, reason: 'Password must contain at least one number' };
  if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, reason: 'Password must contain at least one special character' };
  return { ok: true };
}

// ── ID / enum helpers ─────────────────────────────────────────────────────────

/** Validate a MongoDB/UUID-style ID — alphanumeric + underscores/hyphens */
export function isValidId(id: unknown): boolean {
  return safeParseId(id) !== null;
}

/**
 * Check whether a value is a member of a string allowlist.
 * Returns the value typed as T if valid, null otherwise.
 */
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

// ── Object sanitisation ───────────────────────────────────────────────────────

/** Sanitise a whole object's string values (shallow), stripping dangerous keys */
export function sanitizeBody<T extends Record<string, unknown>>(body: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    out[k] = typeof v === 'string' ? sanitizeString(v) : v;
  }
  return out as T;
}

// ── Crypto wallet address validation ─────────────────────────────────────────

const WALLET_PATTERNS: Record<string, RegExp> = {
  BTC:  /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
  ETH:  /^0x[a-fA-F0-9]{40}$/,
  USDT: /^0x[a-fA-F0-9]{40}$|^T[A-Za-z1-9]{33}$/,
  SOL:  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};

/**
 * Validate a crypto wallet address for a given asset.
 * Returns the trimmed address if valid, null if invalid.
 * Accepts empty string as "clear the field".
 */
export function safeWalletAddress(asset: string, address: unknown): string | null {
  if (typeof address !== 'string') return null;
  const trimmed = address.trim();
  if (trimmed === '') return '';
  const pattern = WALLET_PATTERNS[asset.toUpperCase()];
  if (!pattern) return trimmed.slice(0, 200);
  return pattern.test(trimmed) ? trimmed : null;
}
