/**
 * /admin/developer — Developer Center
 * ─────────────────────────────────────────────────────────────────────────────
 * 9 sections:
 *   Route Explorer · API Explorer · Database Diagnostics · Performance Metrics
 *   Dependency Health · Error Monitor · Build Information
 *   Deployment Information · Environment Validation
 *
 * No shell access. No arbitrary code execution.
 */
import { Helmet }                            from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback }  from 'react';
import { motion }                            from 'motion/react';
import {
  Terminal, RefreshCw, Loader2, ChevronDown, ChevronRight,
  Database, Package, AlertTriangle, CheckCircle2,
  XCircle, Clock, Server, Activity,
  Search, Copy, Check, ExternalLink,
  Zap, Code2, FileCode2,
  Shield,
  AlertCircle, Network,
} from 'lucide-react';
import AdminLayout    from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteEntry {
  method: string; path: string; group: string; auth: string; description: string;
}
interface DbFile {
  name: string; path: string; type: string;
  rows: number; sizeBytes: number; lastModified: string; healthy: boolean; error?: string;
}
interface PerfMetrics {
  uptime: number; uptimeHuman: string;
  memoryUsed: number; memoryTotal: number; memoryRss: number; memoryPct: number;
  cpuCount: number; cpuModel: string;
  loadAvg1m: number; loadAvg5m: number; loadAvg15m: number;
  nodeVersion: string; platform: string; arch: string; pid: number;
  freeMem: number; totalMem: number; hostname: string;
}
interface DepHealth {
  totalDeps: number; totalDevDeps: number;
  keyDeps: Array<{ name: string; version: string; isDev: boolean; present: boolean }>;
  runtimeDeps: Array<{ name: string; version: string }>;
}
interface ErrorMonitorData {
  recentErrors: Array<{ ts: string; type: string; detail: string; ip?: string }>;
  http5xx: number; http4xx: number; totalRequests: number; errorRate: number;
}
interface BuildInfo {
  name: string; version: string; nodeVersion: string; environment: string;
  distExists: boolean; distClient: boolean; distServer: boolean;
  srcFileCount: number; srcPageCount: number; srcApiCount: number;
  totalRoutes: number;
  scripts: Array<{ name: string; command: string }>;
  buildCommand: string; startCommand: string;
}
interface DeployInfo {
  environment: string; appEnv: string; port: string; host: string;
  platform: string; arch: string; nodeVersion: string; pid: number;
  startedAt: string; uptime: number; uptimeHuman: string;
  previewUrl: string; productionUrl: string;
  privatePath: string; publicPath: string;
  privateExists: boolean; publicExists: boolean;
}
interface EnvVar {
  name: string; aliases: string[]; status: string; level: string;
  service: string; description: string; isPublic: boolean;
  maskedValue: string; defaultVal: string;
}
interface DeveloperData {
  generatedAt: string;
  routes: { total: number; byGroup: Record<string, number>; byMethod: Record<string, number>; catalogue: RouteEntry[] };
  db: { files: DbFile[]; totalFiles: number; healthy: number; unhealthy: number; totalRows: number; totalBytes: number };
  performance: PerfMetrics;
  dependencies: DepHealth;
  errors: ErrorMonitorData;
  build: BuildInfo;
  deployment: DeployInfo;
  env: { summary: Record<string, number>; variables: EnvVar[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(2)} GB`;
  if (b >= 1_048_576)     return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024)         return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

const METHOD_COLORS: Record<string, string> = {
  GET:    '#10B981', POST: '#3B82F6', PUT: '#F59E0B',
  PATCH:  '#8B5CF6', DELETE: '#EF4444',
};
const AUTH_COLORS: Record<string, string> = {
  admin:    '#C9A84C', customer: '#3B82F6', public: '#6B7280',
};
const ENV_LEVEL_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444', WARNING: '#F59E0B', INFO: '#3B82F6',
};
const ENV_STATUS_COLORS: Record<string, string> = {
  PRESENT: '#10B981', MISSING: '#EF4444', DEFAULT: '#F59E0B',
};

function MethodBadge({ method }: { method: string }) {
  const color = METHOD_COLORS[method] ?? '#6B7280';
  return (
    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded min-w-[44px] text-center inline-block"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded text-white/20 hover:text-white/60 transition-colors">
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </button>
  );
}

function SectionCard({ title, subtitle, icon: Icon, color = '#C9A84C', children, defaultOpen = true }:
  { title: string; subtitle?: string; icon: React.ElementType; color?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/[0.05] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
            <Icon size={14} style={{ color }} />
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-sm">{title}</p>
            {subtitle && <p className="text-white/30 text-xs">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function StatPill({ label, value, color = '#C9A84C' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 rounded-xl border border-white/[0.05]"
      style={{ background: 'rgba(255,255,255,0.025)' }}>
      <p className="text-white font-bold text-lg leading-none" style={{ color }}>{value}</p>
      <p className="text-white/30 text-[10px] mt-1 text-center">{label}</p>
    </div>
  );
}

// ─── Section: Route Explorer ──────────────────────────────────────────────────

function RouteExplorer({ data }: { data: DeveloperData['routes'] }) {
  const [search,     setSearch]     = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [authFilter,  setAuthFilter]  = useState('');

  const groups  = Array.from(new Set(data.catalogue.map(r => r.group))).sort();
  const methods = Array.from(new Set(data.catalogue.map(r => r.method))).sort();

  const filtered = data.catalogue.filter(r =>
    (!search      || r.path.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())) &&
    (!groupFilter  || r.group  === groupFilter) &&
    (!methodFilter || r.method === methodFilter) &&
    (!authFilter   || r.auth   === authFilter)
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Total Routes"   value={data.total} />
        <StatPill label="Route Groups"   value={Object.keys(data.byGroup).length} color="#3B82F6" />
        <StatPill label="Admin Routes"   value={data.catalogue.filter(r => r.auth === 'admin').length} color="#C9A84C" />
        <StatPill label="Public Routes"  value={data.catalogue.filter(r => r.auth === 'public').length} color="#6B7280" />
      </div>

      {/* Method breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(data.byMethod).sort((a,b) => b[1]-a[1]).map(([m, c]) => (
          <div key={m} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.05]"
            style={{ background: `${METHOD_COLORS[m] ?? '#6B7280'}10` }}>
            <MethodBadge method={m} />
            <span className="text-white/50 text-xs">{c}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search routes…"
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2 text-xs text-white/70 placeholder-white/20 focus:outline-none" />
        </div>
        {[
          { label: 'Group', value: groupFilter, set: setGroupFilter, opts: groups },
          { label: 'Method', value: methodFilter, set: setMethodFilter, opts: methods },
          { label: 'Auth', value: authFilter, set: setAuthFilter, opts: ['admin','customer','public'] },
        ].map(f => (
          <div key={f.label} className="relative">
            <select value={f.value} onChange={e => f.set(e.target.value)}
              className="appearance-none bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 pr-7 text-xs text-white/50 focus:outline-none cursor-pointer">
              <option value="" style={{ background: '#0a0a0a' }}>All {f.label}s</option>
              {f.opts.map(o => <option key={o} value={o} style={{ background: '#0a0a0a' }}>{o}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        ))}
        <span className="text-white/25 text-xs self-center">{filtered.length} routes</span>
      </div>

      {/* Route table */}
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-xl border border-white/[0.05]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10" style={{ background: 'rgba(10,10,10,0.95)' }}>
            <tr className="border-b border-white/5">
              {['Method','Path','Group','Auth','Description'].map(h => (
                <th key={h} className="text-left text-white/25 font-medium py-2.5 px-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map((r, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                <td className="py-2 px-3 whitespace-nowrap"><MethodBadge method={r.method} /></td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1.5">
                    <code className="text-white/70 font-mono text-[11px]">{r.path}</code>
                    <CopyButton text={r.path} />
                  </div>
                </td>
                <td className="py-2 px-3 text-white/40 whitespace-nowrap">{r.group}</td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: AUTH_COLORS[r.auth] ?? '#6B7280', background: `${AUTH_COLORS[r.auth] ?? '#6B7280'}15` }}>
                    {r.auth}
                  </span>
                </td>
                <td className="py-2 px-3 text-white/35 max-w-xs truncate">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: API Explorer ────────────────────────────────────────────────────

function ApiExplorer({ routes }: { routes: RouteEntry[] }) {
  const [selected, setSelected] = useState<RouteEntry | null>(null);
  const [search, setSearch]     = useState('');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<number | null>(null);
  const [latency, setLatency]   = useState<number | null>(null);
  const [body, setBody]         = useState('');

  const filtered = routes.filter(r =>
    r.path.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  async function sendRequest() {
    if (!selected) return;
    setLoading(true); setResponse(''); setStatus(null); setLatency(null);
    const t0 = Date.now();
    try {
      const opts: RequestInit = {
        method: selected.method,
        credentials: 'same-origin',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      };
      if (['POST','PUT','PATCH'].includes(selected.method) && body.trim()) {
        opts.body = body;
      }
      const res = await fetch(selected.path, opts);
      const lat = Date.now() - t0;
      setStatus(res.status);
      setLatency(lat);
      const text = await res.text();
      try { setResponse(JSON.stringify(JSON.parse(text), null, 2)); }
      catch { setResponse(text); }
    } catch (e) {
      setResponse(String(e));
      setStatus(0);
      setLatency(Date.now() - t0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Left: route picker */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search endpoints…"
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2 text-xs text-white/70 placeholder-white/20 focus:outline-none" />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-white/[0.05] divide-y divide-white/[0.03]">
          {filtered.slice(0, 80).map((r, i) => (
            <button key={i} onClick={() => { setSelected(r); setResponse(''); setStatus(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors ${selected?.path === r.path && selected?.method === r.method ? 'bg-white/[0.04]' : ''}`}>
              <MethodBadge method={r.method} />
              <div className="flex-1 min-w-0">
                <p className="text-white/60 font-mono text-[11px] truncate">{r.path}</p>
                <p className="text-white/25 text-[10px] truncate">{r.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: request/response */}
      <div className="space-y-3">
        {selected ? (
          <>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.07]"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <MethodBadge method={selected.method} />
              <code className="text-white/70 text-xs font-mono flex-1 truncate">{selected.path}</code>
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: AUTH_COLORS[selected.auth] ?? '#6B7280', background: `${AUTH_COLORS[selected.auth] ?? '#6B7280'}15` }}>
                {selected.auth}
              </span>
            </div>
            <p className="text-white/30 text-xs">{selected.description}</p>

            {['POST','PUT','PATCH'].includes(selected.method) && (
              <div>
                <p className="text-white/30 text-[10px] mb-1.5 font-medium uppercase tracking-wider">Request Body (JSON)</p>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
                  placeholder='{"key": "value"}'
                  className="w-full bg-black/40 border border-white/[0.07] rounded-xl px-3 py-2.5 text-xs text-white/70 font-mono placeholder-white/15 focus:outline-none resize-none" />
              </div>
            )}

            <button onClick={sendRequest} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Send Request
            </button>

            {status !== null && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${status >= 200 && status < 300 ? 'text-emerald-400 bg-emerald-400/10' : status >= 400 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
                    {status}
                  </span>
                  {latency !== null && <span className="text-white/30 text-xs">{latency}ms</span>}
                </div>
                <div className="relative">
                  <pre className="bg-black/50 border border-white/[0.07] rounded-xl p-3 text-[11px] text-white/60 font-mono overflow-auto max-h-48 whitespace-pre-wrap">{response}</pre>
                  <div className="absolute top-2 right-2"><CopyButton text={response} /></div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-white/20 text-sm">
            <Code2 size={28} className="mb-2 opacity-30" />
            Select an endpoint to test
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: DB Diagnostics ──────────────────────────────────────────────────

function DbDiagnostics({ data }: { data: DeveloperData['db'] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Total Files"   value={data.totalFiles} />
        <StatPill label="Healthy"       value={data.healthy}   color="#10B981" />
        <StatPill label="Unhealthy"     value={data.unhealthy} color={data.unhealthy > 0 ? '#EF4444' : '#10B981'} />
        <StatPill label="Total Storage" value={fmtBytes(data.totalBytes)} color="#8B5CF6" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.05]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {['Status','Name','Type','Rows','Size','Last Modified','Path'].map(h => (
                <th key={h} className="text-left text-white/25 font-medium py-2.5 px-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {data.files.map((f, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 px-3">
                  {f.healthy
                    ? <CheckCircle2 size={13} className="text-emerald-400" />
                    : <span title={f.error}><XCircle size={13} className="text-red-400" /></span>}
                </td>
                <td className="py-2.5 px-3 text-white/70 font-medium whitespace-nowrap">{f.name}</td>
                <td className="py-2.5 px-3">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.type === 'jsonl' ? 'text-blue-400 bg-blue-400/10' : 'text-purple-400 bg-purple-400/10'}`}>
                    {f.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-white/50 font-mono">{fmtNum(f.rows)}</td>
                <td className="py-2.5 px-3 text-white/40 whitespace-nowrap">{fmtBytes(f.sizeBytes)}</td>
                <td className="py-2.5 px-3 text-white/25 whitespace-nowrap">
                  {f.lastModified ? new Date(f.lastModified).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1">
                    <code className="text-white/20 text-[10px] font-mono truncate max-w-[200px]">{f.path}</code>
                    <CopyButton text={f.path} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Performance Metrics ────────────────────────────────────────────

function PerformanceMetrics({ data }: { data: PerfMetrics }) {
  const memPct = data.memoryPct;
  const memColor = memPct > 80 ? '#EF4444' : memPct > 60 ? '#F59E0B' : '#10B981';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Uptime"        value={data.uptimeHuman} color="#10B981" />
        <StatPill label="Heap Used"     value={fmtBytes(data.memoryUsed)} color={memColor} />
        <StatPill label="Heap Total"    value={fmtBytes(data.memoryTotal)} color="#3B82F6" />
        <StatPill label="RSS"           value={fmtBytes(data.memoryRss)} color="#8B5CF6" />
      </div>

      {/* Memory bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-white/40 text-xs">Heap Utilisation</p>
          <p className="text-xs font-bold" style={{ color: memColor }}>{memPct}%</p>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${memPct}%`, background: memColor }} />
        </div>
      </div>

      {/* Load averages */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Load Avg 1m',  value: data.loadAvg1m },
          { label: 'Load Avg 5m',  value: data.loadAvg5m },
          { label: 'Load Avg 15m', value: data.loadAvg15m },
        ].map(l => (
          <div key={l.label} className="p-3 rounded-xl border border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-white/25 text-[10px] mb-1">{l.label}</p>
            <p className="text-white font-bold text-lg">{l.value}</p>
          </div>
        ))}
      </div>

      {/* System info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        {[
          { label: 'Node.js',   value: data.nodeVersion },
          { label: 'Platform',  value: `${data.platform}/${data.arch}` },
          { label: 'CPU',       value: `${data.cpuCount}× ${data.cpuModel.split(' ').slice(0,3).join(' ')}` },
          { label: 'PID',       value: String(data.pid) },
          { label: 'Hostname',  value: data.hostname },
          { label: 'Free RAM',  value: fmtBytes(data.freeMem) },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04]"
            style={{ background: 'rgba(255,255,255,0.015)' }}>
            <span className="text-white/30">{item.label}</span>
            <span className="text-white/60 font-mono text-[11px] truncate max-w-[120px] text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Dependency Health ───────────────────────────────────────────────

function DependencyHealth({ data }: { data: DepHealth }) {
  const [showAll, setShowAll] = useState(false);
  const deps = showAll ? data.runtimeDeps : data.runtimeDeps.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatPill label="Runtime Deps"  value={data.totalDeps} />
        <StatPill label="Dev Deps"      value={data.totalDevDeps} color="#6B7280" />
      </div>

      <div>
        <p className="text-white/30 text-xs font-medium mb-2 uppercase tracking-wider">Key Dependencies</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.keyDeps.map(d => (
            <div key={d.name} className={`flex items-center justify-between p-2.5 rounded-xl border ${d.present ? 'border-white/[0.05]' : 'border-red-400/20 bg-red-400/[0.03]'}`}
              style={d.present ? { background: 'rgba(255,255,255,0.02)' } : {}}>
              <div className="flex items-center gap-2">
                {d.present
                  ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  : <XCircle size={12} className="text-red-400 shrink-0" />}
                <span className="text-white/60 text-xs font-mono">{d.name}</span>
                {d.isDev && <span className="text-[9px] text-white/20 bg-white/5 px-1 rounded">dev</span>}
              </div>
              <span className="text-white/30 text-[11px] font-mono">{d.version}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-white/30 text-xs font-medium mb-2 uppercase tracking-wider">All Runtime Dependencies</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.05] max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: 'rgba(10,10,10,0.95)' }}>
              <tr className="border-b border-white/5">
                <th className="text-left text-white/25 font-medium py-2 px-3">Package</th>
                <th className="text-left text-white/25 font-medium py-2 px-3">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {deps.map(d => (
                <tr key={d.name} className="hover:bg-white/[0.02]">
                  <td className="py-2 px-3 text-white/60 font-mono">{d.name}</td>
                  <td className="py-2 px-3 text-white/30 font-mono">{d.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.runtimeDeps.length > 20 && (
          <button onClick={() => setShowAll(s => !s)}
            className="mt-2 text-xs text-white/30 hover:text-white/60 transition-colors">
            {showAll ? 'Show less' : `Show all ${data.runtimeDeps.length} packages`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section: Error Monitor ───────────────────────────────────────────────────

function ErrorMonitor({ data }: { data: ErrorMonitorData }) {
  const errColor = data.errorRate > 5 ? '#EF4444' : data.errorRate > 1 ? '#F59E0B' : '#10B981';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Total Requests"  value={fmtNum(data.totalRequests)} />
        <StatPill label="5xx Errors"      value={data.http5xx}    color={data.http5xx > 0 ? '#EF4444' : '#10B981'} />
        <StatPill label="4xx Errors"      value={data.http4xx}    color={data.http4xx > 0 ? '#F59E0B' : '#10B981'} />
        <StatPill label="Error Rate"      value={`${data.errorRate}%`} color={errColor} />
      </div>

      {data.recentErrors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider">Recent Security / Threat Events</p>
          {data.recentErrors.map((e, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.04]"
              style={{ background: 'rgba(255,255,255,0.015)' }}>
              <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-400/80 text-[10px] font-bold uppercase">{e.type}</span>
                  {e.ip && <span className="text-white/25 text-[10px] font-mono">{e.ip}</span>}
                </div>
                <p className="text-white/50 text-xs mt-0.5 truncate">{e.detail}</p>
              </div>
              <p className="text-white/20 text-[10px] shrink-0 whitespace-nowrap">
                {e.ts ? new Date(e.ts).toLocaleTimeString('en-GB') : '—'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-400/[0.04] border border-emerald-400/10 text-emerald-400 text-xs">
          <CheckCircle2 size={13} /> No recent threat events
        </div>
      )}
    </div>
  );
}

// ─── Section: Build Information ───────────────────────────────────────────────

function BuildInformation({ data }: { data: BuildInfo }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill label="Source Files"  value={data.srcFileCount} />
        <StatPill label="Pages"         value={data.srcPageCount} color="#3B82F6" />
        <StatPill label="API Handlers"  value={data.srcApiCount}  color="#C9A84C" />
        <StatPill label="Routes"        value={data.totalRoutes}  color="#8B5CF6" />
      </div>

      {/* Build artifacts */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'dist/ exists',          ok: data.distExists  },
          { label: 'dist/client/ exists',   ok: data.distClient  },
          { label: 'dist/server.bundle.mjs',ok: data.distServer  },
        ].map(a => (
          <div key={a.label} className={`flex items-center gap-2 p-3 rounded-xl border ${a.ok ? 'border-emerald-400/15 bg-emerald-400/[0.04]' : 'border-amber-400/15 bg-amber-400/[0.04]'}`}>
            {a.ok ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <AlertCircle size={13} className="text-amber-400 shrink-0" />}
            <span className="text-white/50 text-xs font-mono">{a.label}</span>
          </div>
        ))}
      </div>

      {/* Project info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        {[
          { label: 'Package',      value: data.name },
          { label: 'Version',      value: data.version },
          { label: 'Node.js',      value: data.nodeVersion },
          { label: 'Environment',  value: data.environment },
          { label: 'Build Cmd',    value: data.buildCommand },
          { label: 'Start Cmd',    value: data.startCommand },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04]"
            style={{ background: 'rgba(255,255,255,0.015)' }}>
            <span className="text-white/30">{item.label}</span>
            <span className="text-white/60 font-mono text-[11px] truncate max-w-[140px] text-right">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Scripts */}
      <div>
        <p className="text-white/30 text-xs font-medium mb-2 uppercase tracking-wider">NPM Scripts</p>
        <div className="space-y-1.5">
          {data.scripts.map(s => (
            <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.04]"
              style={{ background: 'rgba(255,255,255,0.015)' }}>
              <span className="text-white/50 text-xs font-mono min-w-[80px]">{s.name}</span>
              <code className="text-white/30 text-[11px] font-mono truncate">{s.command}</code>
              <CopyButton text={`npm run ${s.name}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Deployment Information ─────────────────────────────────────────

function DeploymentInformation({ data }: { data: DeployInfo }) {
  return (
    <div className="space-y-4">
      {/* URLs */}
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { label: 'Preview URL',    url: data.previewUrl,    color: '#3B82F6' },
          { label: 'Production URL', url: data.productionUrl, color: '#10B981' },
        ].map(u => (
          <a key={u.label} href={u.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl border border-white/[0.05] hover:border-white/10 transition-colors group"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div>
              <p className="text-white/30 text-[10px] mb-0.5">{u.label}</p>
              <p className="text-xs font-mono truncate max-w-[220px]" style={{ color: u.color }}>{u.url}</p>
            </div>
            <ExternalLink size={12} className="text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
          </a>
        ))}
      </div>

      {/* Storage paths */}
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { label: 'Private Storage', path: data.privatePath, ok: data.privateExists },
          { label: 'Public Storage',  path: data.publicPath,  ok: data.publicExists  },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border ${s.ok ? 'border-emerald-400/15' : 'border-red-400/15'}`}
            style={{ background: s.ok ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)' }}>
            {s.ok ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <XCircle size={13} className="text-red-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-white/40 text-[10px]">{s.label}</p>
              <code className="text-white/50 text-[11px] font-mono truncate block">{s.path}</code>
            </div>
            <CopyButton text={s.path} />
          </div>
        ))}
      </div>

      {/* System info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        {[
          { label: 'Environment',  value: data.environment },
          { label: 'App Env',      value: data.appEnv },
          { label: 'Port',         value: data.port },
          { label: 'Host',         value: data.host },
          { label: 'Platform',     value: `${data.platform}/${data.arch}` },
          { label: 'Node.js',      value: data.nodeVersion },
          { label: 'PID',          value: String(data.pid) },
          { label: 'Uptime',       value: data.uptimeHuman },
          { label: 'Started At',   value: new Date(data.startedAt).toLocaleString('en-GB') },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.04]"
            style={{ background: 'rgba(255,255,255,0.015)' }}>
            <span className="text-white/30">{item.label}</span>
            <span className="text-white/60 font-mono text-[11px] truncate max-w-[120px] text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Environment Validation ─────────────────────────────────────────

function EnvValidation({ data }: { data: DeveloperData['env'] }) {
  const [filter, setFilter] = useState<'ALL' | 'MISSING' | 'PRESENT' | 'DEFAULT'>('ALL');
  const [serviceFilter, setServiceFilter] = useState('');

  const services = Array.from(new Set(data.variables.map(v => v.service))).sort();
  const filtered = data.variables.filter(v =>
    (filter === 'ALL' || v.status === filter) &&
    (!serviceFilter || v.service === serviceFilter)
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatPill label="Total"    value={data.summary.total}    />
        <StatPill label="Present"  value={data.summary.present}  color="#10B981" />
        <StatPill label="Defaults" value={data.summary.defaults} color="#F59E0B" />
        <StatPill label="Missing"  value={data.summary.missing}  color={data.summary.missing > 0 ? '#EF4444' : '#10B981'} />
        <StatPill label="Critical" value={data.summary.critical} color={data.summary.critical > 0 ? '#EF4444' : '#10B981'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['ALL','PRESENT','DEFAULT','MISSING'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter === f ? 'text-black font-bold' : 'text-white/40 hover:text-white/70'}`}
            style={filter === f ? { background: 'linear-gradient(135deg,#C9A84C,#F0D080)' } : { background: 'rgba(255,255,255,0.04)' }}>
            {f}
          </button>
        ))}
        <div className="relative">
          <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-1.5 pr-7 text-xs text-white/50 focus:outline-none cursor-pointer">
            <option value="" style={{ background: '#0a0a0a' }}>All Services</option>
            {services.map(s => <option key={s} value={s} style={{ background: '#0a0a0a' }}>{s}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
        <span className="text-white/25 text-xs self-center">{filtered.length} vars</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.05] max-h-[480px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10" style={{ background: 'rgba(10,10,10,0.95)' }}>
            <tr className="border-b border-white/5">
              {['Status','Name','Level','Service','Value','Description'].map(h => (
                <th key={h} className="text-left text-white/25 font-medium py-2.5 px-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map((v, i) => (
              <tr key={i} className={`hover:bg-white/[0.02] transition-colors ${v.status === 'MISSING' && v.level === 'CRITICAL' ? 'bg-red-400/[0.03]' : ''}`}>
                <td className="py-2.5 px-3">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: ENV_STATUS_COLORS[v.status] ?? '#6B7280', background: `${ENV_STATUS_COLORS[v.status] ?? '#6B7280'}15` }}>
                    {v.status}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1">
                    <code className="text-white/70 font-mono text-[11px]">{v.name}</code>
                    {v.isPublic && <span className="text-[9px] text-blue-400/60 bg-blue-400/10 px-1 rounded">public</span>}
                  </div>
                  {v.aliases.length > 0 && (
                    <p className="text-white/20 text-[10px] font-mono">alias: {v.aliases.join(', ')}</p>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <span className="text-[10px] font-bold"
                    style={{ color: ENV_LEVEL_COLORS[v.level] ?? '#6B7280' }}>
                    {v.level}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-white/40 whitespace-nowrap">{v.service}</td>
                <td className="py-2.5 px-3">
                  <code className="text-white/30 text-[11px] font-mono">{v.maskedValue || (v.defaultVal ? `(default: ${v.defaultVal})` : '—')}</code>
                </td>
                <td className="py-2.5 px-3 text-white/30 max-w-xs truncate">{v.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDeveloper() {
  const [data,    setData]    = useState<DeveloperData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/developer', {
        credentials: 'same-origin', headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const envOk = data ? data.env.summary.critical === 0 : null;
  const dbOk  = data ? data.db.unhealthy === 0 : null;

  return (
    <>
      <Helmet>
        <title>Developer Center — City Gate Capital Admin</title>
        <meta name="description" content="City Gate Capital developer tools — route explorer, API explorer, DB diagnostics, performance, dependencies, error monitor, build and deployment info." />
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/developer" />
      </Helmet>
      <AdminLayout title="Developer Center">
        <div className="space-y-4 p-1">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                <Terminal size={20} style={{ color: '#C9A84C' }} />
                Developer Center
              </h1>
              <p className="text-white/30 text-sm mt-0.5">Route explorer · API tester · DB diagnostics · Performance · Build info</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Health pills */}
              {data && (
                <>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${envOk ? 'border-emerald-400/20 text-emerald-400' : 'border-red-400/20 text-red-400'}`}
                    style={{ background: envOk ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)' }}>
                    {envOk ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    Env {envOk ? 'OK' : `${data.env.summary.critical} critical`}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${dbOk ? 'border-emerald-400/20 text-emerald-400' : 'border-amber-400/20 text-amber-400'}`}
                    style={{ background: dbOk ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)' }}>
                    {dbOk ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    DB {dbOk ? 'OK' : `${data.db.unhealthy} issues`}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-white/40 text-xs">
                    <Clock size={11} />
                    {new Date(data.generatedAt).toLocaleTimeString('en-GB')}
                  </div>
                </>
              )}
              <button onClick={fetchData}
                className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* ── Loading / error ──────────────────────────────────────────── */}
          {loading && (
            <div className="flex items-center gap-2 text-white/30 text-xs py-4">
              <Loader2 size={14} className="animate-spin" /> Collecting developer data…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-400/8 border border-red-400/15 text-red-300 text-sm">
              <XCircle size={14} /> {error}
            </div>
          )}

          {/* ── Sections ─────────────────────────────────────────────────── */}
          {!loading && data && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">

              <SectionCard title="Route Explorer" subtitle={`${data.routes.total} registered routes across ${Object.keys(data.routes.byGroup).length} groups`} icon={Network} color="#C9A84C">
                <RouteExplorer data={data.routes} />
              </SectionCard>

              <SectionCard title="API Explorer" subtitle="Send live requests to any endpoint" icon={Zap} color="#3B82F6" defaultOpen={false}>
                <ApiExplorer routes={data.routes.catalogue} />
              </SectionCard>

              <SectionCard title="Database Diagnostics" subtitle={`${data.db.totalFiles} flat-file stores · ${fmtBytes(data.db.totalBytes)} total · ${data.db.healthy} healthy`} icon={Database} color="#8B5CF6">
                <DbDiagnostics data={data.db} />
              </SectionCard>

              <SectionCard title="Performance Metrics" subtitle={`Uptime ${data.performance.uptimeHuman} · Heap ${data.performance.memoryPct}% used`} icon={Activity} color="#10B981">
                <PerformanceMetrics data={data.performance} />
              </SectionCard>

              <SectionCard title="Dependency Health" subtitle={`${data.dependencies.totalDeps} runtime · ${data.dependencies.totalDevDeps} dev`} icon={Package} color="#F59E0B" defaultOpen={false}>
                <DependencyHealth data={data.dependencies} />
              </SectionCard>

              <SectionCard title="Error Monitor" subtitle={`${data.errors.errorRate}% error rate · ${fmtNum(data.errors.totalRequests)} total requests`} icon={AlertTriangle} color={data.errors.http5xx > 0 ? '#EF4444' : '#10B981'}>
                <ErrorMonitor data={data.errors} />
              </SectionCard>

              <SectionCard title="Build Information" subtitle={`${data.build.srcFileCount} source files · ${data.build.srcPageCount} pages · ${data.build.srcApiCount} API handlers`} icon={FileCode2} color="#06B6D4">
                <BuildInformation data={data.build} />
              </SectionCard>

              <SectionCard title="Deployment Information" subtitle={`${data.deployment.environment} · ${data.deployment.uptimeHuman} uptime`} icon={Server} color="#EC4899">
                <DeploymentInformation data={data.deployment} />
              </SectionCard>

              <SectionCard title="Environment Validation" subtitle={`${data.env.summary.present} present · ${data.env.summary.missing} missing · ${data.env.summary.critical} critical`} icon={Shield} color={data.env.summary.critical > 0 ? '#EF4444' : '#10B981'}>
                <EnvValidation data={data.env} />
              </SectionCard>

            </motion.div>
          )}
        </div>
      </AdminLayout>
    </>
  );
}
