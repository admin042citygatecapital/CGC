import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

function encodeBase32(input: Buffer): string {
  let output = '';
  let bits = 0;
  let value = 0;
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of input.toUpperCase().replace(/=+$/u, '')) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function codeForCounter(secret: string, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/u.test(code)) return false;
  const counter = Math.floor(now / 30_000);
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(codeForCounter(secret, counter + drift));
    const supplied = Buffer.from(code);
    if (expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)) return true;
  }
  return false;
}

/** Current 6-digit code for a secret at a point in time — test/parity helper. */
export function totpCodeAt(secret: string, now = Date.now()): string {
  return codeForCounter(secret, Math.floor(now / 30_000));
}

// ── Recovery codes ─────────────────────────────────────────────────────────────
// Single-use backup codes for lost devices. Only SHA-256 hashes are stored;
// the plaintext codes are returned to the customer exactly once at enable time.

export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

export function normalizeRecoveryCode(code: string): string {
  return String(code).trim().toLowerCase().replace(/[^0-9a-f]/gu, '');
}

/** Returns the updated hash list with the consumed code removed, or null when the code does not match. */
export function consumeRecoveryCode(hashes: string[], code: string): string[] | null {
  const hash = hashRecoveryCode(code);
  if (!hashes.includes(hash)) return null;
  return hashes.filter(h => h !== hash);
}
