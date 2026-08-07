import { afterEach, describe, expect, it, vi } from 'vitest';

const originalSecret = process.env.SESSION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
  vi.resetModules();
});

describe('purpose-scoped KYC upload tokens', () => {
  it('accepts a valid token and rejects tampering', async () => {
    process.env.SESSION_SECRET = 'a'.repeat(64);
    vi.resetModules();
    const { issueKycUploadToken, verifyKycUploadToken } = await import('../../server/lib/purposeToken.js');
    const userId = 'usr_0123456789abcdef';
    const token = issueKycUploadToken(userId);
    expect(verifyKycUploadToken(token)).toBe(userId);
    expect(verifyKycUploadToken(`${token.slice(0, -1)}x`)).toBeNull();
  });

  it('rejects expired tokens', async () => {
    process.env.SESSION_SECRET = 'b'.repeat(64);
    vi.resetModules();
    const { issueKycUploadToken, verifyKycUploadToken } = await import('../../server/lib/purposeToken.js');
    expect(verifyKycUploadToken(issueKycUploadToken('usr_0123456789abcdef', -1))).toBeNull();
  });
});
