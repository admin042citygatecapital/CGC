/**
 * /reset-password — Customer password reset confirmation page.
 * Reads ?token= from the URL, validates it, and sets a new password.
 * Completely isolated from admin auth.
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import {
  AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff, Lock, ShieldAlert,
} from 'lucide-react';
import CgcLogo from '@/components/CgcLogo';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter',       ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',       ok: /[a-z]/.test(password) },
    { label: 'Number',                 ok: /\d/.test(password) },
    { label: 'Special character',      ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const label = score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : score === 4 ? 'Good' : 'Strong';
  const colour = score <= 1 ? 'bg-destructive' : score <= 3 ? 'bg-yellow-500' : score === 4 ? 'bg-blue-500' : 'bg-green-500';

  if (!password) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colour : 'bg-border'}`} />
        ))}
        <span className="text-xs text-muted-foreground ml-1">{label}</span>
      </div>
      <ul className="space-y-0.5">
        {checks.map(c => (
          <li key={c.label} className={`text-xs flex items-center gap-1.5 ${c.ok ? 'text-green-500' : 'text-muted-foreground'}`}>
            <span>{c.ok ? '✓' : '○'}</span>{c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token') ?? '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [showCf,    setShowCf]    = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);
  const [countdown, setCountdown] = useState(5);

  // No token → redirect immediately
  useEffect(() => {
    if (!token) navigate('/forgot-password', { replace: true });
  }, [token, navigate]);

  // After success, count down and redirect to login
  useEffect(() => {
    if (!done) return;
    if (countdown <= 0) { navigate('/login?reset=success', { replace: true }); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [done, countdown, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.'); return;
    }
    setBusy(true);
    try {
      const res  = await fetch('/api/users/password-reset/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Reset failed. The link may have expired.');
      } else {
        setDone(true);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  return (
    <>
      <Helmet>
        <title>Reset Password — City Gate Capital</title>
        <meta name="description" content="Set a new password for your City Gate Capital account." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/reset-password" />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        {/* Background glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link to="/"><CgcLogo size={48} glow /></Link>
          </div>

          <div className="bg-card border border-border/40 rounded-2xl p-8 shadow-2xl">
            {done ? (
              /* ── Success state ── */
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Password updated</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your password has been changed successfully. You can now log in with your new credentials.
                </p>
                <p className="text-muted-foreground text-xs">
                  Redirecting to login in <strong className="text-foreground">{countdown}s</strong>…
                </p>
                <Link
                  to="/login?reset=success"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go to login now
                </Link>
              </div>
            ) : (
              /* ── Reset form ── */
              <>
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Lock className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
                  <p className="text-muted-foreground text-sm mt-2">
                    Choose a strong password for your account.
                  </p>
                </div>

                {error && (
                  <div id="password-reset-error" role="alert" className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
                    <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-foreground text-sm font-medium">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPw ? 'text' : 'password'}
                        required
                        minLength={8}
                        maxLength={256}
                        autoComplete="new-password"
                        aria-describedby={error ? 'password-reset-error' : undefined}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={busy}
                        className="bg-background/50 border-border/60 focus:border-primary pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={password} />
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm" className="text-foreground text-sm font-medium">
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm"
                        name="confirmPassword"
                        type={showCf ? 'text' : 'password'}
                        required
                        minLength={8}
                        maxLength={256}
                        autoComplete="new-password"
                        aria-describedby={error ? 'password-reset-error' : undefined}
                        placeholder="Repeat your password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        disabled={busy}
                        className={`bg-background/50 border-border/60 focus:border-primary pr-10 ${
                          confirm && confirm !== password ? 'border-destructive' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCf(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showCf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Passwords do not match
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={busy || !password || !confirm || password !== confirm}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    {busy ? 'Updating…' : 'Update password'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to login
                  </Link>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            Reset links are single-use and expire after 1 hour.
          </p>
        </div>
      </div>
    </>
  );
}
