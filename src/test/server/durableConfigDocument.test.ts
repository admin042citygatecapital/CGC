import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readConfigDocument, writeConfigDocument } from '../../server/lib/durableConfigDocument.js';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('durable configuration documents', () => {
  it('preserves the development file fallback while production uses PostgreSQL', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-config-'));
    temporaryDirectories.push(directory);
    const file = path.join(directory, 'settings.json');
    await writeConfigDocument('test_settings', file, { enabled: true });
    await expect(readConfigDocument('test_settings', file, { enabled: false })).resolves.toEqual({ enabled: true });
  });

  it('uses the existing config table and imports legacy values once', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/server/lib/durableConfigDocument.ts'), 'utf8');
    expect(source).toContain('configTable.value');
    expect(source).toContain("updatedBy: 'migration'");
    expect(source).toContain("process.env.NODE_ENV === 'production' && !isDatabaseConfigured()");
    expect(source).toContain('onConflictDoUpdate');
  });

  it('awaits durable writes and records critical administration audits', () => {
    for (const relative of ['website/POST.ts', 'chatbot/POST.ts', 'links/POST.ts']) {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin', relative), 'utf8');
      expect(source).toContain('await appendCriticalAudit');
      expect(source).toMatch(/await write(?:WebsiteSettings|ChatbotConfig|Links)/);
    }
  });
});
