import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routes = [
  'src/server/api/admin/support/canned/GET.ts',
  'src/server/api/admin/support/canned/POST.ts',
  'src/server/api/admin/support/canned/PUT.ts',
  'src/server/api/admin/support/canned/DELETE.ts',
  'src/server/api/admin/support/routing/GET.ts',
  'src/server/api/admin/support/routing/POST.ts',
  'src/server/api/admin/support/notifications/GET.ts',
  'src/server/api/admin/support/notifications/POST.ts',
] as const;

describe('support configuration durability', () => {
  it('routes canned responses, routing, and notifications through PostgreSQL', () => {
    for (const file of routes) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('supportDatabaseStore.js');
      expect(source, file).not.toContain('supportStore.js');
    }
  });

  it('validates routing and notification configuration before persistence', () => {
    const routing = readFileSync('src/server/api/admin/support/routing/POST.ts', 'utf8');
    const notifications = readFileSync('src/server/api/admin/support/notifications/POST.ts', 'utf8');
    expect(routing).toContain('A maximum of 50 routing rules is allowed');
    expect(routing).toContain('safeRules.push');
    expect(notifications).toContain('hours < 1 || hours > 168');
    expect(notifications).not.toContain('...body');
  });

  it('migrates disk-era configuration idempotently', () => {
    const store = readFileSync('src/server/lib/supportDatabaseStore.ts', 'utf8');
    expect(store).toContain('ON CONFLICT (id) DO NOTHING');
    expect(store).toContain('ON CONFLICT (key) DO NOTHING');
    expect(store).toContain("const ROUTING_CONFIG_KEY = 'support_routing'");
    expect(store).toContain("const NOTIFICATION_CONFIG_KEY = 'support_notifications'");
  });
});
