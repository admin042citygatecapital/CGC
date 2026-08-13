import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('synthetic transaction monitoring schema and surface',()=>{
  const migration=fs.readFileSync(path.join(process.cwd(),'src/server/db/migrations/0032_synthetic_transaction_monitoring.sql'),'utf8');
  it('persists alerts, immutable linked snapshots and immutable events',()=>{expect(migration).toContain('CREATE TABLE IF NOT EXISTS synthetic_monitoring_alerts');expect(migration).toContain('CREATE TABLE IF NOT EXISTS synthetic_monitoring_alert_transactions');expect(migration).toContain('CREATE TABLE IF NOT EXISTS synthetic_monitoring_alert_events');expect(migration).toContain('BEFORE UPDATE OR DELETE ON synthetic_monitoring_alert_events');expect(migration).toContain('BEFORE UPDATE OR DELETE ON synthetic_monitoring_alert_transactions');expect(migration).toContain("synthetic IS TRUE");expect(migration).toContain("snapshot_sha256 ~ '^[a-f0-9]{64}$'");});
  it('exposes one super-admin queue and an isolated checker resolution path',()=>{const entry=fs.readFileSync(path.join(process.cwd(),'src/server/entry.ts'),'utf8');const adminPage=fs.readFileSync(path.join(process.cwd(),'src/pages/admin/onboarding.tsx'),'utf8');const checker=fs.readFileSync(path.join(process.cwd(),'src/pages/sponsor-review.tsx'),'utf8');expect(entry).toContain('/api/admin/onboarding/monitoring');expect(adminPage).toContain('Synthetic transaction-monitoring queue');expect(adminPage).toContain('Submit resolution to checker');expect(checker).toContain('Synthetic monitoring resolutions');expect(checker).toContain('Close false positive');expect(checker).toContain('Confirm case');});
  it('does not enable filings, providers or balance mutation',()=>{const getRoute=fs.readFileSync(path.join(process.cwd(),'src/server/api/admin/onboarding/monitoring/GET.ts'),'utf8');const postRoute=fs.readFileSync(path.join(process.cwd(),'src/server/api/admin/onboarding/monitoring/POST.ts'),'utf8');expect(getRoute).toContain('filingsEnabled:false');expect(getRoute).toContain("financialActivationEffect:'NONE'");expect(postRoute).not.toMatch(/updateUser|balanceMinor\s*=|fileSAR|fileCTR|providerAdapter/);});
});

