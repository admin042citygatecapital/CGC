import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Shield, Lock, Mail, AlertCircle, Loader2, CheckCircle,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';

type Step = 'credentials' | 'success';

export default function AdminLoginPage() {
  const { login }  = useAdminAuth();
  const navigate   = useNavigate();

  const [step, setStep]         = useState<Step>('credentials');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStep('success');
    setTimeout(() => navigate('/admin'), 900);
  }

  return (
    <>
      <Helmet>
        <title>Admin Login — City Gate Capital</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">

        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] opacity-[0.08] blur-[140px]"
            style={{ background: 'radial-gradient(ellipse, #C9A84C, transparent)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-[400px] h-[300px] opacity-[0.04] blur-[100px]"
            style={{ background: 'radial-gradient(ellipse, #4c6dc9, transparent)' }}
          />
          <div
            className="absolute top-0 right-0 w-[300px] h-[200px] opacity-[0.03] blur-[80px]"
            style={{ background: 'radial-gradient(ellipse, #C9A84C, transparent)' }}
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
                <p className="text-white font-bold text-lg leading-none" style={{ fontFamily: 'var(--font-heading)' }}>
                  City Gate
                </p>
                <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: '#C9A84C' }}>
                  Capital
                </p>
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

              {/* ── Credentials step ── */}
              {step === 'credentials' && (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-7">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}
                    >
                      <Lock size={17} className="text-primary" />
                    </div>
                    <div>
                      <h1 className="text-white font-bold text-lg leading-tight">Secure Login</h1>
                      <p className="text-white/30 text-xs mt-0.5">Enter your admin credentials</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email */}
                    <div>
                      <label className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/15 focus:outline-none focus:border-primary/40 transition-colors text-sm"
                          placeholder="Admin email address"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          type={showPw ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-white placeholder:text-white/15 focus:outline-none focus:border-primary/40 transition-colors text-sm"
                          placeholder="••••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                        >
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

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

                    {/* Submit */}
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
                        {loading ? 'Authenticating...' : 'Access Admin Panel'}
                      </span>
                    </button>
                  </form>

                  {/* Security note */}
                  <div className="mt-5 p-3 rounded-xl border border-primary/10 bg-primary/[0.03]">
                    <p className="text-[11px] text-white/25 text-center">
                      Protected by AES-256 encryption · Session-bound · Audit logged
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Success step ── */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-8"
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
                    <h2 className="text-white font-bold text-2xl mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                      Access Granted
                    </h2>
                    <p className="text-white/40 text-sm mb-6">
                      Welcome back. Loading your dashboard...
                    </p>
                  </motion.div>

                  {/* Animated progress bar */}
                  <motion.div
                    className="h-0.5 rounded-full mx-auto overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)', maxWidth: '200px' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #C9A84C, #F0D080)' }}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.85, ease: 'easeInOut' as const }}
                    />
                  </motion.div>
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
