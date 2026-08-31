/**
 * /dashboard/profile — Customer profile management
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Camera,
  Save, Loader2, Check, AlertCircle, BadgeCheck, Clock, XCircle,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

export default function ProfilePage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();

  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [address, setAddress] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
    if (customer) {
      setName(customer.name ?? '');
      setPhone((customer as any).phone ?? '');
      setAddress((customer as any).address ?? '');
    }
  }, [customer, loading, navigate]);

  async function handleSave() {
    if (!token) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone, address }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Update failed'); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally { setSaving(false); }
  }

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const inputCls = "w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors";

  return (
    <>
      <Helmet>
        <title>My Profile — City Gate Capital</title>
        <meta name="description" content="Manage your City Gate Capital profile and personal information." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/profile" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-3xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5">
              <User size={16} style={{ color: '#C9A84C' }} />
              <h1 className="text-sm font-semibold text-foreground">My Profile</h1>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">

          {/* Avatar */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5 mb-6 p-5 rounded-2xl border border-white/6"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <label className="relative cursor-pointer group shrink-0">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                <span aria-hidden="true">{customer.name.charAt(0).toUpperCase()}</span>
                {customer.avatarUrl && (
                  <img
                    src={customer.avatarUrl}
                    alt={customer.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={14} className="text-white" />
              </div>
              <input name="profilePhoto" type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file || !token) return;
                  const reader = new FileReader();
                  reader.onload = async ev => {
                    const b64 = ev.target?.result as string;
                    await fetch('/api/users/avatar', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ avatarBase64: b64 }),
                    });
                    window.location.reload();
                  };
                  reader.readAsDataURL(file);
                }} />
            </label>
            <div>
              <p className="text-base font-semibold text-foreground">{customer.name}</p>
              <p className="text-xs text-foreground/40">{customer.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {customer.kycStatus === 'approved'
                  ? <span className="flex items-center gap-1 text-[10px] text-emerald-400"><BadgeCheck size={11} /> Verified</span>
                  : customer.kycStatus === 'submitted'
                  ? <span className="flex items-center gap-1 text-[10px] text-amber-400"><Clock size={11} /> Under review</span>
                  : <span className="flex items-center gap-1 text-[10px] text-red-400"><XCircle size={11} /> Unverified</span>}
                <span className="text-foreground/15">·</span>
                <span className="text-[10px] text-foreground/30 font-mono">#{customer.id.slice(-8).toUpperCase()}</span>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl border border-white/6 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-sm font-semibold text-foreground">Personal Information</p>
              <p className="text-xs text-foreground/35 mt-0.5">Update your profile details below</p>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              {saved && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  <Check size={13} /> Profile updated successfully
                </div>
              )}
              <div>
                <label htmlFor="profile-name" className="text-xs text-foreground/40 mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/25" />
                  <input id="profile-name" name="name" autoComplete="name" required className={`${inputCls} pl-9`} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
                </div>
              </div>
              <div>
                <label htmlFor="profile-email" className="text-xs text-foreground/40 mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/25" />
                  <input id="profile-email" name="email" type="email" autoComplete="email" className={`${inputCls} pl-9 opacity-50 cursor-not-allowed`} value={customer.email} disabled />
                </div>
                <p className="text-[10px] text-foreground/25 mt-1">Email cannot be changed. Contact support if needed.</p>
              </div>
              <div>
                <label htmlFor="profile-phone" className="text-xs text-foreground/40 mb-1.5 block">Phone Number</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/25" />
                  <input id="profile-phone" name="phone" type="tel" autoComplete="tel" className={`${inputCls} pl-9`} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
                </div>
              </div>
              <div>
                <label htmlFor="profile-address" className="text-xs text-foreground/40 mb-1.5 block">Address</label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3.5 top-3.5 text-foreground/25" />
                  <textarea id="profile-address" name="address" autoComplete="street-address" className={`${inputCls} pl-9 resize-none`} rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="Your address" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </motion.div>

          {/* KYC status */}
          {customer.kycStatus !== 'approved' && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="mt-4">
              <Link to="/kyc"
                className="flex items-center gap-3 p-4 rounded-2xl border transition-all hover:brightness-110"
                style={{ background: 'rgba(201,168,76,0.04)', borderColor: 'rgba(201,168,76,0.2)' }}>
                <BadgeCheck size={18} style={{ color: '#C9A84C' }} className="shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>Complete Identity Verification</p>
                  <p className="text-xs text-foreground/35 mt-0.5">Unlock full banking access by verifying your identity</p>
                </div>
              </Link>
            </motion.div>
          )}
        </main>
      </div>
    </>
  );
}
