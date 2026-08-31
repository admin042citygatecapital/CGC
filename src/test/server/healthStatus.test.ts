import { describe, expect, it } from 'vitest';
import { buildCoreHealthComponents, buildMemoryHealthComponent, deriveOverallHealth, legacyCheck, type HealthComponent } from '../../server/lib/healthStatus.js';

function component(state: HealthComponent['state'], required = true): HealthComponent {
  return { state, required, detail: 'test' };
}

describe('authoritative health status', () => {
  it('keeps optional unconfigured integrations from degrading the platform', () => {
    expect(deriveOverallHealth({
      api: component('healthy'),
      database: component('healthy'),
      email: component('not_configured', false),
    })).toBe('healthy');
  });

  it('reports warnings without inventing an outage', () => {
    expect(deriveOverallHealth({
      api: component('healthy'),
      memory: component('warning'),
    })).toBe('warning');
  });

  it('fails closed for an unknown or degraded required dependency', () => {
    expect(deriveOverallHealth({ database: component('unknown') })).toBe('degraded');
    expect(deriveOverallHealth({ sessions: component('degraded') })).toBe('degraded');
  });

  it('keeps the legacy check view consistent with component states', () => {
    expect(legacyCheck('healthy')).toBe('PASS');
    expect(legacyCheck('warning')).toBe('WARN');
    expect(legacyCheck('not_configured')).toBe('WARN');
    expect(legacyCheck('degraded')).toBe('FAIL');
  });

  it('builds identical core status from equivalent public and administrator evidence', () => {
    const evidence = {
      databaseHealthy: true,
      databaseDetail: 'Database is healthy.',
      storageHealthy: true,
      storageDetail: 'Storage is healthy.',
      sessionsHealthy: true,
      sessionsDetail: 'Sessions are healthy.',
    };
    const publicComponents = buildCoreHealthComponents(evidence);
    const administratorComponents = buildCoreHealthComponents(evidence);
    expect(administratorComponents).toEqual(publicComponents);
    expect(deriveOverallHealth(publicComponents)).toBe('healthy');
    expect(deriveOverallHealth(administratorComponents)).toBe('healthy');
  });

  it('allows an explicit local fallback while keeping production database checks fail-closed', () => {
    const common = {
      databaseHealthy: false,
      databaseConfigured: false,
      databaseDetail: 'PostgreSQL is not configured.',
      storageHealthy: true,
      storageDetail: 'Storage is healthy.',
      sessionsHealthy: true,
      sessionsDetail: 'Sessions are healthy.',
    };
    const local = buildCoreHealthComponents({ ...common, databaseRequired: false });
    const production = buildCoreHealthComponents({ ...common, databaseRequired: true });

    expect(local.database).toMatchObject({ state: 'not_configured', required: false });
    expect(deriveOverallHealth(local)).toBe('healthy');
    expect(production.database).toMatchObject({ state: 'degraded', required: true });
    expect(deriveOverallHealth(production)).toBe('degraded');
  });

  it('measures heap use against the V8 heap limit rather than the currently committed heap', () => {
    const result = buildMemoryHealthComponent(46 * 1024 * 1024, 4096 * 1024 * 1024);
    expect(result).toMatchObject({ component: { state: 'healthy' }, usagePct: 1 });
  });

  it('reports one high heap sample as a warning pending sustained evidence', () => {
    const result = buildMemoryHealthComponent(900, 1000);
    expect(result).toMatchObject({ component: { state: 'warning' }, usagePct: 90 });
  });
});
