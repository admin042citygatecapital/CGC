import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('customer upload durability', () => {
  it('fails closed when managed avatar storage is unavailable in production', () => {
    const source = readFileSync('src/server/api/users/avatar/POST.ts', 'utf8');
    expect(source).toContain("process.env.NODE_ENV === 'production' && !managedStorageAvailable");
    expect(source).toContain("code: 'MANAGED_STORAGE_REQUIRED'");
    expect(source).not.toContain("error: 'Failed to save avatar: ' + String(err)");
  });

  it('keeps identity-document collection disabled in production until a provider exists', () => {
    for (const file of [
      'src/server/api/users/kyc-document/POST.ts',
      'src/server/api/users/me/PATCH.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain("process.env.NODE_ENV === 'production'");
      expect(source, file).toContain("code: 'KYC_PROVIDER_REQUIRED'");
    }
  });
});
