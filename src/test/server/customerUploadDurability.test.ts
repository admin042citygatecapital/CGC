import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('customer upload durability', () => {
  it('fails closed when managed avatar storage is unavailable in production', () => {
    const source = readFileSync('src/server/api/users/avatar/POST.ts', 'utf8');
    expect(source).toContain("process.env.NODE_ENV === 'production' && !managedStorageAvailable");
    expect(source).toContain("code: 'MANAGED_STORAGE_REQUIRED'");
    expect(source).not.toContain("error: 'Failed to save avatar: ' + String(err)");
  });

  it('retires legacy plaintext and local-file identity-document writes', () => {
    const profile = readFileSync('src/server/api/users/me/PATCH.ts', 'utf8');
    const legacyUpload = readFileSync('src/server/api/users/kyc-document/POST.ts', 'utf8');
    expect(profile).toContain("code: 'KYC_WORKFLOW_REQUIRED'");
    expect(profile).not.toContain('writeFileSync');
    expect(profile).not.toContain('patch.idNumber');
    expect(legacyUpload).toContain('status(410)');
    expect(legacyUpload).not.toContain('writeFileSync');
  });
});
