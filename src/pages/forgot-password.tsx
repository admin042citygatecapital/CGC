/**
 * /forgot-password — Customer password reset request page.
 * Completely isolated from admin auth. Uses /api/users/password-reset.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const res  = await fetch('/api/users/password-reset', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Forgot Password — City Gate Capital</title>
        <meta name="description" content="Reset your City Gate Capital account password securely." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        {/* Background glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link to="/">
              <img
                src="/assets/IMG-20260519-WA0000.jpg"
                alt="City Gate Capital"
                className="h-12 w-auto object-contain"
              />
            </Link>
          </div>

          <div className="bg-card border border-border/40 rounded-2xl p-8 shadow-2xl">
            {sent ? (
              /* ── Success state ── */
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  If an account with that address exists, we've sent a password reset link.
                  The link expires in <strong className="text-foreground">1 hour</strong>.
                </p>
                <p className="text-muted-foreground text-xs">
                  Didn't receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => { setSent(false); setEmail(''); }}
                    className="text-primary hover:underline"
                  >
                    try again
                  </button>.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>
              </div>
            ) : (
              /* ── Request form ── */
              <>
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Forgot your password?</h1>
                  <p className="text-muted-foreground text-sm mt-2">
                    Enter your registered email and we'll send you a secure reset link.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-foreground text-sm font-medium">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={busy}
                      className="bg-background/50 border-border/60 focus:border-primary"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy || !email.trim()}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    {busy ? 'Sending…' : 'Send reset link'}
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

          {/* Security notice */}
          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            For your security, reset links expire after 1 hour and can only be used once.
          </p>
        </div>
      </div>
    </>
  );
}
