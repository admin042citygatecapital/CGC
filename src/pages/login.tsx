import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, Eye, EyeOff, AlertCircle, CheckCircle, Mail, Lock } from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import CgcLogo from '@/components/CgcLogo';

export default function LoginPage() {
  const { login, customer, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');
  const [busy,     setBusy]     = useState(false);

  // Already logged in → go to dashboard
  useEffect(() => {
    if (!loading && customer) navigate('/dashboard', { replace: true });
  }, [customer, loading, navigate]);

  // Show contextual messages from query params
  useEffect(() => {
    const v = params.get('verified');
    if (v === 'success') setInfo('Email verified! You can now log in.');
    else if (v === 'already') setInfo('Email already verified. Please log in.');
    else if (v === 'error') setError('Email verification failed. Please request a new link.');
    const reason = params.get('reason');
    if (reason === 'session_expired') setInfo('Your session expired. Please log in again.');
    const reset = params.get('reset');
    if (reset === 'success') setInfo('Password updated successfully. You can now log in with your new password.');
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setBusy(true);
    const result = await login(email, password);
    setBusy(false);
    if (result.ok) {
      navigate('/dashboard', { replace: true });
    } else {
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email address first. Check your inbox for the verification link.');
      } else if (result.code === 'PENDING_KYC') {
        setError('Your account is pending identity verification. Please complete KYC to continue.');
      } else if (result.code === 'PENDING_APPROVAL') {
        setError('Your account is awaiting admin approval. You will be notified by email.');
      } else if (result.code === 'SUSPENDED') {
        setError('Your account has been suspended. Please contact support.');
      } else {
        setError(result.error ?? 'Login failed. Please try again.');
      }
    }
  }

  return (
    <>
      <Helmet>
        <title>Log In — City Gate Capital</title>
        <meta name="description" content="Log in to your City Gate Capital account to access your dashboard, wallets, and transfers." />
        <link rel="canonical" href="https://citygate.capital/login" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-background">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #C9A84C 0%, transparent 70%)' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' as const }}
          className="relative w-full max-w-md"
        >
          {/* Card */}
          <div className="rounded-3xl border border-primary/20 p-8 md:p-10"
            style={{ background: 'linear-gradient(160deg, #111 0%, #0A0A0A 100%)' }}>

            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <CgcLogo size={40} withWordmark glow />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
            <p className="text-sm text-foreground/50 mb-8">Log in to your banking dashboard</p>

            {/* Info banner */}
            {info && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <CheckCircle size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-300">{info}</p>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-xs text-primary/70 hover:text-primary transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={busy}
                className="relative mt-2 w-full py-3.5 rounded-xl text-sm font-bold text-black overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn size={15} />
                    Log In
                  </span>
                )}
              </button>
            </form>

            {/* Register link */}
            <p className="mt-6 text-center text-sm text-foreground/40">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
                Open an account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
