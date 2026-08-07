/**
 * /dashboard/beneficiaries — Saved Beneficiaries / Transfer Recipients
 * Manage saved recipients for fast transfers.
 */
import { useCustomerAuth } from '@/lib/customerAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertTriangle,
ArrowLeft,
Building2,
CheckCircle2,
Edit2,
Globe,
Loader2,
Plus,
Send,
Trash2,
User,
Users,
X
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

interface Beneficiary {
  id:          string;
  name:        string;
  type:        'individual' | 'business';
  accountNumber?: string;
  bankName?:   string;
  bankCode?:   string;
  currency:    string;
  country:     string;
  email?:      string;
  reference?:  string;
  createdAt:   string;
}

const CURRENCIES = ['USD','EUR','GBP','NGN','AED','CAD','AUD','CHF','JPY','SGD'];
const COUNTRIES  = ['United States','United Kingdom','Nigeria','UAE','Canada','Australia','Germany','France','Singapore','Japan'];

const CURRENCY_FLAGS: Record<string, string> = {
  USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', NGN:'🇳🇬', AED:'🇦🇪',
  CAD:'🇨🇦', AUD:'🇦🇺', CHF:'🇨🇭', JPY:'🇯🇵', SGD:'🇸🇬',
};

function BeneficiaryForm({
  initial, onSave, onCancel, saving,
}: {
  initial?: Partial<Beneficiary>;
  onSave: (data: Omit<Beneficiary, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name:          initial?.name          ?? '',
    type:          initial?.type          ?? 'individual' as 'individual' | 'business',
    accountNumber: initial?.accountNumber ?? '',
    bankName:      initial?.bankName      ?? '',
    bankCode:      initial?.bankCode      ?? '',
    currency:      initial?.currency      ?? 'USD',
    country:       initial?.country       ?? 'United States',
    email:         initial?.email         ?? '',
    reference:     initial?.reference     ?? '',
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl border border-white/8"
      style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground/80">{initial?.id ? 'Edit Beneficiary' : 'Add Beneficiary'}</p>
        <button onClick={onCancel} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Type toggle */}
      <div className="flex gap-2">
        {(['individual', 'business'] as const).map(t => (
          <button key={t} onClick={() => set('type', t)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all capitalize"
            style={{
              background: form.type === t ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
              color: form.type === t ? '#C9A84C' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${form.type === t ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.07)'}`,
            }}>
            {t === 'individual' ? <User size={12} /> : <Building2 size={12} />}
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Full Name *', key: 'name', placeholder: form.type === 'business' ? 'Company name' : 'Recipient name' },
          { label: 'Account Number', key: 'accountNumber', placeholder: 'IBAN / account number' },
          { label: 'Bank Name', key: 'bankName', placeholder: 'e.g. Chase, Barclays' },
          { label: 'Bank Code / SWIFT', key: 'bankCode', placeholder: 'SWIFT / sort code' },
          { label: 'Email (optional)', key: 'email', placeholder: 'recipient@email.com' },
          { label: 'Reference', key: 'reference', placeholder: 'Payment reference' },
        ].map(f => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="text-[10px] text-foreground/40 font-medium">{f.label}</label>
            <input
              value={(form as Record<string, string>)[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        ))}

        {/* Currency */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-foreground/40 font-medium">Currency</label>
          <select value={form.currency} onChange={e => set('currency', e.target.value)}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 focus:outline-none cursor-pointer appearance-none">
            {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a' }}>{CURRENCY_FLAGS[c] ?? ''} {c}</option>)}
          </select>
        </div>

        {/* Country */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-foreground/40 font-medium">Country</label>
          <select value={form.country} onChange={e => set('country', e.target.value)}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground/80 focus:outline-none cursor-pointer appearance-none">
            {COUNTRIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a' }}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-foreground/40 border border-white/8 hover:bg-white/4 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => { if (form.name.trim()) onSave(form); }}
          disabled={saving || !form.name.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', color: '#000' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          {initial?.id ? 'Save Changes' : 'Add Beneficiary'}
        </button>
      </div>
    </div>
  );
}

export default function BeneficiariesPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [fetching,  setFetching]  = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Beneficiary | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [deletingId,setDeletingId]= useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null);

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

  async function handleSave(data: Omit<Beneficiary, 'id' | 'createdAt'>) {
    if (!token) return;
    setSaving(true);
    setMsg(null);
    try {
      const url    = editing ? '/api/users/beneficiaries/update' : '/api/users/beneficiaries/add';
      const body   = editing ? { ...data, id: editing.id } : data;
      const res    = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (editing) {
          setBeneficiaries(prev => prev.map(b => b.id === editing.id ? { ...b, ...data } : b));
          setMsg({ text: 'Beneficiary updated.', ok: true });
        } else {
          setBeneficiaries(prev => [json.beneficiary ?? { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...prev]);
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
    b.currency.toLowerCase().includes(search.toLowerCase())
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

          {/* Feedback */}
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

          {/* Add / edit form */}
          <AnimatePresence>
            {(showForm || editing) && (
              <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <BeneficiaryForm
                  initial={editing ?? undefined}
                  onSave={handleSave}
                  onCancel={() => { setShowForm(false); setEditing(null); }}
                  saving={saving}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search */}
          {beneficiaries.length > 3 && (
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search beneficiaries…"
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-xs text-foreground/70 placeholder-foreground/20 focus:outline-none focus:border-primary/40 transition-colors"
            />
          )}

          {/* List */}
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
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                    {b.type === 'business' ? <Building2 size={16} /> : b.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground/80 truncate">{b.name}</p>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                        {b.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-foreground/40">
                        {CURRENCY_FLAGS[b.currency] ?? ''} {b.currency}
                      </span>
                      {b.bankName && <span className="text-[10px] text-foreground/25">· {b.bankName}</span>}
                      {b.accountNumber && (
                        <span className="text-[10px] text-foreground/20 font-mono">
                          ···{b.accountNumber.slice(-4)}
                        </span>
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
                      {deletingId === b.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.015]">
            <Globe size={13} className="text-foreground/20 mt-0.5 shrink-0" />
            <p className="text-[10px] text-foreground/25 leading-relaxed">
              Saved beneficiaries are encrypted and stored securely. Account numbers are masked in the display.
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
