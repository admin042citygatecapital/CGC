import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Shield, AlertCircle, Loader2, CheckCircle, ArrowLeft, XCircle } from 'lucide-react';

type Step = 'form' | 'success' | 'invalid';

/** Minimal client-side policy check — server enforces the real policy. */
function checkPolicy(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 12)          issues.push('At least 12 characters');
  if (!/[A-Z]/.test(pw))       issues.push('One uppercase letter');
  if (!/[a-z]/.test(pw))       issues.push('One lowercase letter');
  if (!/[0-9]/.test(pw))       issues.push('One number');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('One special character');
  return issues;
}

export default function AdminResetPasswordPage() {
  const [searchParams]          = useSearchParams();
  const token                   = searchParams.get('token') ?? '';

  const [step, setStep]         = useState<Step>(token ? 'form' : 'invalid');
  const [newPw, setNewPw]       = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // If token is absent on mount, show invalid state immediately
  useEffect(() => {
    if (!token) setStep('invalid');
  }, [token]);

  const policyIssues = checkPolicy(newPw);
  const policyOk     = policyIssues.length === 0;
  const passwordsMatch = newPw === confirmPw && confirmPw.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!policyOk) {
      setError('Password does not meet the requirements below.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: newPw, confirmPassword: confirmPw }),
      });

      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Something went wrong. Please request a new reset link.');
        if (res.status === 400 && data.error?.toLowerCase().includes('invalid')) {
          setStep('invalid');
        }
        return;
      }

      setStep('success');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Set New Admin Password — City Gate Capital</title>
        <meta name="description" content="Set a new password for your City Gate Capital admin account." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/reset-password" />
      </Helmet>

      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">

        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] opacity-[0.07] blur-[140px]"
            style={{ background: 'radial-gradient(ellipse, #C9A84C, transparent)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-[400px] h-[300px] opacity-[0.04] blur-[100px]"
            style={{ background: 'radial-gradient(ellipse, #4c6dc9, transparent)' }}
          />
        </div>

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' as const }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="relative shrink-0">
                <div
                  className="absolute inset-0 rounded-full blur-xl opacity-40"
                  style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)' }}
                />
                <img
                  src="/assets/IMG-20260519-WA0000.jpg"
                  alt="City Gate Capital"
                  width={56}
                  height={56}
                  className="relative h-14 w-auto object-contain shrink-0"
                  style={{ filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.5))' }}
                />
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-lg leading-none" style={{ fontFamily: 'var(--font-heading)' }}>City Gate</p>
                <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: '#C9A84C' }}>Capital</p>
              </div>
            </div>
            <p className="text-white/25 text-sm tracking-wide">Super Admin Control Panel</p>
          </div>

          {/* Card */}
          <div
            className="rounded-3xl border border-white/[0.07] p-8"
            style={{
              background: 'rgba(255,255,255,0.025)',
              backdropFilter: 'blur(32px)',
              boxShadow: '0 0 80px rgba(201,168,76,0.06), 0 40px 80px rgba(0,0,0,0.5)',
            }}
          >
            <AnimatePresence mode="wait">

              {/* ── Invalid / expired token ── */}
              {step === 'invalid' && (
                <motion.div
                  key="invalid"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-6"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.25)',
                    }}
                  >
                    <XCircle size={36} className="text-red-400" />
                  </div>
                  <h2 className="text-white font-bold text-xl mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
                    Link Invalid or Expired
                  </h2>
                  <p className="text-white/45 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
                    This reset link is invalid, has already been used, or has expired (links are valid for 45 minutes).
                  </p>
                  <Link
                    to="/admin/forgot-password"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
                  >
                    Request a New Link
                  </Link>
                  <div className="mt-4">
                    <Link
                      to="/admin/login"
                      className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                      <ArrowLeft size={12} />
                      Back to Admin Login
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ── New password form ── */}
              {step === 'form' && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3 mb-7">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}
                    >
                      <Lock size={17} className="text-primary" />
                    </div>
                    <div>
                      <h1 className="text-white font-bold text-lg leading-tight">Set New Password</h1>
                      <p className="text-white/30 text-xs mt-0.5">Choose a strong password for your admin account</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* New password */}
                    <div>
                      <label className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          type={showNew ? 'text' : 'password'}
                          required
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-white placeholder:text-white/15 focus:outline-none focus:border-primary/40 transition-colors text-sm"
                          placeholder="••••••••••••"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                        >
                          {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          required
                          value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          className={`w-full bg-white/[0.04] border rounded-xl pl-10 pr-10 py-3 text-white placeholder:text-white/15 focus:outline-none transition-colors text-sm ${
                            confirmPw && !passwordsMatch
                              ? 'border-red-500/40 focus:border-red-500/60'
                              : confirmPw && passwordsMatch
                              ? 'border-emerald-500/40 focus:border-emerald-500/60'
                              : 'border-white/[0.08] focus:border-primary/40'
                          }`}
                          placeholder="••••••••••••"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                        >
                          {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Password policy checklist */}
                    {newPw.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-3 rounded-xl border border-white/[0.06] space-y-1.5"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Password requirements</p>
                        {[
                          { label: 'At least 12 characters',   ok: newPw.length >= 12 },
                          { label: 'One uppercase letter',      ok: /[A-Z]/.test(newPw) },
                          { label: 'One lowercase letter',      ok: /[a-z]/.test(newPw) },
                          { label: 'One number',                ok: /[0-9]/.test(newPw) },
                          { label: 'One special character',     ok: /[^A-Za-z0-9]/.test(newPw) },
                        ].map(({ label, ok }) => (
                          <div key={label} className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                              {ok
                                ? <CheckCircle size={9} className="text-emerald-400" />
                                : <div className="w-1 h-1 rounded-full bg-white/20" />}
                            </div>
                            <span className={`text-xs ${ok ? 'text-emerald-400' : 'text-white/30'}`}>{label}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm"
                        >
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <span>{error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={loading || !policyOk || !passwordsMatch}
                      className="w-full relative py-3.5 rounded-xl font-bold text-black overflow-hidden disabled:opacity-40 transition-opacity mt-2"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#C9A84C] to-[#F0D080]" />
                      <span className="relative flex items-center justify-center gap-2 text-sm">
                        {loading
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Shield size={15} />}
                        {loading ? 'Updating Password...' : 'Set New Password'}
                      </span>
                    </button>
                  </form>

                  <div className="mt-5 text-center">
                    <Link
                      to="/admin/login"
                      className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                      <ArrowLeft size={12} />
                      Back to Admin Login
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ── Success ── */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-6"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 14 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{
                      background: 'rgba(201,168,76,0.12)',
                      border: '1px solid rgba(201,168,76,0.3)',
                      boxShadow: '0 0 40px rgba(201,168,76,0.15)',
                    }}
                  >
                    <CheckCircle size={36} className="text-primary" />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <h2 className="text-white font-bold text-xl mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
                      Password Updated
                    </h2>
                    <p className="text-white/45 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
                      Your admin password has been changed and all existing sessions have been signed out.
                      Please log in with your new password.
                    </p>
                  </motion.div>

                  <Link
                    to="/admin/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
                  >
                    <Shield size={14} />
                    Go to Admin Login
                  </Link>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Security badges */}
          <div className="flex items-center justify-center gap-5 mt-6">
            {['256-bit AES', 'HTTPS Secure', 'Audit Logged', 'IP Tracked'].map(badge => (
              <div key={badge} className="flex items-center gap-1.5 text-[10px] text-white/15">
                <Shield size={9} className="text-primary/30" />
                {badge}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}
