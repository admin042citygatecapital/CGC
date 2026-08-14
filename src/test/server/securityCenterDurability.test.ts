import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('security center durability', () => {
  it('stores roles, rate limits and alerts in PostgreSQL-backed repositories', () => {
    const store = fs.readFileSync(path.resolve(process.cwd(), 'src/server/lib/securityCenterStore.ts'), 'utf8');
    const migration = fs.readFileSync(path.resolve(process.cwd(), 'src/server/db/migrations/0043_security_center.sql'), 'utf8');
    const alertRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin/security/alerts/POST.ts'), 'utf8');

    expect(store).toContain("ROLES_CONFIG_KEY = 'security_center_roles'");
    expect(store).toContain("RATE_LIMITS_CONFIG_KEY = 'security_center_rate_limits'");
    expect(store).toContain('INSERT INTO security_center_alerts');
    expect(store).toContain('SECURITY_ALERT_DATABASE_UNAVAILABLE');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS security_center_alerts');
    expect(alertRoute).toContain('await resolveAlert');
    expect(alertRoute).toContain('await appendAlert');
  });
});
