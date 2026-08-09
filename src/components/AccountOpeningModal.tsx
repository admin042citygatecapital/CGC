import { trackConversion } from '@/lib/useAnalytics';
import {
AlertCircle,
ArrowLeft,
ArrowRight,
Building2,
Camera,
CheckCircle,
CreditCard,
Eye,EyeOff,
FileText,
Globe,
Loader2,
Lock,
Mail,Phone,
Shield,
TrendingUp,
User,
X,
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useEffect,useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountOpeningModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected plan from the card that was clicked */
  initialPlan?: 'Personal' | 'Savings' | 'Business';
}

interface FormData {
  // Step 1 — Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  accountType: string;
  // Step 3 — Security
  password: string;
  confirmPassword: string;
  // Step 4 — OTP + Terms
  otp: string;
  termsAccepted: boolean;
  additionalNotes: string;
}

const EMPTY_FORM: FormData = {
  firstName: '', lastName: '', email: '', phone: '',
  nationality: '',
  accountType: '',
  password: '', confirmPassword: '',
  otp: '', termsAccepted: false, additionalNotes: '',
};

const PLAN_ICONS = {
  Personal: User,
  Savings: TrendingUp,
  Business: Building2,
};

const PLAN_COLORS = {
  Personal: '#C9A84C',
  Savings: '#10B981',
  Business: '#627EEA',
};

const STEPS = [
  { label: 'Personal Info',  icon: User     },
  { label: 'KYC Preview',    icon: Camera   },
  { label: 'Security',       icon: Shield   },
  { label: 'Confirm',        icon: FileText },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
      <AlertCircle size={10} /> {msg}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-foreground/60 mb-1.5">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/40 transition-colors ${props.className ?? ''}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full bg-[#111] border border-primary/15 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-colors ${props.className ?? ''}`}
    />
  );
}

// ── Step 1: Personal Information ──────────────────────────────────────────────

function StepPersonal({ data, onChange, errors }: {
  data: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>First Name *</Label>
          <Input placeholder="John" value={data.firstName} onChange={e => onChange('firstName', e.target.value)} />
          <FieldError msg={errors.firstName} />
        </div>
        <div>
          <Label>Last Name *</Label>
          <Input placeholder="Doe" value={data.lastName} onChange={e => onChange('lastName', e.target.value)} />
          <FieldError msg={errors.lastName} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Email Address *</Label>
          <div className="relative">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
            <Input placeholder="john@example.com" type="email" value={data.email} onChange={e => onChange('email', e.target.value)} className="pl-9" />
          </div>
          <FieldError msg={errors.email} />
        </div>
        <div>
          <Label>Phone Number *</Label>
          <div className="relative">
            <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
            <Input placeholder="+44 7888 382458" type="tel" value={data.phone} onChange={e => onChange('phone', e.target.value)} className="pl-9" />
          </div>
          <FieldError msg={errors.phone} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Preview Experience *</Label>
          <Select value={data.accountType} onChange={e => onChange('accountType', e.target.value)}>
            <option value="">Select experience</option>
            <option>Personal</option>
            <option>Savings</option>
            <option>Business</option>
          </Select>
          <FieldError msg={errors.accountType} />
        </div>
        <div>
          <Label>Country or Region *</Label>
          <div className="relative">
            <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
            <Input placeholder="e.g. United Kingdom" value={data.nationality} onChange={e => onChange('nationality', e.target.value)} className="pl-9" />
          </div>
          <FieldError msg={errors.nationality} />
        </div>
      </div>

      <p className="text-xs text-foreground/35 leading-relaxed">
        This creates a product-preview profile only. Do not enter identity-document, tax, bank, or payment-card information.
      </p>
    </div>
  );
}

// ── Step 2: Identity Verification ─────────────────────────────────────────────

function StepIdentity() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Camera size={16} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Identity Verification Is Not Active</p>
            <p className="text-xs text-foreground/45 leading-relaxed">
              This screen explains the proposed KYC journey. No KYC provider is connected and this website will not accept identity documents in production preview mode.
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-xs text-foreground/50 leading-relaxed space-y-2">
        <p>Before live KYC is enabled, City Gate Capital must contract an approved provider and publish jurisdiction-specific consent, retention, and privacy notices.</p>
        <p>For now, continue without entering a passport number, tax identifier, selfie, or document image.</p>
      </div>
    </div>
  );
}

// ── Step 3: Security Setup ────────────────────────────────────────────────────

function StepSecurity({ data, onChange, errors }: {
  data: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  const [showPw, setShowPw]   = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const p = data.password;
  const rules = [
    { label: 'At least 8 characters',      met: p.length >= 8 },
    { label: 'One uppercase letter (A–Z)',  met: /[A-Z]/.test(p) },
    { label: 'One number (0–9)',            met: /[0-9]/.test(p) },
    { label: 'One special character (!@#$…)', met: /[^A-Za-z0-9]/.test(p) },
  ];

  const strength = rules.filter(r => r.met).length;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#10B981', '#C9A84C'][strength];

  return (
    <div className="space-y-5">
      <div>
        <Label>Create Password *</Label>
        <div className="relative">
          <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
          <Input
            type={showPw ? 'text' : 'password'}
            placeholder="Min. 8 chars, uppercase, number, symbol"
            value={data.password}
            onChange={e => onChange('password', e.target.value)}
            className="pl-9 pr-10"
          />
          <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 transition-colors">
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Strength bar */}
        {p && (
          <div className="mt-2">
            <div className="flex gap-1 mb-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{ background: i <= strength ? strengthColor : 'rgba(255,255,255,0.08)' }} />
              ))}
            </div>
            <p className="text-[11px]" style={{ color: strengthColor }}>{strengthLabel}</p>
          </div>
        )}

        {/* Requirements checklist — always visible */}
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35 mb-2">Password requirements</p>
          {rules.map(({ label, met }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${met ? 'bg-primary/20' : 'bg-white/[0.04]'}`}>
                {met
                  ? <CheckCircle size={10} className="text-primary" />
                  : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                }
              </div>
              <span className={`text-[11px] transition-colors duration-200 ${met ? 'text-foreground/70' : 'text-foreground/35'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <FieldError msg={errors.password} />
      </div>

      <div>
        <Label>Confirm Password *</Label>
        <div className="relative">
          <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
          <Input
            type={showCpw ? 'text' : 'password'}
            placeholder="Re-enter password"
            value={data.confirmPassword}
            onChange={e => onChange('confirmPassword', e.target.value)}
            className="pl-9 pr-10"
          />
          <button type="button" onClick={() => setShowCpw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 transition-colors">
            {showCpw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <FieldError msg={errors.confirmPassword} />
      </div>

      {/* Security features */}
      <div className="rounded-2xl border border-primary/10 bg-white/[0.02] p-5 space-y-3">
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-3">Security Features Enabled</p>
        {[
          { icon: Shield,      label: 'Two-Factor Authentication',  desc: 'SMS + Authenticator app' },
          { icon: CreditCard,  label: 'Biometric Login',            desc: 'Face ID & Touch ID ready' },
          { icon: Lock,        label: 'Session Encryption',         desc: '256-bit AES end-to-end' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon size={13} className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground/70">{label}</p>
              <p className="text-[11px] text-foreground/35">{desc}</p>
            </div>
            <CheckCircle size={13} className="text-primary ml-auto shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 4: Confirm ───────────────────────────────────────────────────────────

function StepConfirm({ data, onChange, errors }: {
  data: FormData;
  onChange: (k: keyof FormData, v: string | boolean) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-2xl border border-primary/15 bg-white/[0.02] p-5">
        <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-4">Preview Profile Summary</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
          {[
            ['Name',    `${data.firstName} ${data.lastName}`],
            ['Email',   data.email],
            ['Phone',   data.phone],
            ['Experience', data.accountType],
            ['Country', data.nationality],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] text-foreground/30 uppercase tracking-wider">{label}</p>
              <p className="text-sm text-foreground/70 font-medium truncate">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Email verification notice */}
      <div className="rounded-2xl border border-primary/10 bg-white/[0.02] p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Mail size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Email Verification</p>
            <p className="text-xs text-foreground/50 leading-relaxed">
              After submitting, we'll send a verification link to{' '}
              <span className="text-primary font-medium">{data.email || 'your email'}</span>.
              Click the link to activate your preview profile — no code needed.
            </p>
          </div>
        </div>
      </div>

      {/* Additional notes */}
      <div>
        <Label>Additional Information (optional)</Label>
        <textarea
          rows={2}
          placeholder="Any notes for our team..."
          value={data.additionalNotes}
          onChange={e => onChange('additionalNotes', e.target.value)}
          className="w-full bg-white/[0.04] border border-primary/15 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-primary/40 transition-colors resize-none"
        />
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div
          onClick={() => onChange('termsAccepted', !data.termsAccepted)}
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            data.termsAccepted ? 'bg-primary border-primary' : 'border-primary/30 group-hover:border-primary/50'
          }`}
        >
          {data.termsAccepted && <CheckCircle size={12} className="text-black" />}
        </div>
        <span className="text-xs text-foreground/50 leading-relaxed">
          I agree to the <span className="text-primary underline cursor-pointer">Terms & Conditions</span> and{' '}
          <span className="text-primary underline cursor-pointer">Privacy Policy</span>. I confirm all information provided is accurate.
        </span>
      </label>
      <FieldError msg={errors.termsAccepted} />
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({ plan, name }: { plan: string; name: string }) {
  return (
    <div className="text-center py-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
      >
        <CheckCircle size={36} className="text-black" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="text-2xl font-bold text-foreground mb-2">Preview Profile Created</h3>
        <p className="text-foreground/50 text-sm leading-relaxed max-w-xs mx-auto mb-6">
          Welcome, {name}. Your <span className="text-primary font-semibold">{plan}</span> preview profile was created. This is not a bank or payment account and cannot hold or move funds.
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-6">
          {[
            { label: 'Profile', value: plan },
            { label: 'Email',   value: 'Verify' },
            { label: 'Transactions', value: 'Disabled' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/[0.04] border border-primary/10 p-3 text-center">
              <p className="text-[10px] text-foreground/35 mb-1">{label}</p>
              <p className="text-xs font-bold text-primary">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-foreground/30">Check your email for preview-profile verification and next steps.</p>
      </motion.div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function AccountOpeningModal({ open, onClose, initialPlan = 'Personal' }: AccountOpeningModalProps) {
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState<FormData>({ ...EMPTY_FORM, accountType: initialPlan });
  const [errors, setErrors]   = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  // Sync plan when modal opens with a different plan
  useEffect(() => {
    if (open) {
      setForm(f => ({ ...f, accountType: initialPlan }));
      setStep(0);
      setSubmitted(false);
      setSubmitError('');
      setErrors({});
    }
  }, [open, initialPlan]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function update(k: keyof FormData, v: string | boolean | File | null) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (step === 0) {
      if (!form.firstName.trim())  errs.firstName   = 'Required';
      if (!form.lastName.trim())   errs.lastName    = 'Required';
      if (!form.email.includes('@')) errs.email     = 'Valid email required';
      if (!form.phone.trim())      errs.phone       = 'Required';
      if (!form.accountType)       errs.accountType = 'Select an account type';
      if (!form.nationality.trim()) errs.nationality = 'Required';
    }
    if (step === 2) {
      if (form.password.length < 8)               errs.password = 'Minimum 8 characters';
      else if (!/[A-Z]/.test(form.password))      errs.password = 'Must contain at least one uppercase letter';
      else if (!/[0-9]/.test(form.password))      errs.password = 'Must contain at least one number';
      else if (!/[^A-Za-z0-9]/.test(form.password)) errs.password = 'Must contain at least one special character';
      if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    }
    if (step === 3) {
      if (!form.termsAccepted) errs.termsAccepted = 'You must accept the terms' as never;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    setStep(s => s + 1);
  }

  function handleBack() {
    setStep(s => Math.max(0, s - 1));
    setErrors({});
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     `${form.firstName.trim()} ${form.lastName.trim()}`,
          email:    form.email,
          password: form.password,
          phone:    form.phone,
          country:  form.nationality,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Registration failed. Please try again.');
        setSubmitting(false);
        return;
      }

      trackConversion('signup_completed', '/accounts', { plan: form.accountType.toLowerCase() });
      setSubmitted(true);
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const PlanIcon = PLAN_ICONS[form.accountType as keyof typeof PLAN_ICONS] ?? User;
  const planColor = PLAN_COLORS[form.accountType as keyof typeof PLAN_COLORS] ?? '#C9A84C';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' as const }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden pointer-events-auto"
              style={{
                background: 'linear-gradient(160deg, #111 0%, #0A0A0A 100%)',
                border: '1px solid rgba(201,168,76,0.2)',
                boxShadow: '0 0 80px rgba(201,168,76,0.08), 0 40px 80px rgba(0,0,0,0.6)',
              }}
            >
              {/* Gold line top */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

              {/* Header */}
              <div className="flex items-center justify-between px-7 pt-6 pb-5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${planColor}18`, border: `1px solid ${planColor}30` }}>
                    <PlanIcon size={17} style={{ color: planColor }} />
                  </div>
                  <div>
                    <p className="text-xs text-foreground/35 uppercase tracking-widest">Create Preview Profile</p>
                    <p className="text-sm font-bold text-foreground">{form.accountType || initialPlan} Experience</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Step indicator */}
              {!submitted && (
                <div className="px-7 pb-5 shrink-0">
                  <div className="flex items-center gap-2">
                    {STEPS.map((s, i) => {
                      const done    = i < step;
                      const current = i === step;
                      return (
                        <div key={s.label} className="flex items-center gap-2 flex-1 last:flex-none">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                              style={{
                                background: done ? '#C9A84C' : current ? `${planColor}20` : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${done ? '#C9A84C' : current ? planColor : 'rgba(255,255,255,0.1)'}`,
                                color: done ? '#000' : current ? planColor : 'rgba(255,255,255,0.3)',
                              }}
                            >
                              {done ? <CheckCircle size={11} /> : i + 1}
                            </div>
                            <span className={`text-[10px] font-medium hidden sm:block ${current ? 'text-foreground/70' : 'text-foreground/25'}`}>
                              {s.label}
                            </span>
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className="flex-1 h-px mx-1" style={{ background: done ? '#C9A84C40' : 'rgba(255,255,255,0.06)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-7 pb-2 scrollbar-hide">
                {submitted ? (
                  <SuccessScreen plan={form.accountType} name={form.firstName} />
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      {step === 0 && <StepPersonal data={form} onChange={(k, v) => update(k, v)} errors={errors} />}
                      {step === 1 && <StepIdentity />}
                      {step === 2 && <StepSecurity data={form} onChange={(k, v) => update(k, v)} errors={errors} />}
                      {step === 3 && <StepConfirm data={form} onChange={(k, v) => update(k, v)} errors={errors} />}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Footer actions */}
              {!submitted && (
                <div className="px-7 py-5 border-t border-primary/8 shrink-0">
                  {submitError && (
                    <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <AlertCircle size={13} className="shrink-0" /> {submitError}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                  {step > 0 && (
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1.5 px-4 py-3 rounded-xl glass border border-primary/15 text-sm text-foreground/50 hover:text-foreground transition-colors"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                  )}
                  <div className="flex-1" />
                  {step < STEPS.length - 1 ? (
                    <button
                      onClick={handleNext}
                      className="relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                      <span className="relative flex items-center gap-1.5">
                        Continue <ArrowRight size={14} />
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleSubmit()}
                      disabled={submitting}
                      className="relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black overflow-hidden disabled:opacity-60"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                      <span className="relative flex items-center gap-1.5">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {submitting ? 'Submitting…' : 'Create Preview Profile'}
                      </span>
                    </button>
                  )}
                  </div>
                </div>
              )}

              {submitted && (
                <div className="px-7 py-5 border-t border-primary/8 shrink-0">
                  <button
                    onClick={onClose}
                    className="w-full relative py-3 rounded-xl text-sm font-bold text-black overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                    <span className="relative">Done</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
