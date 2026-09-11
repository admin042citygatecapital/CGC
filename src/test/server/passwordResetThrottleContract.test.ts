import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const entrySource = readFileSync('src/server/entry.ts', 'utf8');

/**
 * Contract: the public password-reset endpoints must carry dedicated rate
 * limits registered in entry.ts (per-IP and per-mailbox). These were
 * previously missing, leaving reset-email flooding to the global 200/min
 * ceiling. If a refactor moves them, this contract must be updated with the
 * new location, not deleted.
 */
describe('password reset throttle contract', () => {
  it('registers a per-IP and per-mailbox throttle for the admin reset endpoint', () => {
    expect(entrySource).toContain('admin-password-reset:');
    expect(entrySource).toContain('admin-password-reset-email:');
  });

  it('registers a per-IP and per-mailbox throttle for the customer reset endpoint', () => {
    expect(entrySource).toContain('customer-password-reset:');
    expect(entrySource).toContain('customer-password-reset-email:');
  });

  it('does not trust an unbounded proxy chain for req.ip', () => {
    expect(entrySource).not.toContain('trust proxy", true');
    expect(entrySource).toMatch(/trust proxy", TRUST_PROXY_HOPS/);
  });
});