import { Helmet } from '@dr.pogodin/react-helmet';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Flag, Loader2, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '@/lib/customerAuth';

type GoalStatus = 'active' | 'completed' | 'paused';
interface Goal { id: string; name: string; currency: string; targetMinor: string; trackedMinor: string; monthlyContributionMinor: string; targetDate?: string | null; status: GoalStatus; }
interface GoalForm { id?: string; name: string; currency: string; target: string; tracked: string; monthly: string; targetDate: string; status: GoalStatus; }
const EMPTY: GoalForm = { name: '', currency: 'GBP', target: '', tracked: '0', monthly: '0', targetDate: '', status: 'active' };
const CURRENCIES = ['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'CHF'];

const toMinor = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? String(Math.round(amount * 100)) : '';
};
const fromMinor = (value: string) => (Number(value || 0) / 100).toFixed(2);
const money = (minor: string, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(minor || 0) / 100);

export default function GoalsPage() {
  const { customer, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<GoalForm | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true }); }, [customer, loading, navigate]);
  const load = async () => {
    setFetching(true);
    try {
      const response = await fetch('/api/users/goals', { credentials: 'same-origin' });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setGoals(body.goals ?? []);
        setMessage('');
      } else {
        setMessage(body.error ?? 'Savings goals are temporarily unavailable.');
      }
    } finally { setFetching(false); }
  };
  useEffect(() => { if (customer) void load(); }, [customer]);

  const totalProgress = useMemo(() => goals.reduce((sum, goal) => sum + Math.min(100, Number(goal.trackedMinor) / Math.max(1, Number(goal.targetMinor)) * 100), 0) / Math.max(1, goals.length), [goals]);
  const edit = (goal: Goal) => setForm({ id: goal.id, name: goal.name, currency: goal.currency, target: fromMinor(goal.targetMinor), tracked: fromMinor(goal.trackedMinor), monthly: fromMinor(goal.monthlyContributionMinor), targetDate: goal.targetDate?.slice(0, 10) ?? '', status: goal.status });

  async function submit(action: 'create' | 'update' | 'delete', goalForm: GoalForm) {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/users/goals', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'delete' ? { action, id: goalForm.id } : {
          action, id: goalForm.id, name: goalForm.name, currency: goalForm.currency,
          targetMinor: toMinor(goalForm.target), trackedMinor: toMinor(goalForm.tracked),
          monthlyContributionMinor: toMinor(goalForm.monthly), targetDate: goalForm.targetDate || null, status: goalForm.status,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Unable to save goal.');
      setForm(null); setMessage(action === 'delete' ? 'Goal removed.' : 'Goal saved.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save goal.'); }
    finally { setSaving(false); }
  }

  if (loading || !customer) return <div className="min-h-screen bg-background grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  return <>
    <Helmet><title>Financial Goals — City Gate Capital</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,.92)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link to="/dashboard" className="grid h-8 w-8 place-items-center rounded-xl border border-white/8 bg-white/5 text-foreground/50"><ArrowLeft size={15} /></Link>
          <Target size={16} className="text-primary" /><span className="text-sm font-semibold">Financial Goals</span>
          <button onClick={() => setForm({ ...EMPTY })} className="ml-auto flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><Plus size={13} /> New goal</button>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_90%_0%,rgba(201,168,76,.14),transparent_45%),rgba(255,255,255,.02)] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Planning overview</p>
          <div className="mt-3 flex items-end justify-between"><div><h1 className="text-2xl font-bold">Build toward what matters</h1><p className="mt-2 text-xs leading-6 text-foreground/45">Create targets, track progress, and estimate your pace without changing any account balance.</p></div><span className="text-2xl font-bold text-primary">{Math.round(totalProgress)}%</span></div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/7"><div className="h-full rounded-full bg-gradient-to-r from-[#9f7b22] to-[#f0d080]" style={{ width: `${Math.min(100, totalProgress)}%` }} /></div>
        </section>
        {message && <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-primary">{message}</div>}
        <AnimatePresence>{form && <GoalEditor form={form} setForm={setForm} saving={saving} onSave={() => void submit(form.id ? 'update' : 'create', form)} onDelete={form.id ? () => void submit('delete', form) : undefined} />}</AnimatePresence>
        {fetching ? <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-foreground/25" /></div> : goals.length === 0 ? <button onClick={() => setForm({ ...EMPTY })} className="w-full rounded-3xl border border-dashed border-white/10 py-16 text-center"><Target className="mx-auto text-primary/50" /><p className="mt-4 text-sm font-semibold text-foreground/60">Create your first financial goal</p><p className="mt-1 text-xs text-foreground/30">Set a target and track your progress over time.</p></button> : <div className="grid gap-4 md:grid-cols-2">{goals.map(goal => {
          const progress = Math.min(100, Number(goal.trackedMinor) / Math.max(1, Number(goal.targetMinor)) * 100);
          const remaining = Math.max(0, Number(goal.targetMinor) - Number(goal.trackedMinor));
          const months = Number(goal.monthlyContributionMinor) > 0 ? Math.ceil(remaining / Number(goal.monthlyContributionMinor)) : null;
          return <motion.article key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/7 bg-white/[.02] p-5">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Flag size={17} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{goal.name}</h2><p className="mt-1 text-[10px] uppercase tracking-wider text-foreground/30">{goal.status}</p></div><button onClick={() => edit(goal)} className="grid h-8 w-8 place-items-center rounded-xl border border-white/7 text-foreground/35"><Pencil size={12} /></button></div>
            <div className="mt-5 flex items-end justify-between"><div><p className="text-[10px] text-foreground/30">Tracked progress</p><p className="mt-1 text-xl font-bold text-primary">{money(goal.trackedMinor, goal.currency)}</p></div><p className="text-xs text-foreground/40">of {money(goal.targetMinor, goal.currency)}</p></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/7"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
            <div className="mt-4 flex items-center justify-between text-[10px] text-foreground/35"><span>{Math.round(progress)}% complete</span><span>{months === null ? 'Add a monthly target' : `Est. ${months} month${months === 1 ? '' : 's'}`}</span></div>
          </motion.article>;
        })}</div>}
        <div className="rounded-2xl border border-white/5 bg-white/[.015] p-4 text-[10px] leading-5 text-foreground/30">Goals are planning tools only. Tracked progress is entered by you and does not reserve, transfer, or alter funds.</div>
      </div>
    </main>
  </>;
}

function GoalEditor({ form, setForm, saving, onSave, onDelete }: { form: GoalForm; setForm: (value: GoalForm | null) => void; saving: boolean; onSave: () => void; onDelete?: () => void }) {
  const patch = (key: keyof GoalForm, value: string) => setForm({ ...form, [key]: value });
  return <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-3xl border border-primary/20 bg-[#0b0b0a] p-5">
    <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{form.id ? 'Edit financial goal' : 'Create a financial goal'}</h2><button onClick={() => setForm(null)} className="text-foreground/35"><X size={17} /></button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="Goal name"><input value={form.name} onChange={e => patch('name', e.target.value)} maxLength={80} placeholder="Emergency fund" /></Field>
      <Field label="Currency"><select value={form.currency} onChange={e => patch('currency', e.target.value)}>{CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
      <Field label="Target amount"><input type="number" min="0.01" step="0.01" value={form.target} onChange={e => patch('target', e.target.value)} /></Field>
      <Field label="Tracked progress"><input type="number" min="0" step="0.01" value={form.tracked} onChange={e => patch('tracked', e.target.value)} /></Field>
      <Field label="Monthly contribution"><input type="number" min="0" step="0.01" value={form.monthly} onChange={e => patch('monthly', e.target.value)} /></Field>
      <Field label="Target date"><input type="date" value={form.targetDate} onChange={e => patch('targetDate', e.target.value)} /></Field>
      <Field label="Status"><select value={form.status} onChange={e => patch('status', e.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></Field>
    </div>
    <div className="mt-5 flex gap-2">{onDelete && <button disabled={saving} onClick={onDelete} className="grid h-11 w-11 place-items-center rounded-xl border border-red-500/20 text-red-400"><Trash2 size={14} /></button>}<button disabled={saving || form.name.trim().length < 2 || !form.target} onClick={onSave} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-black disabled:opacity-40">{saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save goal</button></div>
  </motion.section>;
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  return <label className="space-y-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/35">{label}<span className="block [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-white/8 [&>*]:bg-white/[.04] [&>*]:px-3 [&>*]:py-2.5 [&>*]:text-xs [&>*]:font-normal [&>*]:normal-case [&>*]:tracking-normal [&>*]:text-foreground/75 [&>*]:outline-none">{children}</span></label>;
}
