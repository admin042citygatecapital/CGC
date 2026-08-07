import crypto from 'node:crypto';
import { getSecret } from '#airo/secrets';

const developmentSecret = crypto.randomBytes(32).toString('hex');

function signingSecret(): string {
  const configured = String(getSecret('SESSION_SECRET') || process.env.SESSION_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required.');
  return developmentSecret;
}

function signature(payload: string): string {
  return crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

export function issueKycUploadToken(userId: string, lifetimeSeconds = 15 * 60): string {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    purpose: 'kyc-upload',
    exp: Date.now() + lifetimeSeconds * 1000,
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyKycUploadToken(token: string): string | null {
  const [payload, providedSignature, extra] = token.split('.');
  if (!payload || !providedSignature || extra) return null;
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      purpose?: unknown;
      exp?: unknown;
    };
    if (decoded.purpose !== 'kyc-upload') return null;
    if (typeof decoded.sub !== 'string' || !/^usr_[a-f0-9]{16}$/i.test(decoded.sub)) return null;
    if (typeof decoded.exp !== 'number' || decoded.exp <= Date.now()) return null;
    return decoded.sub;
  } catch {
    return null;
  }
}
