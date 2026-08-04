import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

interface TransportHealth {
  oauth: HealthStatus;
  smtp: HealthStatus;
  queue: HealthStatus;
  lastSuccessfulEmail: string | null;
  lastFailedEmail: string | null;
  tokenExpiry: string | null;
}

interface TestResult {
  success: boolean;
  transport: string;
  message: string;
}

// Real shape of emailQueue.ts's QueuedEmail — the store has no per-transport
// tracking (OAuth/SMTP/queue is decided at send time, not recorded per entry).
interface LogEntry {
  id: string;
  to: string;
  subject: string;
  status: 'queued' | 'sent' | 'failed' | 'retrying';
  errorMessage?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy:  'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  down:     'bg-red-100 text-red-800',
  unknown:  'bg-gray-100 text-gray-600',
};

const STATUS_DOT: Record<HealthStatus, string> = {
  healthy:  'bg-green-500',
  degraded: 'bg-yellow-400',
  down:     'bg-red-500',
  unknown:  'bg-gray-400',
};

function StatusBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[status]}`}>
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TokenCountdown({ expiry }: { expiry: string | null }) {
  const [remaining, setRemaining] = useState<string>('—');

  useEffect(() => {
    if (!expiry) { setRemaining('—'); return; }
    const tick = () => {
      const diff = new Date(expiry).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiry]);

  return <span>{remaining}</span>;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EmailDiagnostics() {
  const [health, setHealth]       = useState<TransportHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError]     = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState('admin@citygate.capital');
  const [sending, setSending]     = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch health
  const fetchHealth = useCallback(async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/admin/email/health', { credentials: 'include' });
      const data = await res.json();
      if (data.success === false) throw new Error(data.error || 'Unknown error');
      setHealth(data as TransportHealth);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/email/log', { credentials: 'include' });
      const data = await res.json();
      if (data.entries) setLogs(data.entries as LogEntry[]);
    } catch {
      // non-critical
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchLogs();
    const id = setInterval(() => { fetchHealth(); fetchLogs(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchHealth, fetchLogs]);

  // Send test email
  const handleSendTest = async () => {
    if (!testEmail) return;
    setSending(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json() as { ok: boolean; message: string; config?: { transport?: string } };
      setTestResult({ success: data.ok, transport: data.config?.transport ?? 'unknown', message: data.message });
      fetchLogs();
    } catch (err) {
      setTestResult({ success: false, transport: 'unknown', message: String(err) });
    } finally {
      setSending(false);
    }
  };

  const active = health
    ? health.oauth === 'healthy' ? 'OAuth' : health.smtp === 'healthy' ? 'SMTP' : 'Queue'
    : '—';

  return (
    <AdminLayout title="Email Diagnostics">
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Diagnostics</h1>
            <p className="mt-1 text-sm text-gray-500">
              Transport health, token status, and delivery logs.
            </p>
          </div>
          <button
            onClick={() => { fetchHealth(); fetchLogs(); }}
            disabled={loadingHealth}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingHealth ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {healthError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {healthError}
          </div>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['oauth', 'smtp', 'queue'] as const).map(key => (
            <div key={key} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                {key === 'oauth' ? 'Zoho OAuth' : key === 'smtp' ? 'SMTP' : 'Queue'}
              </p>
              <StatusBadge status={health ? health[key] : 'unknown'} />
            </div>
          ))}

          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Active Transport
            </p>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              {active}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 divide-y divide-gray-100">
          <div className="flex justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-600">Token Expiry</span>
            <span className="text-sm text-gray-900 font-mono">
              <TokenCountdown expiry={health?.tokenExpiry ?? null} />
            </span>
          </div>
          <div className="flex justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-600">Token Expiry (UTC)</span>
            <span className="text-sm text-gray-500">{fmt(health?.tokenExpiry ?? null)}</span>
          </div>
          <div className="flex justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-600">Last Successful Email</span>
            <span className="text-sm text-gray-500">{fmt(health?.lastSuccessfulEmail ?? null)}</span>
          </div>
          <div className="flex justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-600">Last Failed Email</span>
            <span className="text-sm text-gray-500">{fmt(health?.lastFailedEmail ?? null)}</span>
          </div>
        </div>

        {/* Test email */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Send Test Email</h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendTest}
              disabled={sending || !testEmail}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send Test'}
            </button>
          </div>
          {testResult && (
            <div className={`rounded-lg px-4 py-3 text-sm ${testResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {testResult.message}
            </div>
          )}
        </div>

        {/* Log table */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Delivery Log</h2>
            {loadingLogs && <span className="text-xs text-gray-400">Loading…</span>}
          </div>
          {logs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No log entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Time', 'Recipient', 'Subject', 'Status', 'Error'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{entry.to}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{entry.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.status === 'sent' ? 'bg-green-50 text-green-700' : entry.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">
                        {entry.errorMessage || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
    </AdminLayout>
  );
}
