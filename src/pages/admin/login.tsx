import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Shield, Lock, Mail, AlertCircle, Loader2, CheckCircle, Clock, RefreshCw,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';
import CgcLogo from '@/components/CgcLogo';

type Step = 'credentials' | 'otp' | 'success';

const DEFAULT_OTP_TTL_SECONDS = 60;
const RESEND_COOLDOWN_SECONDS = 15;

export default function AdminLoginPage() {
  const { login, verifyOtp, resendOtp } = useAdminAuth();
  const navigate   = useNavigate();

  const [step, setStep]         = useState<Step>('credentials');
  const [email, setEmail]       = useState('admin@citygate.capital');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [otp, setOtp] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [otpDeliveryMode, setOtpDeliveryMode] = useState<'email' | 'local'>('email');
  const [otpSecondsRemaining, setOtpSecondsRemaining] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [otpNotice, setOtpNotice] = useState('');

  useEffect(() => {
    if (step !== 'otp') return undefined;

    const interval = window.setInterval(() => {
      setOtpSecondsRemaining(current => Math.max(0, current - 1));
      setResendCooldown(current => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [step]);

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

    if (result.otpRequired && result.challengeId) {
      const ttl = Math.max(1, result.expiresInSeconds ?? DEFAULT_OTP_TTL_SECONDS);
      setChallengeId(result.challengeId);
      setOtpDeliveryMode(result.deliveryMode === 'local' ? 'local' : 'email');
      setOtpSecondsRemaining(ttl);
      setResendCooldown(Math.min(RESEND_COOLDOWN_SECONDS, ttl));
      setOtpNotice('');
      setStep('otp');
      return;
    }
    setStep('success');
    setTimeout(() => navigate('/admin'), 900);
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyOtp(challengeId, otp, rememberDevice);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      if (result.expired) setOtpSecondsRemaining(0);
      return;
    }
    setStep('success');
    setTimeout(() => navigate('/admin'), 900);
  }

  async function handleResend() {
    if (!challengeId || resendCooldown > 0 || resending) return;

    setError('');
    setOtpNotice('');
    setResending(true);
    const result = await resendOtp(challengeId);
    setResending(false);

    if (result.error || !result.challengeId) {
      setError(result.error ?? 'Unable to issue a new verification code.');
      if (result.expired) setOtpSecondsRemaining(0);
      return;
    }

    const ttl = Math.max(1, result.expiresInSeconds ?? DEFAULT_OTP_TTL_SECONDS);
    const deliveryMode = result.deliveryMode === 'local' ? 'local' : 'email';
    setChallengeId(result.challengeId);
    setOtp('');
    setOtpDeliveryMode(deliveryMode);
    setOtpSecondsRemaining(ttl);
    setResendCooldown(Math.min(RESEND_COOLDOWN_SECONDS, ttl));
    setOtpNotice(deliveryMode === 'local'
      ? 'The local verification challenge was refreshed.'
      : 'A new verification code was sent to the administrator email.');
  }

  return (
    <>
      <Helmet>
        <title>Admin Login — City Gate Capital</title>
        <meta name="description" content="Secure admin login for City Gate Capital staff." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/login" />
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
                      <label htmlFor="admin-email" className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          id="admin-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/15 focus:outline-none focus:border-primary/40 transition-colors text-sm"
                          placeholder="admin@citygate.capital"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="admin-password" className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          id="admin-password"
                          name="password"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-white placeholder:text-white/15 focus:outline-none focus:border-primary/40 transition-colors text-sm"
                          placeholder="••••••••••"
                        />
                        <button
                          type="button"
                          aria-label={showPw ? 'Hide password' : 'Show password'}
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

                    {/* Forgot password */}
                    <div className="text-center pt-1">
                      <Link
                        to="/admin/forgot-password"
                        className="text-xs text-white/25 hover:text-primary/70 transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </form>

                  {/* Security note */}
                  <div className="mt-5 p-3 rounded-xl border border-primary/10 bg-primary/[0.03]">
                    <p className="text-[11px] text-white/25 text-center">
                      Protected by HTTPS · Multi-factor verification · Session-bound · Audit logged
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Success step ── */}
              {step === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-3 mb-7">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
                      <Shield size={17} className="text-primary" />
                    </div>
                    <div>
                      <h1 className="text-white font-bold text-lg">Verify your login</h1>
                      <p className="text-white/30 text-xs mt-0.5">
                        {otpDeliveryMode === 'local'
                          ? 'Enter the six-digit code configured for this isolated local session.'
                          : 'Enter the six-digit code sent to the administrator email.'}
                      </p>
                    </div>
                  </div>
                  {otpDeliveryMode === 'local' && (
                    <div className="mb-4 p-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] text-amber-200/75 text-xs leading-relaxed">
                      Local verification mode is active. Email delivery is intentionally disabled for this isolated session.
                    </div>
                  )}
                  <div
                    className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                      otpSecondsRemaining > 0
                        ? 'border-white/[0.07] bg-white/[0.025] text-white/40'
                        : 'border-amber-400/20 bg-amber-400/[0.06] text-amber-200/75'
                    }`}
                    aria-live="polite"
                  >
                    <Clock size={13} className="shrink-0" />
                    <span>
                      {otpSecondsRemaining > 0
                        ? `Code expires in ${otpSecondsRemaining} second${otpSecondsRemaining === 1 ? '' : 's'}.`
                        : 'This code has expired. Request a new code to continue.'}
                    </span>
                  </div>
                  {otpNotice && (
                    <div
                      className="mb-4 p-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/75 text-xs"
                      role="status"
                    >
                      {otpNotice}
                    </div>
                  )}
                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="admin-otp" className="text-[11px] text-white/35 uppercase tracking-widest mb-2 block">
                        Verification code
                      </label>
                      <input
                        id="admin-otp"
                        name="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-center text-white text-xl tracking-[0.45em] font-mono focus:outline-none focus:border-primary/40"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-white/40">
                      <input name="rememberDevice" type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} />
                      Trust this device for 30 days
                    </label>
                    {error && <div className="p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm">{error}</div>}
                    <button
                      type="submit"
                      disabled={loading || resending || otp.length !== 6 || otpSecondsRemaining <= 0}
                      className="w-full py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-[#C9A84C] to-[#F0D080] disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify and continue'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading || resending || resendCooldown > 0}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs text-primary/70 hover:text-primary disabled:text-white/20 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                      {resending
                        ? 'Requesting a new code...'
                        : resendCooldown > 0
                          ? `Send a new code in ${resendCooldown}s`
                          : 'Send a new verification code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setOtp('');
                        setChallengeId('');
                        setOtpDeliveryMode('email');
                        setOtpSecondsRemaining(0);
                        setResendCooldown(0);
                        setOtpNotice('');
                        setError('');
                      }}
                      className="w-full text-xs text-white/30 hover:text-white/60"
                    >
                      Use different credentials
                    </button>
                  </form>
                </motion.div>
              )}

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
            {['HTTPS Secure', 'MFA Required', 'Audit Logged', 'IP Tracked'].map(badge => (
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
