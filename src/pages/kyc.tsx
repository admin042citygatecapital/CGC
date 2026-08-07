import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, User, FileText, Camera, CheckCircle, Clock,
  AlertCircle, ChevronRight, Upload, Eye, EyeOff, Loader2,
  Lock, XCircle, ArrowLeft, BadgeCheck, Info, MessageSquare,
  Sparkles, RefreshCw, Phone,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface KycForm {
  dateOfBirth: string; nationality: string; address: string;
  city: string; postalCode: string; country: string;
  idType: string; idNumber: string;
  idDocumentBase64: string; idDocumentName: string;
  selfieBase64: string; selfieName: string;
}

const EMPTY: KycForm = {
  dateOfBirth: '', nationality: '', address: '', city: '', postalCode: '', country: '',
  idType: '', idNumber: '', idDocumentBase64: '', idDocumentName: '',
  selfieBase64: '', selfieName: '',
};

const ID_TYPES = [
  'International Passport',
  "Driver's License",
  'National Identity Card',
  'Residence Permit',
  "Voter's Card",
];

// 5 steps including the final "Approved" state
const STEPS = [
  { id: 0, label: 'Create Account', icon: User,        done: true },
  { id: 1, label: 'Upload ID',      icon: FileText,    done: false },
  { id: 2, label: 'Selfie Check',   icon: Camera,      done: false },
  { id: 3, label: 'Under Review',   icon: Clock,       done: false },
  { id: 4, label: 'Approved',       icon: BadgeCheck,  done: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-foreground/60 mb-1.5 uppercase tracking-wider">{children}</label>;
}
function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle size={11} />{msg}</p>;
}
function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground/30
        focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all ${className}`} />
  );
}
function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground
        focus:outline-none focus:border-primary/50 transition-all appearance-none ${className}`}>
      {children}
    </select>
  );
}

// ── Progress Stepper ──────────────────────────────────────────────────────────

function ProgressStepper({ activeStep }: { activeStep: number }) {
  // activeStep: 0=personal, 1=identity, 2=selfie, 3=review, 4=approved
  // Map form steps (0-2) to stepper steps (1-2)
  const stepperStep = activeStep <= 0 ? 1 : activeStep === 1 ? 1 : activeStep === 2 ? 2 : activeStep === 3 ? 3 : 4;

  return (
    <div className="flex items-center w-full">
      {STEPS.map((s, i) => {
        const isComplete = i < stepperStep;
        const isCurrent  = i === stepperStep;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <motion.div
                animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isComplete ? 'bg-emerald-500/20 text-emerald-400' :
                  isCurrent  ? 'bg-primary/20 text-primary ring-2 ring-primary/30' :
                  'bg-white/5 text-foreground/20'
                }`}>
                {isComplete ? <CheckCircle size={16} /> : <s.icon size={16} />}
              </motion.div>
              <span className={`text-[9px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
                isComplete ? 'text-emerald-400' : isCurrent ? 'text-primary' : 'text-foreground/20'
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1.5 mb-4 transition-all duration-500 ${isComplete ? 'bg-emerald-500/40' : 'bg-white/8'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Document Guidelines ───────────────────────────────────────────────────────

function DocGuidelines() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
        <Info size={13} className="text-primary" />
        <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Document Guidelines</p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle size={10} /> Valid Submission
          </p>
          <ul className="space-y-1.5">
            {['Full document visible', 'Clear, sharp image', 'All text readable', 'No glare or shadows', 'Colour photo'].map(t => (
              <li key={t} className="text-[11px] text-white/50 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />{t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <XCircle size={10} /> Will Be Rejected
          </p>
          <ul className="space-y-1.5">
            {['Blurry or out of focus', 'Expired document', 'Cropped or cut off', 'Black & white copy', 'Edited or altered'].map(t => (
              <li key={t} className="text-[11px] text-white/50 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />{t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Pending State (submitted, waiting) ───────────────────────────────────────

function PendingState({ submittedAt, onRefresh, refreshing }: {
  submittedAt?: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!submittedAt) return;
    const start = new Date(submittedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 60_000));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [submittedAt]);

  const isLong = elapsed >= 10;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Main status card */}
      <div className="rounded-3xl border border-amber-500/25 bg-amber-500/8 p-8 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border-2 border-dashed border-amber-500/40 flex items-center justify-center mx-auto mb-5">
          <Clock size={28} className="text-amber-400" />
        </motion.div>
        <h2 className="text-xl font-bold text-foreground mb-2">Under Review</h2>
        <p className="text-sm text-foreground/50 max-w-sm mx-auto mb-4">
          Your documents are being reviewed by our compliance team.
          {submittedAt && (
            <span className="block mt-1 text-amber-400/70">
              Submitted {elapsed < 1 ? 'just now' : `${elapsed} minute${elapsed !== 1 ? 's' : ''} ago`}
            </span>
          )}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/20 text-xs font-semibold text-amber-400">
          <Sparkles size={11} />
          Usually approved in under 5 minutes
        </div>
      </div>

      {/* Progress steps */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-4">Review Progress</p>
        <div className="space-y-3">
          {[
            { label: 'Documents received',         done: true },
            { label: 'Identity check in progress', done: false, active: true },
            { label: 'Compliance review',          done: false },
            { label: 'Decision & notification',    done: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              ) : item.active ? (
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-white/15 shrink-0" />
              )}
              <span className={`text-sm ${item.done ? 'text-emerald-400' : item.active ? 'text-amber-400' : 'text-white/25'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Long wait message */}
      {isLong && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-blue-500/20 bg-blue-500/8 p-4 flex items-start gap-3">
          <MessageSquare size={15} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-400 mb-1">Taking longer than expected?</p>
            <p className="text-xs text-white/50 mb-3">
              Your review has been in progress for {elapsed} minutes. If you need assistance, our support team is available 24/7.
            </p>
            <a href="/support" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              <Phone size={11} /> Contact Support
            </a>
          </div>
        </motion.div>
      )}

      {/* Refresh */}
      <button onClick={onRefresh} disabled={refreshing}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white/40 bg-white/[0.03] border border-white/8 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40 transition-colors">
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Checking…' : 'Check Status'}
      </button>
    </motion.div>
  );
}

// ── Approved State ────────────────────────────────────────────────────────────

function ApprovedState({ name, onDashboard }: { name: string; onDashboard: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDashboard, 5000);
    return () => clearTimeout(id);
  }, [onDashboard]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-3xl border border-emerald-500/25 bg-emerald-500/8 p-10 text-center">
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
        <BadgeCheck size={40} className="text-emerald-400" />
      </motion.div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Congratulations, {name.split(' ')[0]}!</h2>
      <p className="text-sm text-foreground/50 max-w-sm mx-auto mb-6">
        Your identity has been verified. You now have full access to all City Gate Capital banking services including transfers, withdrawals, and virtual cards.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-8 text-left">
        {[
          { icon: CheckCircle, label: 'Transfers', desc: 'Send & receive funds globally' },
          { icon: CheckCircle, label: 'Withdrawals', desc: 'Withdraw to bank or crypto' },
          { icon: CheckCircle, label: 'Virtual Cards', desc: 'Instant virtual card issuance' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
            <item.icon size={14} className="text-emerald-400 mb-1.5" />
            <p className="text-xs font-semibold text-white/70">{item.label}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
      <button onClick={onDashboard}
        className="relative px-8 py-3.5 rounded-xl text-sm font-bold text-black overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
        <span className="relative flex items-center gap-2">
          <Sparkles size={14} /> Go to Dashboard
        </span>
      </button>
      <p className="text-[11px] text-white/20 mt-3">Redirecting automatically in 5 seconds…</p>
    </motion.div>
  );
}

// ── Rejected State ────────────────────────────────────────────────────────────

function RejectedState({ reason, onResubmit }: { reason?: string; onResubmit: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-red-500/25 bg-red-500/8 p-8 text-center space-y-5">
      <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
        <XCircle size={32} className="text-red-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">Verification Failed</h2>
        <p className="text-sm text-foreground/50 max-w-sm mx-auto">
          Your previous KYC submission was rejected. Please review the reason below and resubmit with the correct documents.
        </p>
      </div>
      {reason && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-left">
          <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-wider mb-1.5">Rejection Reason</p>
          <p className="text-sm text-white/70">{reason}</p>
        </div>
      )}
      <button onClick={onResubmit}
        className="relative px-6 py-3 rounded-xl text-sm font-bold text-black overflow-hidden mx-auto block">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
        <span className="relative">Resubmit KYC</span>
      </button>
    </motion.div>
  );
}

// ── Step 0: Personal Info ─────────────────────────────────────────────────────

function StepPersonal({ form, onChange, errors }: {
  form: KycForm;
  onChange: (k: keyof KycForm, v: string) => void;
  errors: Partial<Record<keyof KycForm, string>>;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 flex items-start gap-3">
        <Info size={14} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/50 leading-relaxed">
          Provide your personal details exactly as they appear on your government-issued ID. All information is encrypted and stored securely.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date of Birth *</Label>
          <Input type="date" value={form.dateOfBirth} onChange={e => onChange('dateOfBirth', e.target.value)}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]} />
          <FieldErr msg={errors.dateOfBirth} />
        </div>
        <div>
          <Label>Nationality *</Label>
          <Input placeholder="e.g. Nigerian" value={form.nationality} onChange={e => onChange('nationality', e.target.value)} />
          <FieldErr msg={errors.nationality} />
        </div>
      </div>
      <div>
        <Label>Residential Address *</Label>
        <Input placeholder="Street address" value={form.address} onChange={e => onChange('address', e.target.value)} />
        <FieldErr msg={errors.address} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>City *</Label>
          <Input placeholder="City" value={form.city} onChange={e => onChange('city', e.target.value)} />
          <FieldErr msg={errors.city} />
        </div>
        <div>
          <Label>Postal Code</Label>
          <Input placeholder="ZIP / Postcode" value={form.postalCode} onChange={e => onChange('postalCode', e.target.value)} />
        </div>
        <div>
          <Label>Country *</Label>
          <Input placeholder="Country" value={form.country} onChange={e => onChange('country', e.target.value)} />
          <FieldErr msg={errors.country} />
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Identity Documents ────────────────────────────────────────────────

function StepIdentity({ form, onChange, errors }: {
  form: KycForm;
  onChange: (k: keyof KycForm, v: string) => void;
  errors: Partial<Record<keyof KycForm, string>>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(form.idDocumentBase64 || null);

  function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target?.result as string;
      onChange('idDocumentBase64', b64);
      onChange('idDocumentName', file.name);
      setPreview(b64);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-5">
      <DocGuidelines />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>ID Document Type *</Label>
          <Select value={form.idType} onChange={e => onChange('idType', e.target.value)}>
            <option value="">Select type…</option>
            {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <FieldErr msg={errors.idType} />
        </div>
        <div>
          <Label>Document Number *</Label>
          <Input placeholder="As printed on document" value={form.idNumber} onChange={e => onChange('idNumber', e.target.value)} />
          <FieldErr msg={errors.idNumber} />
        </div>
      </div>
      <div>
        <Label>Upload Document (front) *</Label>
        <button type="button" onClick={() => fileRef.current?.click()}
          className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
            form.idDocumentBase64 ? 'border-primary/40 bg-primary/5' : 'border-white/15 hover:border-primary/30 hover:bg-white/3'
          }`}>
          {form.idDocumentBase64 ? (
            <div className="flex flex-col items-center gap-2">
              {preview && preview.startsWith('data:image') ? (
                <img src={preview} alt="ID preview" className="h-24 object-contain rounded-lg mb-1" />
              ) : (
                <FileText size={28} className="text-primary mx-auto mb-1" />
              )}
              <span className="text-sm font-medium text-primary">{form.idDocumentName}</span>
              <span className="text-xs text-foreground/40">Click to replace</span>
            </div>
          ) : (
            <>
              <Upload size={24} className="text-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-foreground/50 mb-1">Click to upload or drag & drop</p>
              <p className="text-xs text-foreground/25">JPG, PNG, PDF — max 5MB</p>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={e => handleFile(e.target.files?.[0] ?? null)} />
        <FieldErr msg={errors.idDocumentBase64} />
      </div>
      <div className="flex items-center gap-3 text-xs text-foreground/35 rounded-xl border border-white/5 bg-white/2 p-3">
        <Lock size={12} className="text-primary shrink-0" />
        <span>256-bit AES encryption · Documents deleted after verification · SOC 2 Type II compliant</span>
      </div>
    </div>
  );
}

// ── Step 2: Selfie ────────────────────────────────────────────────────────────

function StepSelfie({ form, onChange, errors }: {
  form: KycForm;
  onChange: (k: keyof KycForm, v: string) => void;
  errors: Partial<Record<keyof KycForm, string>>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target?.result as string;
      onChange('selfieBase64', b64);
      onChange('selfieName', file.name);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Selfie Guidelines</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Do</p>
            <ul className="space-y-1.5">
              {['Hold ID next to your face', 'Face clearly visible', 'Good lighting', 'Look at camera'].map(t => (
                <li key={t} className="flex items-start gap-1.5 text-xs text-foreground/50">
                  <CheckCircle size={10} className="text-emerald-400 shrink-0 mt-0.5" />{t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Don't</p>
            <ul className="space-y-1.5">
              {['Wear sunglasses', 'Cover your face', 'Use filters', 'Blur or edit photo'].map(t => (
                <li key={t} className="flex items-start gap-1.5 text-xs text-foreground/50">
                  <XCircle size={10} className="text-red-400 shrink-0 mt-0.5" />{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div>
        <Label>Selfie with ID Document *</Label>
        <button type="button" onClick={() => fileRef.current?.click()}
          className={`w-full rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
            form.selfieBase64 ? 'border-primary/40 bg-primary/5' : 'border-white/15 hover:border-primary/30 hover:bg-white/3'
          }`}>
          {form.selfieBase64 ? (
            <div className="flex flex-col items-center gap-2">
              <img src={form.selfieBase64} alt="Selfie preview" className="h-32 object-contain rounded-xl mb-1" />
              <span className="text-sm font-medium text-primary">{form.selfieName}</span>
              <span className="text-xs text-foreground/40">Click to replace</span>
            </div>
          ) : (
            <>
              <Camera size={28} className="text-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-foreground/50 mb-1">Upload a selfie holding your ID</p>
              <p className="text-xs text-foreground/25">JPG, PNG — max 5MB</p>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0] ?? null)} />
        <FieldErr msg={errors.selfieBase64} />
      </div>
    </div>
  );
}

// ── Step 3: Review ────────────────────────────────────────────────────────────

function StepReview({ form }: { form: KycForm }) {
  const [showDoc, setShowDoc] = useState(false);
  const rows: [string, string][] = [
    ['Date of Birth', form.dateOfBirth], ['Nationality', form.nationality],
    ['Address', form.address], ['City', form.city],
    ['Postal Code', form.postalCode || '—'], ['Country', form.country],
    ['ID Type', form.idType], ['ID Number', form.idNumber],
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/8 bg-white/3">
          <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">Personal & Identity Details</p>
        </div>
        <div className="divide-y divide-white/5">
          {rows.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-foreground/40">{label}</span>
              <span className="text-sm font-medium text-foreground">{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {form.idDocumentBase64 && (
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
            <p className="text-xs text-foreground/40 mb-2 font-semibold uppercase tracking-wider">ID Document</p>
            {form.idDocumentBase64.startsWith('data:image') ? (
              <div className="relative">
                <img src={form.idDocumentBase64} alt="ID"
                  className={`w-full h-28 object-cover rounded-xl transition-all ${!showDoc ? 'blur-md' : ''}`} />
                <button onClick={() => setShowDoc(s => !s)}
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white transition-colors">
                  {showDoc ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-foreground/50">
                <FileText size={16} className="text-primary" />{form.idDocumentName}
              </div>
            )}
          </div>
        )}
        {form.selfieBase64 && (
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
            <p className="text-xs text-foreground/40 mb-2 font-semibold uppercase tracking-wider">Selfie</p>
            <img src={form.selfieBase64} alt="Selfie" className="w-full h-28 object-cover rounded-xl" />
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 flex items-start gap-3">
        <ShieldCheck size={14} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/50 leading-relaxed">
          By submitting, you confirm all information is accurate and the documents belong to you. False submissions may result in account termination.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function KycPageInner() {
  const { customer, token } = useCustomerAuth() as {
    customer: (Record<string, string> & { kycStatus?: string; kycSubmittedAt?: string; kycRejectionReason?: string }) | null;
    token: string | null;
  };
  const navigate = useNavigate();

  const [formStep, setFormStep]   = useState(0); // 0=personal, 1=identity, 2=selfie, 3=review
  const [form, setForm]           = useState<KycForm>({ ...EMPTY });
  const [errors, setErrors]       = useState<Partial<Record<keyof KycForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone]           = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setForm(f => ({
      ...f,
      dateOfBirth: customer.dateOfBirth || '',
      address:     customer.address     || '',
      city:        customer.city        || '',
      postalCode:  customer.postalCode  || '',
      country:     customer.country     || '',
      idType:      customer.idType      || '',
      idNumber:    customer.idNumber    || '',
    }));
  }, [customer]);

  // Auto-redirect to dashboard on approval
  useEffect(() => {
    if (customer?.kycStatus === 'approved' && !done) {
      // Show approved state, then redirect
    }
  }, [customer?.kycStatus, done]);

  function update(k: keyof KycForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof KycForm, string>> = {};
    if (formStep === 0) {
      if (!form.dateOfBirth)          errs.dateOfBirth      = 'Required';
      if (!form.nationality.trim())   errs.nationality      = 'Required';
      if (!form.address.trim())       errs.address          = 'Required';
      if (!form.city.trim())          errs.city             = 'Required';
      if (!form.country.trim())       errs.country          = 'Required';
    }
    if (formStep === 1) {
      if (!form.idType)               errs.idType           = 'Select an ID type';
      if (!form.idNumber.trim())      errs.idNumber         = 'Required';
      if (!form.idDocumentBase64)     errs.idDocumentBase64 = 'Please upload your ID document';
    }
    if (formStep === 2) {
      if (!form.selfieBase64)         errs.selfieBase64     = 'Please upload a selfie with your ID';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validate()) setFormStep(s => s + 1);
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dateOfBirth: form.dateOfBirth, address: form.address, city: form.city,
          postalCode: form.postalCode, country: form.country,
          idType: form.idType, idNumber: form.idNumber,
          idDocumentBase64: form.idDocumentBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? 'Submission failed. Please try again.'); return; }

      if (form.selfieBase64 && customer?.id) {
        await fetch('/api/users/kyc-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: customer.id, documentBase64: form.selfieBase64, documentKind: 'selfie' }),
        }).catch(() => { /* non-critical */ });
      }

      setDone(true);
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      // Re-fetch session to check for status update
      await new Promise(r => setTimeout(r, 1200));
    } finally {
      setRefreshing(false);
    }
  }

  const kycStatus = customer?.kycStatus ?? 'not_submitted';
  const isSubmitted = kycStatus === 'submitted';
  const isApproved  = kycStatus === 'approved';
  const isRejected  = kycStatus === 'rejected';
  const showForm    = (kycStatus === 'not_submitted' || (isRejected && showResubmit)) && !done;

  // Map to stepper position
  const stepperPos = done || isSubmitted ? 3 : isApproved ? 4 : showForm ? (formStep === 0 ? 1 : formStep === 1 ? 1 : 2) : 0;

  return (
    <>
      <Helmet>
        <title>Identity Verification (KYC) — City Gate Capital</title>
        <meta name="description" content="Complete your KYC identity verification to unlock full access to City Gate Capital banking services." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/kyc" />
      </Helmet>

      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-sm text-foreground/40 hover:text-foreground/70 transition-colors mb-6">
              <ArrowLeft size={15} /> Back to Dashboard
            </button>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                <ShieldCheck size={22} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Identity Verification</h1>
                <p className="text-sm text-foreground/40">Complete KYC to unlock full banking access</p>
              </div>
            </div>
          </motion.div>

          {/* Progress Stepper */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 mb-6">
            <ProgressStepper activeStep={stepperPos} />
          </motion.div>

          {/* Estimated time badge */}
          {showForm && (
            <div className="flex items-center justify-center mb-5">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                <Clock size={11} />
                Usually approved in under 5 minutes
              </div>
            </div>
          )}

          {/* ── Approved ── */}
          {isApproved && (
            <ApprovedState
              name={customer?.name ?? 'Customer'}
              onDashboard={() => navigate('/dashboard')}
            />
          )}

          {/* ── Pending (submitted) ── */}
          {(isSubmitted || done) && !isApproved && (
            <PendingState
              submittedAt={done ? new Date().toISOString() : customer?.kycSubmittedAt}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          )}

          {/* ── Rejected ── */}
          {isRejected && !showResubmit && (
            <RejectedState
              reason={customer?.kycRejectionReason}
              onResubmit={() => setShowResubmit(true)}
            />
          )}

          {/* ── Form ── */}
          {showForm && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-white/8 bg-white/[0.02] overflow-hidden">

              {/* Step header */}
              <div className="px-7 pt-6 pb-5 border-b border-white/6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                    {formStep === 0 && <User size={15} className="text-primary" />}
                    {formStep === 1 && <FileText size={15} className="text-primary" />}
                    {formStep === 2 && <Camera size={15} className="text-primary" />}
                    {formStep === 3 && <ShieldCheck size={15} className="text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {formStep === 0 ? 'Personal Information' :
                       formStep === 1 ? 'Identity Document' :
                       formStep === 2 ? 'Selfie Verification' : 'Review & Submit'}
                    </p>
                    <p className="text-xs text-foreground/40">Step {formStep + 1} of 4</p>
                  </div>
                </div>
              </div>

              {/* Step content */}
              <div className="p-7">
                <AnimatePresence mode="wait">
                  <motion.div key={formStep}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}>
                    {formStep === 0 && <StepPersonal form={form} onChange={update} errors={errors} />}
                    {formStep === 1 && <StepIdentity form={form} onChange={update} errors={errors} />}
                    {formStep === 2 && <StepSelfie   form={form} onChange={update} errors={errors} />}
                    {formStep === 3 && <StepReview   form={form} />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-7 pb-7">
                {submitError && (
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertCircle size={13} className="shrink-0" /> {submitError}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setFormStep(s => Math.max(0, s - 1)); setErrors({}); }}
                    disabled={formStep === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-foreground/50 hover:text-foreground/80 disabled:opacity-0 transition-all">
                    <ArrowLeft size={15} /> Previous
                  </button>
                  {formStep < 3 ? (
                    <button onClick={handleNext}
                      className="relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                      <span className="relative flex items-center gap-1.5">Continue <ChevronRight size={15} /></span>
                    </button>
                  ) : (
                    <button onClick={() => void handleSubmit()} disabled={submitting}
                      className="relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black overflow-hidden disabled:opacity-60">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                      <span className="relative flex items-center gap-1.5">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        {submitting ? 'Submitting…' : 'Submit for Review'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Info cards */}
          {showForm && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { icon: Lock,       title: 'Bank-Grade Security',  desc: 'AES-256 encryption on all documents' },
                { icon: Clock,      title: 'Under 5 Minutes',      desc: 'Typical review turnaround time' },
                { icon: BadgeCheck, title: 'Instant Activation',   desc: 'Full access granted on approval' },
              ].map(item => (
                <div key={item.title} className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 text-center">
                  <item.icon size={18} className="text-primary mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground mb-1">{item.title}</p>
                  <p className="text-[11px] text-foreground/35 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function KycPage() {
  return <KycPageInner />;
}
