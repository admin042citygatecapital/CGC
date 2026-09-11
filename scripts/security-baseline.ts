import { assertSafeBaselineTarget, evaluatePublicSecurityHeaders, protectedEndpointProbe, type SecurityProbe } from '../src/server/lib/securityAssurance.js';

const target = assertSafeBaselineTarget(process.argv[2] ?? process.env.SECURITY_BASELINE_URL ?? 'https://citygate.capital');
const request = async (path: string, init: RequestInit = {}) => fetch(new URL(path, target), { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...init });

const homepage = await request('/');
const probes: SecurityProbe[] = [
  { name: 'homepage_https', passed: homepage.status === 200 && target.protocol === 'https:', observed: `${target.origin} HTTP ${homepage.status}`, requirement: 'HTTPS homepage returns 200' },
  ...evaluatePublicSecurityHeaders(homepage.headers),
];

const health = await request('/api/health');
// Shape of the public /api/health payload consumed by the probes below.
type HealthBody = { status?: string; database?: { status?: string }; release?: { commit?: string } };
let healthBody: HealthBody = {};
try { healthBody = await health.json(); } catch { /* reported by probes below */ }
probes.push(
  { name: 'health', passed: health.status === 200 && healthBody.status === 'ok', observed: `HTTP ${health.status}; status=${String(healthBody.status)}`, requirement: 'Public health endpoint reports ok' },
  { name: 'database_health', passed: healthBody.database?.status === 'ok', observed: String(healthBody.database?.status ?? 'missing'), requirement: 'PostgreSQL health reports ok' },
  { name: 'release_identity', passed: /^[a-f0-9]{40}$/i.test(String(healthBody.release?.commit ?? '')), observed: String(healthBody.release?.commit ?? 'missing'), requirement: 'Running release exposes a full Git commit' },
);

for (const [name, path] of [
  ['admin_sponsor_readiness_auth', '/api/admin/sponsor-readiness'],
  ['admin_developer_auth', '/api/admin/developer'],
  ['customer_transfer_auth', '/api/users/transfer'],
] as const) {
  const response = await request(path);
  probes.push(protectedEndpointProbe(name, response.status));
}

const failed = probes.filter(probe => !probe.passed);
const report = {
  schemaVersion: 1,
  target: target.origin,
  assessedAt: new Date().toISOString(),
  scope: 'unauthenticated HTTP security baseline',
  independentPenetrationTest: false,
  limitations: ['No authenticated testing', 'No exploit testing', 'No provider, infrastructure or source-code penetration test', 'No regulatory acceptance'],
  release: healthBody.release ?? null,
  passed: failed.length === 0,
  summary: { total: probes.length, passed: probes.length - failed.length, failed: failed.length },
  probes,
};
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
