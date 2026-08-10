import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('credential logging boundary', () => {
  it('never emits Zoho credential fragments in startup or refresh logs', () => {
    const source = readFileSync('src/server/lib/zohoTokenStore.ts', 'utf8');
    expect(source).not.toMatch(/clientIdPrefix|clientSecretPrefix|refreshTokenPrefix|accountIdPrefix/);
    expect(source).not.toMatch(/ZOHO_CLIENT_SECRET_prefix|CLIENTSECRET_prefix/);
  });

  it('returns only presence state from the administrator credential diagnostic', () => {
    const source = readFileSync('src/server/api/zoho/status/GET.ts', 'utf8');
    expect(source).toContain("return value ? 'configured' : '(not set)'");
    expect(source).not.toMatch(/value\.slice|refresh_token_length/);
  });
});
