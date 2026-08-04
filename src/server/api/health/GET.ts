/**
 * GET /api/health
 *
 * Reworked against the current backend: the original queried Supabase
 * (`db.from('users').select('id').limit(1)` via the now-superseded
 * src/server/lib/db.ts) to report database health. This codebase's DB layer
 * is Drizzle (src/server/lib/userStore.ts and friends import
 * `getDb`/`isDatabaseConfigured` from `../db/db.js`), but that module —
 * src/server/db/db.ts — hasn't landed in this repo yet, so there's nothing
 * to import here without inventing a schema/client this endpoint has no
 * business owning. Until it lands, this reports whether DATABASE_URL is
 * configured (matching every *Store.ts module's own DB-vs-flat-file
 * fallback signal) rather than performing a live query. Swap the `database`
 * check below to a real `getDb()` ping once src/server/db/db.ts exists.
 */
import type { Request, Response } from 'express';
import os from 'node:os';

export default async function handler(_req: Request, res: Response) {
  const uptime    = process.uptime();
  const memUsage  = process.memoryUsage();
  const freeRam   = os.freemem();
  const totalRam  = os.totalmem();
  const loadAvg   = os.loadavg();

  // No live query yet — see file header. `not_configured` just means the
  // app is intentionally running on the flat-file fallback, not an error.
  const dbStatus: 'ok' | 'not_configured' = process.env.DATABASE_URL ? 'ok' : 'not_configured';

  const services = { database: dbStatus };
  const allOk = dbStatus !== undefined; // always true today; kept for when a real ping lands
  const status = allOk ? 'ok' : 'degraded';

  res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    },
    memory: {
      heapUsedMb:  Math.round(memUsage.heapUsed  / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb:       Math.round(memUsage.rss       / 1024 / 1024),
      freeRamMb:   Math.round(freeRam  / 1024 / 1024),
      totalRamMb:  Math.round(totalRam / 1024 / 1024),
      heapUsagePct: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    cpu: {
      load1m:  Math.round(loadAvg[0] * 100) / 100,
      load5m:  Math.round(loadAvg[1] * 100) / 100,
      load15m: Math.round(loadAvg[2] * 100) / 100,
      cores:   os.cpus().length,
    },
    services,
    checks: {
      total:  Object.keys(services).length,
      passed: Object.values(services).filter(v => v === 'ok').length,
      failed: Object.values(services).filter(v => v !== 'ok' && v !== 'not_configured').length,
    },
  });
}
