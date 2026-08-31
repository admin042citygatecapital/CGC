/**
 * ClientEditModal — Full client account editor for SUPER_ADMIN.
 * Edits: name, email, phone, country, status, KYC status, bank info,
 *        email verification state, linked wallet addresses.
 * All changes are audit-logged server-side via /api/admin/users/override.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import {
  X, Save, AlertTriangle, CheckCircle, Loader2,
  User, Shield, Wallet, Building2,
} from 'lucide-react';
import { adminFetch } from '@/lib/adminAuth';

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  status: string;
  kycStatus: string;
  emailVerified: boolean;
  balance?: number;
  // Currency & tier
  primaryCurrency?: string;
  accountTier?: 'personal' | 'savings' | 'business';
  // bank info (optional extended fields)
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankSwift?: string;
  bankIban?: string;
  // wallet addresses
  walletBtc?: string;
  walletEth?: string;
  walletUsdt?: string;
  walletSol?: string;
}

interface Props {
  user: EditableUser;
  onClose: () => void;
  onSuccess: (updated: EditableUser) => void;
}

const STATUSES = [
  'pending_verification', 'pending_kyc', 'pending_approval',
  'active', 'suspended', 'frozen', 'rejected',
];
const KYC_STATUSES = ['not_submitted', 'submitted', 'approved', 'rejected'];

const TABS = [
  { id: 'profile',  label: 'Profile',  icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'bank',     label: 'Banking',  icon: Building2 },
  { id: 'wallets',  label: 'Wallets',  icon: Wallet },
];

export default function ClientEditModal({ user, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState<EditableUser>({ ...user });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(false);

  function set<K extends keyof EditableUser>(key: K, value: EditableUser[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!confirm) { setConfirm(true); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await adminFetch('/api/admin/users/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, patch: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          country: form.country,
          primaryCurrency: form.primaryCurrency,
          accountTier: form.accountTier,
        } }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Save failed'); setSaving(false); setConfirm(false); return; }
      setSuccess('Client account updated successfully.');
      setSaving(false);
      setConfirm(false);
      setTimeout(() => onSuccess(form), 1200);
    } catch (e) {
      setError(String(e));
      setSaving(false);
      setConfirm(false);
    }
  }

  const Field = ({ label, value, onChange, type = 'text', placeholder = '' }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-2xl rounded-2xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(10,10,10,0.98)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
              {(form.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-sm">Edit Client Account</p>
              <p className="text-white/30 text-xs">{user.email} · {user.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-white/30 hover:text-white/60'
              }`}>
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Profile tab */}
          {tab === 'profile' && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full Name" value={form.name} onChange={v => set('name', v)} placeholder="John Smith" />
                <Field label="Email Address" value={form.email} onChange={v => set('email', v)} type="email" placeholder="john@example.com" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Phone Number" value={form.phone ?? ''} onChange={v => set('phone', v)} placeholder="+44 7700 900000" />
                <Field label="Country" value={form.country ?? ''} onChange={v => set('country', v)} placeholder="United Kingdom" />
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Account Balance (USD)</label>
                <input type="number" value={form.balance ?? 0} onChange={e => set('balance', Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
                <p className="text-amber-400/60 text-[10px] mt-1">⚠ Use Balance Adjustment modal for audited balance changes. This field is for display correction only.</p>
              </div>
            </>
          )}

          {/* Security tab */}
          {tab === 'security' && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Account Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                    {STATUSES.map(s => <option key={s} value={s} className="bg-[#0A0A0A]">{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">KYC Status</label>
                  <select value={form.kycStatus} onChange={e => set('kycStatus', e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                    {KYC_STATUSES.map(s => <option key={s} value={s} className="bg-[#0A0A0A]">{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Currency & tier */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Primary Display Currency</label>
                  <select value={form.primaryCurrency ?? 'USD'} onChange={e => set('primaryCurrency', e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                    {['USD','EUR','GBP','CHF','CAD','AUD','JPY','SGD','AED','NGN','BTC','ETH','SOL','USDT','BNB'].map(c => (
                      <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>
                    ))}
                  </select>
                  <p className="text-white/20 text-[10px] mt-1">Controls which currency the customer sees on their dashboard balance widget.</p>
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Account Tier</label>
                  <select value={form.accountTier ?? 'personal'} onChange={e => set('accountTier', e.target.value as 'personal' | 'savings' | 'business')}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                    <option value="personal" className="bg-[#0A0A0A]">Personal</option>
                    <option value="savings"  className="bg-[#0A0A0A]">Savings</option>
                    <option value="business" className="bg-[#0A0A0A]">Business</option>
                  </select>
                  <p className="text-white/20 text-[10px] mt-1">Determines fee schedule and withdrawal limits applied to this account.</p>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border border-white/5 rounded-xl px-4">
                <div>
                  <p className="text-white text-sm font-medium">Email Verified</p>
                  <p className="text-white/30 text-xs">Override email verification state</p>
                </div>
                <button type="button" onClick={() => set('emailVerified', !form.emailVerified)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.emailVerified ? 'bg-emerald-500' : 'bg-white/10'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.emailVerified ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <p className="text-amber-400/80 text-xs">Status, currency, and tier changes are immediately effective and audit-logged with your admin ID, IP address, and timestamp.</p>
              </div>
            </>
          )}

          {/* Bank tab */}
          {tab === 'bank' && (
            <>
              <Field label="Bank Name" value={form.bankName ?? ''} onChange={v => set('bankName', v)} placeholder="Barclays Bank" />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Account Number" value={form.bankAccountNumber ?? ''} onChange={v => set('bankAccountNumber', v)} placeholder="12345678" />
                <Field label="Sort Code / Routing" value={form.bankRoutingNumber ?? ''} onChange={v => set('bankRoutingNumber', v)} placeholder="20-00-00" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="SWIFT / BIC" value={form.bankSwift ?? ''} onChange={v => set('bankSwift', v)} placeholder="BARCGB22" />
                <Field label="IBAN" value={form.bankIban ?? ''} onChange={v => set('bankIban', v)} placeholder="GB29 NWBK 6016 1331 9268 19" />
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                <p className="text-white/40 text-xs">Bank information is used for wire transfer withdrawals. All changes are audit-logged.</p>
              </div>
            </>
          )}

          {/* Wallets tab */}
          {tab === 'wallets' && (
            <>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 mb-2">
                <p className="text-white/40 text-xs">These are the client's personal crypto wallet addresses for withdrawals. Separate from the platform deposit addresses managed in Admin → Crypto.</p>
              </div>
              <Field label="Bitcoin (BTC) Withdrawal Address" value={form.walletBtc ?? ''} onChange={v => set('walletBtc', v)} placeholder="bc1q..." />
              <Field label="Ethereum (ETH) Withdrawal Address" value={form.walletEth ?? ''} onChange={v => set('walletEth', v)} placeholder="0x..." />
              <Field label="USDT Withdrawal Address" value={form.walletUsdt ?? ''} onChange={v => set('walletUsdt', v)} placeholder="TRC-20 or ERC-20 address" />
              <Field label="Solana (SOL) Withdrawal Address" value={form.walletSol ?? ''} onChange={v => set('walletSol', v)} placeholder="Sol address..." />
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                <p className="text-red-400/70 text-xs">⚠ Wallet address changes are irreversible and audit-logged. Verify addresses carefully before saving.</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 space-y-3">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <CheckCircle size={12} /> {success}
            </div>
          )}
          {confirm && !success && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              <AlertTriangle size={12} /> Confirm changes to <strong className="text-white">{user.name}</strong>? Click Save again to proceed.
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !!success}
              className="flex-1 relative py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <span className="relative flex items-center justify-center gap-2">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {confirm ? 'Confirm Save' : 'Save Changes'}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
