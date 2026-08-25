import { afterEach, describe, expect, it, vi } from 'vitest';

const original = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  CARD_ENCRYPTION_KEY: process.env.CARD_ENCRYPTION_KEY,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_PASSWORD_HASH_V2: process.env.ADMIN_PASSWORD_HASH_V2,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  SPONSOR_REVIEWER_EMAIL: process.env.SPONSOR_REVIEWER_EMAIL,
  SPONSOR_REVIEWER_KEY_HASH: process.env.SPONSOR_REVIEWER_KEY_HASH,
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

  it('accepts the historical padded-Base64 PBKDF2 administrator hash format', async () => {
    process.env.ADMIN_PASSWORD_HASH =
      '100000:AAECAwQFBgcICQoLDA0ODw==:EBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8=';
    delete process.env.ADMIN_PASSWORD_HASH_V2;
    vi.resetModules();

    const { buildEnvReport } = await import('../../server/lib/envValidator.js');
    const report = buildEnvReport();
    const adminHash = report.variables.find(item => item.name === 'ADMIN_PASSWORD_HASH');

    expect(adminHash?.status).toBe('PRESENT');
    expect(adminHash?.validationError).toBe('');
    expect(adminHash?.maskedValue).not.toContain(process.env.ADMIN_PASSWORD_HASH);
  });

  it.each([
    ['hex fields', `100000:${'ab'.repeat(16)}:${'cd'.repeat(32)}`],
    ['unpadded Base64 fields', '100000:AAECAwQFBgcICQoLDA0ODw:EBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8'],
    ['wrong iteration count', '200000:AAECAwQFBgcICQoLDA0ODw==:EBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8='],
  ])('rejects a PBKDF2 administrator hash with %s', async (_label, value) => {
    process.env.ADMIN_PASSWORD_HASH = value;
    delete process.env.ADMIN_PASSWORD_HASH_V2;
    vi.resetModules();

    const { buildEnvReport } = await import('../../server/lib/envValidator.js');
    const report = buildEnvReport();
    const adminHash = report.variables.find(item => item.name === 'ADMIN_PASSWORD_HASH');

    expect(adminHash?.status).toBe('INVALID');
    expect(adminHash?.validationError).toMatch(/legacy bcrypt\/PBKDF2/i);
    expect(adminHash?.maskedValue).not.toContain(value);
  });

  it('rejects a sponsor reviewer identity that matches the super-administrator', async () => {
    process.env.ADMIN_EMAIL = 'admin@citygate.capital';
    process.env.SPONSOR_REVIEWER_EMAIL = 'ADMIN@citygate.capital';
    process.env.SPONSOR_REVIEWER_KEY_HASH = 'a'.repeat(64);
    vi.resetModules();

    const { buildEnvReport } = await import('../../server/lib/envValidator.js');
    const report = buildEnvReport();
    const reviewer = report.variables.find(item => item.name === 'SPONSOR_REVIEWER_EMAIL');
    expect(reviewer?.status).toBe('INVALID');
    expect(reviewer?.validationError).toMatch(/different from the super-administrator/i);
    expect(reviewer?.maskedValue).not.toContain('admin@citygate.capital');
  });
});
