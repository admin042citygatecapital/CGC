/**
 * ApplicationWizard — shared, config-driven multi-step registration.
 *
 * Renders any account-application journey from APPLICATION_FLOWS: one engine
 * for all five account types. Persists each step through
 * PATCH /api/applications/:id, resumes from the server's currentStep, and
 * keeps City Gate Capital's dark/gold identity. Fully responsive.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import {
  ACCOUNT_TYPE_META, APPLICATION_FLOWS, validateStep,
  type AccountType, type AccountPlan, type StepDef,
} from '../../shared/applicationFlow';

interface ApplicationState {
  id: string;
  reference: string | null;
  status: string;
  currentStep: string;
  completionPct: number;
  steps: Record<string, Record<string, unknown>>;
}

const STORAGE_PREFIX = 'cgc.application.';

export default function ApplicationWizard({ type, plan }: { type: AccountType; plan?: AccountPlan }) {
  const meta = ACCOUNT_TYPE_META[type];
  const steps = APPLICATION_FLOWS[type];
  const [app, setApp] = useState<ApplicationState | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const resumed = useRef(false);

  // Boot: resume an in-flight application for this type (id from localStorage),
  // otherwise create one. Anonymous drafts live in localStorage until the
  // identity step links them.
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    (async () => {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + type);
      if (stored) {
        try {
          const r = await fetch(`/api/applications/${stored}`, { credentials: 'include' });
          if (r.ok) {
            const j = await r.json() as { application: ApplicationState };
            setApp(j.application);
            setValues(j.application.steps);
            setStepIndex(Math.max(0, steps.findIndex(s => s.id === j.application.currentStep)));
            setBooting(false);
            return;
          }
          window.localStorage.removeItem(STORAGE_PREFIX + type);
        } catch {
          // Transient failure — keep the stored draft id and let the user
          // retry instead of silently creating an orphan duplicate.
          setNotice('Could not reach the server. Please try again.');
          setBooting(false);
          return;
        }
      }
      const r = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountType: type, plan }),
      });
      if (r.ok) {
        const j = await r.json() as { application: ApplicationState };
        setApp(j.application);
        window.localStorage.setItem(STORAGE_PREFIX + type, j.application.id);
      } else {
        const j = await r.json().catch(() => ({ error: 'Could not start the application.' })) as { error?: string };
        setNotice(j.error ?? 'Could not start the application.');
      }
      setBooting(false);
    })();
  }, [type, plan, steps]);

  const step: StepDef = steps[stepIndex];

  const saveStep = useCallback(async (advance: boolean) => {
    if (!app) return;
    const stepErrors = validateStep(step, values[step.id] ?? {});
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stepId: step.id, data: values[step.id] ?? {} }),
      });
      const j = await r.json() as { application?: ApplicationState; error?: string; code?: string; errors?: Record<string, string> };
      if (j.code === 'EXISTING_CUSTOMER') {
        setNotice(j.error ?? 'A customer with this email already exists. Sign in instead.');
        return;
      }
      if (!r.ok) {
        if (j.errors) setErrors(j.errors);
        setNotice(j.error ?? 'Could not save this step.');
        return;
      }
      if (j.application) {
        setApp(j.application);
        setValues(v => ({ ...v, ...j.application!.steps }));
        if (advance) setStepIndex(i => Math.min(i + 1, steps.length - 1));
      }
    } catch {
      setNotice('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }, [app, step, steps.length, values]);

  const submit = useCallback(async () => {
    if (!app) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/applications/${app.id}/submit`, { method: 'POST', credentials: 'include' });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setNotice(j.error ?? 'Submission failed.');
        return;
      }
      window.localStorage.removeItem(STORAGE_PREFIX + type);
      setApp(a => a ? { ...a, status: 'REVIEW_REQUIRED' } : a);
    } catch {
      setNotice('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }, [app, type]);

  const setField = (name: string, value: unknown) => {
    setValues(v => ({ ...v, [step.id]: { ...v[step.id], [name]: value } }));
    setErrors(e => { const n = { ...e }; delete n[name]; return n; });
  };

  const needsInfo = app?.status === 'NEEDS_INFORMATION';
  const submitted = app ? ['REVIEW_REQUIRED', 'APPROVED', 'ACTIVATION_PENDING'].includes(app.status) : false;
  const inputCls = 'w-full rounded-lg border border-[#2a2a2e] bg-[#101014] px-3 py-2.5 text-sm text-white placeholder:text-[#6b6b74] focus:border-[#E6C76A]/70 focus:outline-none';

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Helmet><title>{meta.label} Account Application — City Gate Capital</title></Helmet>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8">
          <Link to="/register" className="inline-flex items-center gap-2 text-sm text-[#E6C76A]/80 hover:text-[#E6C76A]">
            <ArrowLeft className="h-4 w-4" /> All account types
          </Link>
          <h1 className="mt-4 text-3xl font-bold">{meta.label} Account</h1>
          <p className="mt-2 text-sm text-[#a9a9b2]">{meta.description}</p>
          {app?.reference && (
            <p className="mt-2 text-xs text-[#6b6b74]">Reference {app.reference} · {app.completionPct}% complete</p>
          )}
        </header>

        {/* Progress indicator */}
        <ol className="mb-8 flex flex-wrap gap-2 text-xs">
          {steps.map((s, i) => (
            <li key={s.id} className={`rounded-full px-3 py-1 ${
              i < stepIndex || submitted ? 'bg-emerald-600/20 text-emerald-300'
              : i === stepIndex ? 'bg-[#E6C76A] font-semibold text-black'
              : 'bg-[#16161a] text-[#6b6b74]'
            }`}>{s.title}</li>
          ))}
        </ol>

        {booting ? (
          <div className="flex items-center gap-2 py-16 text-[#a9a9b2]"><Loader2 className="h-5 w-5 animate-spin" /> Preparing your application…</div>
        ) : submitted ? (
          <section className="rounded-2xl border border-[#2a2a2e] bg-[#0d0d11] p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="mt-4 text-xl font-semibold">Application submitted</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#a9a9b2]">
              Your {meta.label} application is in review. Track its status any time — approval of the
              platform application is separate from the activation of any regulated financial service.
            </p>
            <Link to="/application/status" className="mt-6 inline-block rounded-xl bg-[#E6C76A] px-5 py-2.5 text-sm font-semibold text-black">
              View application status
            </Link>
          </section>
        ) : (
          <>
            {needsInfo && app?.status === 'NEEDS_INFORMATION' && (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Additional information requested — update the relevant steps and
                resubmit. {(app as { informationRequest?: string }).informationRequest}
              </p>
            )}
            <section className="rounded-2xl border border-[#2a2a2e] bg-[#0d0d11] p-6">
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-[#a9a9b2]">{step.description}</p>

              {step.id === 'verification' ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="rounded-lg bg-[#E6C76A]/10 px-3 py-2 text-[#E6C76A]">
                    We emailed a verification link to <strong>{String(values.contact?.email ?? 'your email')}</strong>.
                    Click it, sign in, then continue here.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveStep(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#E6C76A] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    I have verified my email — continue
                  </button>
                </div>
              ) : step.fields.length === 0 ? (
                <p className="mt-4 text-sm text-[#a9a9b2]">Review the summary below, then continue to submit.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {step.fields.map(field => (
                    <label key={field.name} className="block">
                      <span className="mb-1.5 block text-sm font-medium">
                        {field.label}
                        {!field.required && <span className="ml-1 text-xs text-[#6b6b74]">(optional)</span>}
                      </span>
                      {field.type === 'select' ? (
                        <select
                          value={String(values[step.id]?.[field.name] ?? '')}
                          onChange={e => setField(field.name, e.target.value)}
                          className={inputCls}
                        >
                          <option value="">Select…</option>
                          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <span className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={values[step.id]?.[field.name] === true}
                            onChange={e => setField(field.name, e.target.checked)}
                            className="h-4 w-4"
                          />
                          {field.label}
                        </span>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          maxLength={field.maxLength}
                          value={String(values[step.id]?.[field.name] ?? '')}
                          onChange={e => setField(field.name, e.target.value)}
                          className={inputCls}
                        />
                      ) : (
                        <input
                          type={field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          value={String(values[step.id]?.[field.name] ?? '')}
                          onChange={e => setField(field.name, e.target.value)}
                          className={inputCls}
                        />
                      )}
                      {errors[field.name] && <span className="mt-1 block text-xs text-red-400">{errors[field.name]}</span>}
                      {field.hint && !errors[field.name] && <span className="mt-1 block text-xs text-[#6b6b74]">{field.hint}</span>}
                    </label>
                  ))}
                </div>
              )}

              {notice && (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
                </p>
              )}
            </section>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={stepIndex === 0 || busy}
                onClick={() => setStepIndex(i => Math.max(i - 1, 0))}
                className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2e] px-4 py-2.5 text-sm disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <span className="text-xs text-[#6b6b74]">Your progress is saved as you continue.</span>
              {step.id === 'review' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E6C76A] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Submit application
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveStep(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E6C76A] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save &amp; continue
                </button>
              )}
            </div>

            <p className="mt-6 flex items-start gap-2 text-xs text-[#6b6b74]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E6C76A]/70" />
              Never share passwords, authentication codes, or card details with anyone — City Gate
              Capital staff will never ask for them. Submitting an application does not create funded
              accounts, cards, or live financial services; those activate only after approval and the
              relevant provider integrations.
            </p>
          </>
        )}
      </div>
    </div>
  );
}