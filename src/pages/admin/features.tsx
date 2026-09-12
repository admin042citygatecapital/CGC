/**
 * /admin/features — Feature Flag Control
 *
 * Dedicated single-purpose view over the platform feature toggles and the
 * platform-wide maintenance mode. Reads and writes through the existing
 * /api/admin/config endpoints (section: 'featureToggles' | 'maintenanceMode')
 * — no separate storage, so every change flows through the same validation,
 * workflow-version guard and audit path as the Configuration Center.
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertTriangle, Loader2, RefreshCw, ToggleLeft, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_FEATURES,
  type PlatformFeatureKey,
} from '@/shared/platformFeatures';

type Features = Record<PlatformFeatureKey, boolean>;

interface MaintenanceMode {
  enabled?: boolean;
  message?: string;
  estimatedEndTime?: string;
}

const FEATURE_LABELS: Record<PlatformFeatureKey, string> = {
  accounts: 'Customer accounts',
  multiCurrency: 'Multi-currency balances',
  fx: 'Currency exchange (FX)',
  transfers: 'Transfers',
  cards: 'Virtual cards',
  wallets: 'Wallets',
  investments: 'Trading & investments',
  markets: 'Market data',
  analytics: 'Customer analytics',
  savingsGoals: 'Savings goals',
  businessBanking: 'Business banking',
  rewards: 'Rewards',
  statements: 'Account statements',
  supportChat: 'Support chat',
  kyc: 'KYC / identity verification',
  registration: 'Customer registration',
  notifications: 'Notifications',
  emails: 'Email delivery',
  beneficiaries: 'Beneficiaries',
  payments: 'Bill payments',
  support: 'Support center',
};

const FEATURE_GROUPS: Array<{ label: string; keys: PlatformFeatureKey[] }> = [
  { label: 'Access & onboarding', keys: ['registration', 'kyc', 'accounts'] },
  { label: 'Banking', keys: ['transfers', 'beneficiaries', 'payments', 'multiCurrency', 'fx', 'cards', 'wallets'] },
  { label: 'Wealth & data', keys: ['investments', 'markets', 'analytics', 'savingsGoals', 'rewards', 'statements'] },
  { label: 'Communications & service', keys: ['notifications', 'emails', 'supportChat', 'support'] },
  { label: 'Other', keys: ['businessBanking'] },
];

export default function AdminFeatures() {
  const [features, setFeatures] = useState<Features>({ ...DEFAULT_PLATFORM_FEATURES });
  const [maintenance, setMaintenance] = useState<MaintenanceMode>({});
  const [workflowVersion, setWorkflowVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/config', { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const loaded = await r.json() as {
        featureToggles?: { platformFeatures?: Partial<Features> };
        maintenanceMode?: MaintenanceMode;
        workflowVersion?: string | null;
      };
      setFeatures({ ...DEFAULT_PLATFORM_FEATURES, ...loaded.featureToggles?.platformFeatures });
      setMaintenance(loaded.maintenanceMode ?? {});
      setWorkflowVersion(loaded.workflowVersion ?? null);
    } catch {
      showToast(false, 'Failed to load configuration — check your connection');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const postSection = useCallback(async (
    section: 'featureToggles' | 'maintenanceMode',
    data: unknown,
  ): Promise<boolean> => {
    const r = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, data, expectedWorkflowVersion: workflowVersion }),
    });
    if (r.status === 409) {
      showToast(false, 'Configuration changed elsewhere — reloading latest state');
      await load();
      return false;
    }
    if (!r.ok) {
      showToast(false, `Save failed (HTTP ${r.status})`);
      return false;
    }
    const j = await r.json() as { workflowVersion?: string | null; config?: { workflowVersion?: string | null } };
    setWorkflowVersion(j.workflowVersion ?? j.config?.workflowVersion ?? workflowVersion);
    return true;
  }, [load, showToast, workflowVersion]);

  const toggleFeature = useCallback(async (key: PlatformFeatureKey) => {
    if (savingKey) return;
    const next = !features[key];
    setSavingKey(key);
    const previous = features;
    setFeatures(f => ({ ...f, [key]: next }));
    const ok = await postSection('featureToggles', {
      platformFeatures: { ...features, [key]: next },
    });
    if (!ok) setFeatures(previous);
    else showToast(true, `${FEATURE_LABELS[key]} ${next ? 'enabled' : 'disabled'}`);
    setSavingKey(null);
  }, [features, postSection, savingKey, showToast]);

  const saveMaintenance = useCallback(async (next: MaintenanceMode) => {
    setSavingMaintenance(true);
    const previous = maintenance;
    setMaintenance(next);
    const ok = await postSection('maintenanceMode', next);
    if (!ok) setMaintenance(previous);
    else showToast(true, next.enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
    setSavingMaintenance(false);
  }, [maintenance, postSection, showToast]);

  return (
    <AdminLayout>
      <Helmet><title>Feature Flags — City Gate Capital Admin</title></Helmet>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ToggleLeft className="h-6 w-6" /> Feature Flags
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Customer module availability and platform-wide maintenance state.
              Changes apply immediately and are audited.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Reload configuration"
            className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--accent)]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-[var(--muted-foreground)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading configuration…
          </div>
        ) : (
          <>
            {/* Maintenance mode — platform-wide state */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Wrench className="h-5 w-5" /> Maintenance mode
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Temporarily pauses customer-facing operations platform-wide.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={maintenance.enabled ?? false}
                    disabled={savingMaintenance}
                    onChange={(e) => void saveMaintenance({ ...maintenance, enabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Enabled
                </label>
                <input
                  type="text"
                  value={maintenance.message ?? ''}
                  disabled={savingMaintenance}
                  placeholder="Message shown to customers…"
                  onChange={(e) => setMaintenance(m => ({ ...m, message: e.target.value }))}
                  onBlur={() => { if (maintenance.enabled) void saveMaintenance(maintenance); }}
                  className="min-w-64 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                  aria-label="Maintenance message"
                />
              </div>
            </section>

            {/* Feature groups */}
            {FEATURE_GROUPS.map(group => (
              <section key={group.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h2 className="text-lg font-semibold">{group.label}</h2>
                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {group.keys.map(key => (
                    <li key={key} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{FEATURE_LABELS[key]}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{key}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={features[key]}
                        aria-label={`${FEATURE_LABELS[key]} — ${features[key] ? 'enabled' : 'disabled'}`}
                        disabled={savingKey !== null}
                        onClick={() => void toggleFeature(key)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                          features[key] ? 'bg-emerald-600' : 'bg-[var(--muted)]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            features[key] ? 'left-[1.375rem]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Disabling a feature gates the matching customer API routes server-side
              and hides customer UI entry points. Narrower per-plan, per-country and
              per-user restrictions live in the Config Center (Feature Access).
            </p>
          </>
        )}

        {toast && (
          <div
            role="status"
            className={`fixed bottom-6 right-6 rounded-xl px-4 py-3 text-sm shadow-lg ${
              toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}