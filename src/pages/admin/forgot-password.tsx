import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Shield, AlertCircle, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import CgcLogo from '@/components/CgcLogo';

type Step = 'form' | 'sent';

export default function AdminForgotPasswordPage() {
  const [step, setStep]     = useState<Step>('form');
  const [email, setEmail]   = useState('admin@citygate.capital');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      // Always show the "sent" step — the API never reveals whether the
      // email exists (anti-enumeration). Even on network error we show it
      // to avoid leaking information.
      if (!res.ok && res.status === 429) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Too many requests. Please wait before trying again.');
        setLoading(false);
        return;
      }

      setStep('sent');
    } catch {
      // Network error — still show generic success to prevent enumeration
      setStep('sent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Admin Password Reset — City Gate Capital</title>
        <meta name="description" content="Reset your City Gate Capital admin account password." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/forgot-password" />
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
              <CgcLogo size={56} withWordmark glow />
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

              {/* ── Request form ── */}
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
                      <Mail size={17} className="text-primary" />
                    </div>
                    <div>
                      <h1 className="text-white font-bold text-lg leading-tight">Reset Admin Password</h1>
                      <p className="text-white/30 text-xs mt-0.5">Enter your admin email to receive a reset link</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="admin-reset-email" className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        Admin Email Address
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          id="admin-reset-email"
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/15 focus:outline-none focus:border-primary/40 transition-colors text-sm"
                          placeholder="admin@citygate.capital"
                        />
                      </div>
                    </div>

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
                      disabled={loading}
                      className="w-full relative py-3.5 rounded-xl font-bold text-black overflow-hidden disabled:opacity-50 transition-opacity mt-2"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#C9A84C] to-[#F0D080]" />
                      <span className="relative flex items-center justify-center gap-2 text-sm">
                        {loading
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Shield size={15} />}
                        {loading ? 'Sending...' : 'Send Reset Link'}
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

              {/* ── Sent confirmation ── */}
              {step === 'sent' && (
                <motion.div
                  key="sent"
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
                      Check Your Inbox
                    </h2>
                    <p className="text-white/45 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
                      If that email is registered, a secure reset link has been sent.
                      The link expires in <span className="text-white/70">45 minutes</span> and can only be used once.
                    </p>
                    <p className="text-white/25 text-xs mb-6">
                      Didn't receive it? Check your spam folder or request again in a few minutes.
                    </p>
                  </motion.div>

                  <Link
                    to="/admin/login"
                    className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    <ArrowLeft size={12} />
                    Back to Admin Login
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
