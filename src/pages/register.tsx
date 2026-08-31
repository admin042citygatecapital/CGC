import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus, Eye, EyeOff, AlertCircle, CheckCircle, Mail, Lock, User, Phone, Globe, MapPin, Building2 } from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import CgcLogo from '@/components/CgcLogo';
import { getProductBySlug, isAccountPlanProduct, PRODUCT_CATALOGUE, type ProductCatalogueItem } from '@/lib/productCatalogue';
import { normalizeAccountPlans } from '@/lib/accountPlans';

const COUNTRIES = [
  'United Kingdom', 'United States', 'Canada', 'Australia', 'Germany',
  'France', 'Netherlands', 'Switzerland', 'Singapore', 'UAE',
  'South Africa', 'Nigeria', 'Kenya', 'India', 'Japan', 'Other',
];

export default function RegisterPage() {
  const { customer, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProduct = getProductBySlug(searchParams.get('product'))?.slug ?? 'personal-account';

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '', phone: '', country: '',
    address: '', city: '', postalCode: '', requestedProduct: initialProduct,
  });
  const [showPw,     setShowPw]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [applicationReference, setApplicationReference] = useState('');
  const [intakePosition, setIntakePosition] = useState<number | null>(null);
  const [selectedProductLabel, setSelectedProductLabel] = useState(getProductBySlug(initialProduct)?.label ?? 'selected service');
  const [registrationProducts, setRegistrationProducts] = useState<ProductCatalogueItem[]>(() => PRODUCT_CATALOGUE.map(product => ({ ...product })));
  const [busy,       setBusy]       = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  // Already logged in → go to dashboard
  useEffect(() => {
    if (!loading && customer) navigate('/dashboard', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    let active = true;
    fetch('/api/settings/website', { headers: { Accept: 'application/json' } })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (!active || !payload?.data?.accountPlans) return;
        const plans = normalizeAccountPlans(payload.data.accountPlans);
        const planById = new Map(plans.map(plan => [plan.id, plan]));
        const available = PRODUCT_CATALOGUE
          .filter(product => !isAccountPlanProduct(product) || planById.get(product.planId)?.visible)
          .map(product => isAccountPlanProduct(product)
            ? { ...product, label: `${planById.get(product.planId)?.name ?? product.label} Account Plan` }
            : { ...product });
        setRegistrationProducts(available);
        setForm(current => available.some(product => product.slug === current.requestedProduct)
          ? current
          : { ...current, requestedProduct: available[0]?.slug ?? 'personal-account' });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password || !form.phone || !form.country || !form.address || !form.city || !form.postalCode || !form.requestedProduct) {
      setError('Complete all required application fields.'); return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.'); return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (!legalAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy.'); return;
    }

    setBusy(true);
    try {
      const res  = await fetch('/api/users/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     form.name,
          email:    form.email,
          password: form.password,
          phone:    form.phone,
          country:  form.country,
          address:  form.address,
          city:     form.city,
          postalCode: form.postalCode,
          requestedProduct: form.requestedProduct,
          termsAccepted: legalAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.');
      } else {
        setApplicationReference(typeof data.applicationReference === 'string' ? data.applicationReference : '');
        setIntakePosition(typeof data.intakePosition === 'number' ? data.intakePosition : null);
        setSelectedProductLabel(typeof data.selectedProductLabel === 'string' ? data.selectedProductLabel : getProductBySlug(form.requestedProduct)?.label ?? 'selected service');
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <>
        <Helmet>
          <title>Check Your Email — City Gate Capital</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-background">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md rounded-3xl border border-primary/20 p-10 text-center"
            style={{ background: 'linear-gradient(160deg, #111 0%, #0A0A0A 100%)' }}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">Application received</h1>
            <p className="text-foreground/50 text-sm mb-6">
              We've sent a verification link to <span className="text-foreground font-medium">{form.email}</span>.
              Verify your email to continue the {selectedProductLabel} onboarding process.
            </p>
            {applicationReference && (
              <div className="mb-6 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-left">
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Application reference</p>{intakePosition && <span className="rounded-full border border-primary/20 px-2 py-0.5 text-[10px] text-primary">Intake #{intakePosition}</span>}</div>
                <p className="mt-1 break-all font-mono text-sm text-foreground">{applicationReference}</p>
                <p className="mt-2 text-xs leading-5 text-foreground/45">Your registration is saved in the secure application workflow. Verify your email, sign in, then continue each required step from Registration Progress.</p>
              </div>
            )}
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
            >
              Go to Login
            </Link>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Create a Platform Profile — City Gate Capital</title>
        <meta name="description" content="Create a secure City Gate Capital platform profile. Registration does not open a bank or payment account." />
        <link rel="canonical" href="https://citygate.capital/register" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-background">
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
          <div className="rounded-3xl border border-primary/20 p-8 md:p-10"
            style={{ background: 'linear-gradient(160deg, #111 0%, #0A0A0A 100%)' }}>

            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <CgcLogo size={40} withWordmark glow />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1">Start your application</h1>
            <p className="text-sm text-foreground/50 mb-8">Register your interest and create a secure platform profile. Account or service activation remains subject to eligibility, verification, and an approved provider.</p>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="requested-product" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Selected service</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                  <select id="requested-product" name="requestedProduct" value={form.requestedProduct} onChange={set('requestedProduct')} className="w-full pl-10 pr-4 py-3 rounded-xl bg-primary/[0.07] border border-primary/25 text-foreground text-sm focus:outline-none focus:border-primary/60 transition-colors appearance-none" required>
                    {registrationProducts.map(product => <option key={product.slug} value={product.slug}>{product.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Full name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Full name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    id="name" name="name" type="text" autoComplete="name" value={form.name} onChange={set('name')} required
                    placeholder="Jane Smith"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reg-email" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    id="reg-email" name="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              {/* Phone (optional) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Phone number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    id="phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')}
                    placeholder="+44 7700 900000"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              {/* Country */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="country" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Country of residence</label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
                  <select
                    id="country" name="country" value={form.country} onChange={set('country')} required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none"
                  >
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="address" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Residential or business address</label>
                <div className="relative"><MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30"/><input id="address" name="address" type="text" autoComplete="street-address" value={form.address} onChange={set('address')} placeholder="Street address" required className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors"/></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5"><label htmlFor="city" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">City</label><input id="city" name="city" type="text" autoComplete="address-level2" value={form.city} onChange={set('city')} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"/></div>
                <div className="flex flex-col gap-1.5"><label htmlFor="postal-code" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Postal code</label><input id="postal-code" name="postalCode" type="text" autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} required className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"/></div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reg-password" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    id="reg-password" name="password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required minLength={8}
                    value={form.password} onChange={set('password')} placeholder="Min. 8 characters"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm" className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Confirm password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                  <input
                    id="confirm" name="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required minLength={8}
                    value={form.confirm} onChange={set('confirm')} placeholder="Repeat password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-foreground/25 focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={busy}
                className="relative mt-2 w-full py-3.5 rounded-xl text-sm font-bold text-black overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus size={15} />
                    Submit Application
                  </span>
                )}
              </button>

              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-foreground/45">
                <input
                  type="checkbox"
                  name="legalAccepted"
                  checked={legalAccepted}
                  onChange={event => setLegalAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#C9A84C]"
                  required
                />
                <span>
                  I have read and accept the{' '}
                  <Link to="/terms-of-service" target="_blank" className="text-primary/70 hover:text-primary transition-colors">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy-policy" target="_blank" className="text-primary/70 hover:text-primary transition-colors">Privacy Policy</Link>.
                </span>
              </label>
            </form>

            <p className="mt-6 text-center text-sm text-foreground/40">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">Log in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
