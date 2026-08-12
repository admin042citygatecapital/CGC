import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  connection: vi.fn(async () => ({ ok: true, latencyMs: 1 })),
  query: vi.fn(),
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: dependencies.configured,
  testConnection: dependencies.connection,
  getQueryClient: () => dependencies.query,
}));

import { getErrorMonitor, scanPostgresTables } from '../../server/api/admin/developer/GET.js';

function queryText(strings: TemplateStringsArray): string {
  return strings.join(' ').replace(/\s+/g, ' ').trim();
}

describe('Developer Center PostgreSQL diagnostics', () => {
  beforeEach(() => {
    dependencies.configured.mockReturnValue(true);
    dependencies.connection.mockResolvedValue({ ok: true, latencyMs: 1 });
    dependencies.query.mockReset();
  });

  it('reports PostgreSQL table size, estimated rows and maintenance evidence', async () => {
    dependencies.query.mockImplementation(async (strings: TemplateStringsArray) => {
      expect(queryText(strings)).toContain('FROM pg_stat_user_tables');
      return [{
        table_name: 'access_log',
        estimated_rows: '42',
        size_bytes: '8192',
        last_maintained: '2026-08-12T10:00:00.000Z',
      }];
    });

    await expect(scanPostgresTables()).resolves.toEqual([{
      name: 'access_log',
      path: 'public.access_log',
      type: 'table',
      rows: 42,
      sizeBytes: 8192,
      lastModified: '2026-08-12T10:00:00.000Z',
      healthy: true,
    }]);
  });

  it('fails closed when PostgreSQL is not configured instead of reading flat files', async () => {
    dependencies.configured.mockReturnValue(false);

    const tables = await scanPostgresTables();
    const monitor = await getErrorMonitor();

    expect(tables).toEqual([expect.objectContaining({
      name: 'PostgreSQL', healthy: false, error: 'Database is not configured',
    })]);
    expect(monitor).toMatchObject({ source: 'unavailable', windowHours: 24, totalRequests: 0 });
    expect(dependencies.query).not.toHaveBeenCalled();
  });

  it('summarizes the last 24 hours and removes query strings from server-error details', async () => {
    dependencies.query.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = queryText(strings);
      if (sql.includes('COUNT(*) AS total_requests')) {
        return [{ total_requests: '200', http_4xx: '8', http_5xx: '2' }];
      }
      if (sql.includes('FROM access_log')) {
        return [{
          ts: '2026-08-12T11:00:00.000Z', status: 503, method: 'GET',
          url: '/api/admin/developer?token=must-not-leak', ip: '203.0.113.10',
          threat: 'none',
        }];
      }
      throw new Error('Unexpected query');
    });

    const result = await getErrorMonitor();

    expect(result).toMatchObject({
      source: 'postgresql', windowHours: 24, totalRequests: 200,
      http4xx: 8, http5xx: 2, errorRate: 1,
    });
    expect(result.recentErrors[0]).toMatchObject({
      type: 'http_5xx', detail: 'GET /api/admin/developer returned 503', ip: '203.0.113.10',
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('reports an unavailable data source when either PostgreSQL query fails', async () => {
    dependencies.query.mockRejectedValue(new Error('database unavailable'));

    await expect(getErrorMonitor()).resolves.toMatchObject({
      source: 'unavailable', totalRequests: 0, recentErrors: [],
    });
  });

  it('contains no runtime fallback to legacy diagnostic log files', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/api/admin/developer/GET.ts'),
      'utf8',
    );

    expect(source).not.toContain('scanDbFiles');
    expect(source).not.toContain('logs/access.jsonl');
    expect(source).not.toContain('logs/threats.jsonl');
  });
});
