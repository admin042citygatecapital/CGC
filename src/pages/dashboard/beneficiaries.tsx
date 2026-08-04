/**
 * /dashboard/beneficiaries — Saved Beneficiaries / Transfer Recipients
 * Manage saved recipients for fast transfers. Mirrors the real
 * beneficiaries.ts contract: type is 'bank' | 'crypto', bank beneficiaries
 * require bankName + accountNumber, crypto beneficiaries require asset +
 * walletAddress. Only cosmetic/contact fields are editable in place
 * (type/asset/walletAddress require delete + re-add — see
 * users/beneficiaries/update/POST.ts).
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Users, Plus, Trash2, Edit2, Send,
  Loader2, CheckCircle2, AlertTriangle, X,
  Building2, Bitcoin, Globe,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

type BeneficiaryType = 'bank' | 'crypto';

interface Beneficiary {
  id:             string;
  type:           BeneficiaryType;
  name:           string;
  nickname?:      string;
  currency?:      string;
  bankName?:      string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?:     string;
  asset?:         string;
  network?:       string;
  walletAddress?: string;
  createdAt:      string;
  updatedAt:      string;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SGD', 'AED'];
const ASSETS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'];
const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CHF: '🇨🇭', CAD: '🇨🇦',
  AUD: '🇦🇺', JPY: '🇯🇵', SGD: '🇸🇬', AED: '🇦🇪',
};

interface FormState {
  type: BeneficiaryType;
  name: string;
  nickname: string;
  currency: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  asset: string;
  network: string;
  walletAddress: string;
}

function BeneficiaryForm({
  initial, onSave, onCancel, saving,
}: {
  initial?: Beneficiary | null;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<FormState>({
    type:          initial?.type          ?? 'bank',
    name:          initial?.name          ?? '',
    nickname:      initial?.nickname      ?? '',
    currency:      initial?.currency      ?? 'USD',
    bankName:      initial?.bankName      ?? '',
    accountNumber: initial?.accountNumber ?? '',
    routingNumber: initial?.routingNumber ?? '',
    swiftCode:     initial?.swiftCode     ?? '',
    asset:         initial?.asset         ?? 'BTC',
    network:       initial?.network       ?? '',
    walletAddress: initial?.walletAddress ?? '',
  });

  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(f => ({ ...f, [k]: v })); }

  const valid = form.type === 'bank'
    ? !!form.name.trim() && !!form.bankName.trim() && !!form.accountNumber.trim()
    : !!form.name.trim() && !!form.asset.trim() && !!form.walletAddress.trim();

  function submit() {
    if (!valid) return;
    const base = { name: form.name.trim(), nickname: form.nickname.trim() || undefined, currency: form.currency };
    if (form.type === 'bank') {
      onSave({
        ...base, type: 'bank',
        bankName: form.bankName.trim(), accountNumber: form.accountNumber.trim(),
        routingNumber: form.routingNumber.trim() || undefined, swiftCode: form.swiftCode.trim() || undefined,
      });
    } else {
      onSave({
        ...base, type: 'crypto',
        asset: form.asset, walletAddress: form.walletAddress.trim(),
        network: form.network.trim() || undefined,
      });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground/80">{isEdit ? 'Edit Beneficiary' : 'Add Beneficiary'}</p>
        <button onClick={onCancel} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
          <X size={13} />
        </button>
      </div>

      {!isEdit && (
        <div className="flex gap-2">
          {(['bank', 'crypto'] as const).map(t => (
            <button key={t} onClick={() => set('type', t)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all capitalize"
              style={{
                background: form.type === t ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
                color: form.type === t ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${form.type === t ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.07)'}`,
              }}>
              {t === 'bank' ? <Building2 size={12} /> : <Bitcoin size={12} />}
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="text-[10px] text-foreground/40 font-medium">Full Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Recipient name"
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="text-[10px] text-foreground/40 font-medium">Nickname (optional)</label>
          <input value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="e.g. Mum, Landlord"
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
        </div>

        {form.type === 'bank' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-foreground/40 font-medium">Bank Name *</label>
              <input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="e.g. Chase, Barclays"
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-foreground/40 font-medium">Account Number / IBAN *</label>
              <input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} placeholder="IBAN / account number"
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-foreground/40 font-medium">Routing Number</label>
              <input value={form.routingNumber} onChange={e => set('routingNumber', e.target.value)} placeholder="Routing / sort code"
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-foreground/40 font-medium">SWIFT Code</label>
              <input value={form.swiftCode} onChange={e => set('swiftCode', e.target.value)} placeholder="SWIFT / BIC"
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-foreground/40 font-medium">Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 focus:outline-none cursor-pointer appearance-none">
                {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a' }}>{CURRENCY_FLAGS[c] ?? ''} {c}</option>)}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-foreground/40 font-medium">Asset *</label>
              <select value={form.asset} onChange={e => set('asset', e.target.value)} disabled={isEdit}
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 focus:outline-none cursor-pointer appearance-none disabled:opacity-50">
                {ASSETS.map(a => <option key={a} value={a} style={{ background: '#0a0a0a' }}>{a}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-foreground/40 font-medium">Network</label>
              <input value={form.network} onChange={e => set('network', e.target.value)} placeholder="e.g. ERC20, TRC20"
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[10px] text-foreground/40 font-medium">Wallet Address *</label>
              <input value={form.walletAddress} onChange={e => set('walletAddress', e.target.value)} placeholder="Wallet address" disabled={isEdit}
                className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors disabled:opacity-50 font-mono" />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-foreground/40 border border-white/8 hover:bg-white/4 transition-colors">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || !valid}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', color: '#000' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          {isEdit ? 'Save Changes' : 'Add Beneficiary'}
        </button>
      </div>
    </div>
  );
}

export default function BeneficiariesPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    fetch('/api/users/beneficiaries', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.beneficiaries) setBeneficiaries(data.beneficiaries); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token]);

  async function handleSave(data: Record<string, unknown>) {
    if (!token) return;
    setSaving(true);
    setMsg(null);
    try {
      const url = editing ? '/api/users/beneficiaries/update' : '/api/users/beneficiaries/add';
      const body = editing ? { ...data, id: editing.id } : data;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (editing && json.beneficiary) {
          setBeneficiaries(prev => prev.map(b => b.id === editing.id ? json.beneficiary : b));
          setMsg({ text: 'Beneficiary updated.', ok: true });
        } else if (json.beneficiary) {
          setBeneficiaries(prev => [json.beneficiary, ...prev]);
          setMsg({ text: 'Beneficiary added.', ok: true });
        }
        setShowForm(false);
        setEditing(null);
      } else {
        setMsg({ text: json.error ?? 'Failed to save beneficiary.', ok: false });
      }
    } catch {
      setMsg({ text: 'Network error. Please try again.', ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || deletingId) return;
    setDeletingId(id);
    setMsg(null);
    try {
      const res = await fetch('/api/users/beneficiaries/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setBeneficiaries(prev => prev.filter(b => b.id !== id));
        setMsg({ text: 'Beneficiary removed.', ok: true });
      } else {
        setMsg({ text: 'Failed to remove beneficiary.', ok: false });
      }
    } catch {
      setMsg({ text: 'Network error.', ok: false });
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = beneficiaries.filter(b =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.bankName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (b.asset ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>Beneficiaries — City Gate Capital</title>
        <meta name="description" content="Manage your saved transfer recipients at City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/beneficiaries" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <h1 className="sr-only">Beneficiaries</h1>
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/dashboard"
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2">
              <Users size={15} style={{ color: '#C9A84C' }} />
              <span className="text-sm font-semibold text-foreground">Beneficiaries</span>
            </div>
            <button
              onClick={() => { setShowForm(true); setEditing(null); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.22)' }}>
              <Plus size={12} /> Add
            </button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

          <AnimatePresence>
            {msg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs ${msg.ok ? 'border-emerald-500/20 bg-emerald-500/6 text-emerald-400' : 'border-red-500/20 bg-red-500/6 text-red-400'}`}>
                {msg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {msg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(showForm || editing) && (
              <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <BeneficiaryForm
                  initial={editing}
                  onSave={handleSave}
                  onCancel={() => { setShowForm(false); setEditing(null); }}
                  saving={saving}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {beneficiaries.length > 3 && (
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search beneficiaries…"
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-xs text-foreground/70 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors"
            />
          )}

          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-foreground/20" />
            </div>
          ) : filtered.length === 0 && !showForm ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
                <Users size={22} className="text-foreground/20" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/50">No beneficiaries yet</p>
                <p className="text-xs text-foreground/25 mt-1">Save recipients for faster transfers</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.22)' }}>
                <Plus size={13} /> Add First Beneficiary
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(b => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-white/6"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                    {b.type === 'crypto' ? <Bitcoin size={16} /> : b.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground/80 truncate">{b.nickname || b.name}</p>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                        {b.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {b.type === 'bank' ? (
                        <>
                          {b.currency && <span className="text-[10px] text-foreground/40">{CURRENCY_FLAGS[b.currency] ?? ''} {b.currency}</span>}
                          {b.bankName && <span className="text-[10px] text-foreground/25">· {b.bankName}</span>}
                          {b.accountNumber && <span className="text-[10px] text-foreground/20 font-mono">···{b.accountNumber.slice(-4)}</span>}
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-foreground/40">{b.asset}</span>
                          {b.network && <span className="text-[10px] text-foreground/25">· {b.network}</span>}
                          {b.walletAddress && <span className="text-[10px] text-foreground/20 font-mono">{b.walletAddress.slice(0, 6)}···{b.walletAddress.slice(-4)}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      to={`/dashboard/transfers?beneficiary=${b.id}`}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/8"
                      style={{ color: '#C9A84C' }}
                      title="Send to this beneficiary">
                      <Send size={13} />
                    </Link>
                    <button
                      onClick={() => { setEditing(b); setShowForm(false); }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-foreground/30 hover:text-foreground/70 hover:bg-white/5 transition-colors"
                      title="Edit">
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      disabled={!!deletingId}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/8 transition-colors disabled:opacity-40"
                      title="Remove">
                      {deletingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
            <Globe size={13} className="text-foreground/20 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/25 leading-relaxed">
              Saved beneficiaries are used to speed up future transfers. Account numbers are masked in the display.
            </p>
          </div>

          <Link to="/dashboard"
            className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors w-fit">
            <ArrowLeft size={12} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
