import { afterEach, describe, expect, it, vi } from 'vitest';

const original = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  CARD_ENCRYPTION_KEY: process.env.CARD_ENCRYPTION_KEY,
};

afterEach(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.resetModules();
});

describe('environment validation', () => {
  it('marks malformed security and database values invalid without exposing them', async () => {
    process.env.SESSION_SECRET = 'short';
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'file:///private';
    process.env.CARD_ENCRYPTION_KEY = 'not-a-key';
    vi.resetModules();

    const { buildEnvReport } = await import('../../server/lib/envValidator.js');
    const report = buildEnvReport();
    for (const name of ['SESSION_SECRET', 'JWT_SECRET', 'DATABASE_URL', 'CARD_ENCRYPTION_KEY']) {
      const variable = report.variables.find(item => item.name === name);
      expect(variable?.status).toBe('INVALID');
      expect(variable?.validationError).toBeTruthy();
      expect(variable?.maskedValue).not.toContain('not-a-key');
    }
  });

  it('accepts correctly formatted values', async () => {
    process.env.SESSION_SECRET = 's'.repeat(48);
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/cgc';
    process.env.CARD_ENCRYPTION_KEY = 'a'.repeat(64);
    vi.resetModules();

    const { buildEnvReport } = await import('../../server/lib/envValidator.js');
    const report = buildEnvReport();
    for (const name of ['SESSION_SECRET', 'JWT_SECRET', 'DATABASE_URL', 'CARD_ENCRYPTION_KEY']) {
      expect(report.variables.find(item => item.name === name)?.status).toBe('PRESENT');
    }
  });
});
