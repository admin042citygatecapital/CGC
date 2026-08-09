import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, ShieldX, Eye, EyeOff, CheckCircle, XCircle, Clock,
  Search, RefreshCw, Loader2, AlertCircle, FileText, User,
  MapPin, CreditCard, X, ChevronLeft, ChevronRight,
  BadgeCheck, AlertTriangle, Flag, MessageSquare, RotateCcw,
  Settings, TrendingUp, Calendar, Info, Save,
  StickyNote, Send, Shield,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high';

interface RiskScore { score: number; level: RiskLevel; factors: string[]; }

interface KycNote { userId: string; adminId: string; note: string; createdAt: string; }

interface KycUser {
  id: string; name: string; email: string; phone?: string; country?: string;
  status: string; kycStatus: string; createdAt: string;
  kycSubmittedAt?: string; kycApprovedAt?: string; kycRejectedAt?: string;
  kycRejectionReason?: string;
  dateOfBirth?: string; address?: string; city?: string; postalCode?: string;
  idType?: string; idNumber?: string; idDocumentUrl?: string; selfieUrl?: string;
  risk: RiskScore;
  expiryDate?: string; daysUntilExpiry?: number | null; isExpired: boolean;
  notes: KycNote[];
}

interface KycStats {
  pending: number; approvedThisWeek: number; rejectedThisWeek: number;
  expired: number; approachingExpiry: number; avgReviewHours: number;
  totalApproved: number; totalRejected: number;
}

interface KycSettings {
  expiryMonths: number; renewalReminderDays: number; autoRestrictExpired: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'submitted',     label: 'Pending Review',  color: 'text-amber-400',   bg: 'bg-amber-500/15',   dot: 'bg-amber-400' },
  { key: 'approved',      label: 'Approved',         color: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
  { key: 'rejected',      label: 'Rejected',         color: 'text-red-400',     bg: 'bg-red-500/15',     dot: 'bg-red-400' },
  { key: 'expired',       label: 'Expired',          color: 'text-orange-400',  bg: 'bg-orange-500/15',  dot: 'bg-orange-400' },
  { key: 'not_submitted', label: 'Not Submitted',    color: 'text-white/40',    bg: 'bg-white/10',       dot: 'bg-white/30' },
];

const REJECTION_CODES = [
  { code: 'expired_doc',    label: 'Document expired' },
  { code: 'unreadable',     label: 'Document unclear or unreadable' },
  { code: 'name_mismatch',  label: 'Name mismatch' },
  { code: 'fraud',          label: 'Suspected fraud' },
  { code: 'wrong_type',     label: 'Wrong document type' },
  { code: 'other',          label: 'Other' },
];

const RISK_COLORS: Record<RiskLevel, string> = {
  low:    '#10b981',
  medium: '#f59e0b',
  high:   '#ef4444',
};
const RISK_BG: Record<RiskLevel, string> = {
  low:    'bg-emerald-500/15 text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-400',
  high:   'bg-red-500/15 text-red-400',
};

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Risk Badge ────────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: RiskScore }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${RISK_BG[risk.level]}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: RISK_COLORS[risk.level] }} />
        {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)} · {risk.score}
        {risk.factors.length > 0 && <Info size={10} className="opacity-60" />}
      </button>
      <AnimatePresence>
        {open && risk.factors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.97 }}
            className="absolute z-50 top-full mt-1.5 left-0 w-64 rounded-xl border border-white/10 bg-[#141414] shadow-2xl p-3 space-y-1.5"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Risk Factors</p>
            {risk.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                <AlertTriangle size={10} className="text-amber-400 shrink-0 mt-0.5" />
                {f}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── KYC Drawer ────────────────────────────────────────────────────────────────

function KycDrawer({ user, onClose, onAction, processing }: {
  user: KycUser;
  onClose: () => void;
  onAction: (action: string, payload?: Record<string, string>) => Promise<void>;
  processing: boolean;
}) {
  const [showDoc, setShowDoc]         = useState(false);
  const [showSelfie, setShowSelfie]   = useState(false);
  const [drawerTab, setDrawerTab]     = useState<'details' | 'notes' | 'history'>('details');
  const [rejectMode, setRejectMode]   = useState(false);
  const [approveMode, setApproveMode] = useState(false);
  const [infoMode, setInfoMode]       = useState(false);
  const [extendMode, setExtendMode]   = useState(false);
  const [reasonCode, setReasonCode]   = useState('');
  const [reasonText, setReasonText]   = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [infoMsg, setInfoMsg]         = useState('');
  const [extendMonths, setExtendMonths] = useState('12');
  const [noteText, setNoteText]       = useState('');
  const [savingNote, setSavingNote]   = useState(false);

  const isPending  = user.kycStatus === 'submitted';
  const isApproved = user.kycStatus === 'approved';

  async function submitNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    await onAction('note', { note: noteText });
    setNoteText('');
    setSavingNote(false);
  }

  const DRAWER_TABS = [
    { key: 'details', label: 'Details' },
    { key: 'notes',   label: `Notes${user.notes.length > 0 ? ` (${user.notes.length})` : ''}` },
    { key: 'history', label: 'History' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="relative w-full max-w-xl h-full bg-[#0f0f0f] border-l border-white/8 flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{user.name}</p>
              <p className="text-xs text-foreground/40">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge risk={user.risk} />
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-foreground/40 hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-white/8 shrink-0">
          {DRAWER_TABS.map(t => (
            <button key={t.key} onClick={() => setDrawerTab(t.key as typeof drawerTab)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                drawerTab === t.key ? 'text-primary border-b-2 border-primary' : 'text-white/40 hover:text-white/70'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── DETAILS TAB ── */}
          {drawerTab === 'details' && (
            <>
              {/* Status banner */}
              <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
                user.kycStatus === 'submitted' ? 'border-amber-500/25 bg-amber-500/8' :
                user.kycStatus === 'approved'  ? 'border-emerald-500/25 bg-emerald-500/8' :
                user.kycStatus === 'rejected'  ? 'border-red-500/25 bg-red-500/8' :
                'border-white/10 bg-white/3'
              }`}>
                {user.kycStatus === 'submitted' && <Clock size={16} className="text-amber-400 shrink-0" />}
                {user.kycStatus === 'approved'  && <BadgeCheck size={16} className="text-emerald-400 shrink-0" />}
                {user.kycStatus === 'rejected'  && <XCircle size={16} className="text-red-400 shrink-0" />}
                {user.kycStatus === 'not_submitted' && <AlertCircle size={16} className="text-white/30 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    user.kycStatus === 'submitted' ? 'text-amber-400' :
                    user.kycStatus === 'approved'  ? 'text-emerald-400' :
                    user.kycStatus === 'rejected'  ? 'text-red-400' : 'text-white/40'
                  }`}>
                    {user.kycStatus === 'submitted' ? 'Pending Review' :
                     user.kycStatus === 'approved'  ? 'KYC Approved' :
                     user.kycStatus === 'rejected'  ? 'KYC Rejected' : 'Not Submitted'}
                  </p>
                  {user.kycSubmittedAt && <p className="text-xs text-foreground/40 mt-0.5">Submitted {fmtDateTime(user.kycSubmittedAt)}</p>}
                  {user.kycApprovedAt  && <p className="text-xs text-emerald-400/60 mt-0.5">Approved {fmtDateTime(user.kycApprovedAt)}</p>}
                  {user.kycRejectedAt  && <p className="text-xs text-red-400/60 mt-0.5">Rejected {fmtDateTime(user.kycRejectedAt)}</p>}
                  {user.kycRejectionReason && <p className="text-xs text-red-300/60 mt-1">Reason: {user.kycRejectionReason}</p>}
                </div>
              </div>

              {/* Expiry info */}
              {isApproved && user.expiryDate && (
                <div className={`rounded-xl border p-3 flex items-center gap-3 ${
                  user.isExpired ? 'border-red-500/25 bg-red-500/8' :
                  (user.daysUntilExpiry ?? 999) <= 30 ? 'border-amber-500/25 bg-amber-500/8' :
                  'border-white/8 bg-white/2'
                }`}>
                  <Calendar size={14} className={user.isExpired ? 'text-red-400' : (user.daysUntilExpiry ?? 999) <= 30 ? 'text-amber-400' : 'text-white/40'} />
                  <div>
                    <p className="text-xs font-semibold text-white/70">
                      {user.isExpired ? 'KYC Expired' : `Expires ${fmtDate(user.expiryDate)}`}
                    </p>
                    {!user.isExpired && user.daysUntilExpiry !== null && (
                      <p className="text-[10px] text-white/40">{user.daysUntilExpiry} days remaining</p>
                    )}
                  </div>
                </div>
              )}

              {/* Personal Details */}
              <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                  <User size={12} className="text-primary" />
                  <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">Personal Details</p>
                </div>
                <div className="divide-y divide-white/5">
                  {[
                    ['Full Name',          user.name],
                    ['Date of Birth',      user.dateOfBirth || '—'],
                    ['Country',            user.country || '—'],
                    ['Phone',              user.phone || '—'],
                    ['Account Status',     user.status.replace(/_/g, ' ')],
                    ['Registered',         fmtDate(user.createdAt)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-foreground/40">{label}</span>
                      <span className="text-xs font-medium text-foreground capitalize">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address */}
              {(user.address || user.city) && (
                <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                    <MapPin size={12} className="text-primary" />
                    <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">Address</p>
                  </div>
                  <div className="px-4 py-3 text-sm text-foreground/70 leading-relaxed">
                    {[user.address, user.city, user.postalCode, user.country].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}

              {/* Identity Document */}
              <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                  <CreditCard size={12} className="text-primary" />
                  <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">Identity Document</p>
                </div>
                <div className="divide-y divide-white/5">
                  {[
                    ['Document Type',   user.idType   || '—'],
                    ['Document Number', user.idNumber || '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-foreground/40">{label}</span>
                      <span className="text-xs font-medium text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-2 space-y-3">
                  {/* ID Document */}
                  {user.idDocumentUrl ? (
                    <div>
                      <p className="text-[10px] text-white/30 mb-1.5 font-semibold uppercase tracking-wide">ID Document</p>
                      <div className="relative rounded-xl overflow-hidden border border-white/8">
                        <img src={user.idDocumentUrl} alt="ID Document"
                          className={`w-full object-contain max-h-44 transition-all duration-300 ${!showDoc ? 'blur-md' : ''}`} />
                        <button onClick={() => setShowDoc(s => !s)}
                          className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-white bg-black/40 hover:bg-black/20 transition-colors">
                          {showDoc ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> View Document</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
                      <FileText size={18} className="text-foreground/20 mx-auto mb-1.5" />
                      <p className="text-xs text-foreground/30">No ID document uploaded</p>
                    </div>
                  )}
                  {/* Selfie */}
                  {user.selfieUrl ? (
                    <div>
                      <p className="text-[10px] text-white/30 mb-1.5 font-semibold uppercase tracking-wide">Selfie / Liveness</p>
                      <div className="relative rounded-xl overflow-hidden border border-white/8">
                        <img src={user.selfieUrl} alt="Selfie"
                          className={`w-full object-contain max-h-44 transition-all duration-300 ${!showSelfie ? 'blur-md' : ''}`} />
                        <button onClick={() => setShowSelfie(s => !s)}
                          className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-white bg-black/40 hover:bg-black/20 transition-colors">
                          {showSelfie ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> View Selfie</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
                      <User size={18} className="text-foreground/20 mx-auto mb-1.5" />
                      <p className="text-xs text-foreground/30">No selfie submitted</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Compliance Checklist */}
              {isPending && (
                <div className="rounded-2xl border border-white/8 bg-white/2 p-4">
                  <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider mb-3">Compliance Checklist</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Full name matches account',    check: !!user.name },
                      { label: 'Date of birth provided',       check: !!user.dateOfBirth },
                      { label: 'Residential address provided', check: !!user.address },
                      { label: 'ID type selected',             check: !!user.idType },
                      { label: 'ID number provided',           check: !!user.idNumber },
                      { label: 'Document image uploaded',      check: !!user.idDocumentUrl },
                      { label: 'Selfie / liveness submitted',  check: !!user.selfieUrl },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        {item.check
                          ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                          : <AlertTriangle size={12} className="text-amber-400 shrink-0" />}
                        <span className={`text-xs ${item.check ? 'text-foreground/60' : 'text-amber-400/80'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Factors */}
              {user.risk.factors.length > 0 && (
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
                  <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider mb-3">Risk Factors</p>
                  <div className="space-y-1.5">
                    {user.risk.factors.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <AlertTriangle size={10} className="text-amber-400 shrink-0 mt-0.5" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reject form */}
              <AnimatePresence>
                {rejectMode && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-3 overflow-hidden">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Select Rejection Reason</p>
                    <div className="space-y-1.5">
                      {REJECTION_CODES.map(r => (
                        <button key={r.code} onClick={() => { setReasonCode(r.code); if (r.code !== 'other') setReasonText(r.label); }}
                          className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                            reasonCode === r.code ? 'bg-red-500/20 text-red-300' : 'bg-white/3 text-foreground/50 hover:bg-white/6'
                          }`}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                    {reasonCode === 'other' && (
                      <textarea value={reasonText} onChange={e => setReasonText(e.target.value)}
                        placeholder="Describe the reason…" rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-red-500/40 resize-none" />
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setRejectMode(false); setReasonCode(''); setReasonText(''); }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-foreground/50 bg-white/5 hover:bg-white/8 transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={() => { if (reasonText.trim()) onAction('reject', { reason: reasonText, reasonCode }); }}
                        disabled={!reasonText.trim() || processing}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-red-500/80 hover:bg-red-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                        {processing ? <Loader2 size={11} className="animate-spin" /> : <ShieldX size={11} />}
                        Confirm Reject
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Request info form */}
              <AnimatePresence>
                {infoMode && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3 overflow-hidden">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Request Additional Information</p>
                    <textarea value={infoMsg} onChange={e => setInfoMsg(e.target.value)}
                      placeholder="Describe what additional information or documents are needed…" rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-blue-500/40 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => { setInfoMode(false); setInfoMsg(''); }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-foreground/50 bg-white/5 hover:bg-white/8 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => { if (infoMsg.trim()) onAction('request-info', { message: infoMsg }); }}
                        disabled={!infoMsg.trim() || processing}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                        {processing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        Send Request
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Extend / Revoke form */}
              <AnimatePresence>
                {extendMode && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 overflow-hidden">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Extend KYC Approval</p>
                    <div className="flex gap-2">
                      {['6', '12', '24'].map(m => (
                        <button key={m} onClick={() => setExtendMonths(m)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            extendMonths === m ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/50 hover:bg-white/8'
                          }`}>
                          {m} months
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setExtendMode(false)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-foreground/50 bg-white/5 hover:bg-white/8 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => onAction('extend', { months: extendMonths })}
                        disabled={processing}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-black bg-primary hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                        {processing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                        Extend
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* ── NOTES TAB ── */}
          {drawerTab === 'notes' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder="Add an internal admin note…" rows={3}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary/40 resize-none" />
                <button onClick={submitNote} disabled={!noteText.trim() || savingNote}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-black bg-primary hover:bg-primary/90 disabled:opacity-40 transition-colors self-end flex items-center gap-1.5">
                  {savingNote ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  Save
                </button>
              </div>
              {user.notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-white/20">
                  <StickyNote size={24} className="mb-2 opacity-30" />
                  <p className="text-xs">No notes yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {user.notes.map((n, i) => (
                    <div key={i} className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                      <p className="text-xs text-white/70 leading-relaxed">{n.note}</p>
                      <p className="text-[10px] text-white/25 mt-1.5">{fmtDateTime(n.createdAt)} · {n.adminId}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {drawerTab === 'history' && (
            <div className="space-y-2">
              {[
                { label: 'Account Created',   date: user.createdAt,       color: 'text-white/40' },
                { label: 'KYC Submitted',     date: user.kycSubmittedAt,  color: 'text-amber-400' },
                { label: 'KYC Approved',      date: user.kycApprovedAt,   color: 'text-emerald-400' },
                { label: 'KYC Rejected',      date: user.kycRejectedAt,   color: 'text-red-400' },
              ].filter(e => e.date).map((e, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-4 py-3">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-primary/60" />
                  <div>
                    <p className={`text-xs font-semibold ${e.color}`}>{e.label}</p>
                    <p className="text-[10px] text-white/30">{fmtDateTime(e.date)}</p>
                  </div>
                </div>
              ))}
              {user.kycRejectionReason && (
                <div className="rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3">
                  <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-wider mb-1">Rejection Reason</p>
                  <p className="text-xs text-white/60">{user.kycRejectionReason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="px-5 py-4 border-t border-white/8 shrink-0 space-y-2">
          {isPending && !rejectMode && !approveMode && !infoMode && !extendMode && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onAction('flag')}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 transition-colors">
                <Flag size={12} /> Flag Review
              </button>
              <button onClick={() => setInfoMode(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors">
                <MessageSquare size={12} /> Request Info
              </button>
              <button onClick={() => setRejectMode(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                <ShieldX size={12} /> Reject
              </button>
              <button onClick={() => setApproveMode(true)} disabled={processing}
                className="relative flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-black overflow-hidden disabled:opacity-60">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative flex items-center gap-1.5">
                  {processing ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  Approve KYC
                </span>
              </button>
            </div>
          )}
          <AnimatePresence>
            {approveMode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3 overflow-hidden">
                <div>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Approve KYC evidence</p>
                  <p className="text-[10px] text-white/35 mt-1">Document the evidence reviewed. Approval will move the customer to AML pending; it will not enable financial access.</p>
                </div>
                <textarea value={approvalNote} onChange={e => setApprovalNote(e.target.value)} maxLength={500}
                  placeholder="Evidence reviewed, document authenticity result, identity match and decision rationale…" rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-emerald-500/40 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => { setApproveMode(false); setApprovalNote(''); }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-foreground/50 bg-white/5 hover:bg-white/8 transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => onAction('approve', { note: approvalNote })}
                    disabled={approvalNote.trim().length < 10 || processing}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                    {processing ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                    Approve & send to AML
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isApproved && !extendMode && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setExtendMode(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors">
                <RotateCcw size={12} /> Extend KYC
              </button>
              <button onClick={() => { if (confirm('Revoke this user\'s KYC approval?')) onAction('revoke', { reason: 'Revoked by administrator' }); }}
                disabled={processing}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                <XCircle size={12} /> Revoke KYC
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({ settings, onSave }: {
  settings: KycSettings;
  onSave: (s: KycSettings) => Promise<void>;
}) {
  const [form, setForm]   = useState(settings);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/6">
        <Settings size={14} className="text-primary" />
        <p className="text-sm font-semibold text-white/70">KYC Expiry & Renewal Settings</p>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Expiry Period</label>
            <select value={form.expiryMonths} onChange={e => setForm(f => ({ ...f, expiryMonths: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40">
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Renewal Reminder</label>
            <select value={form.renewalReminderDays} onChange={e => setForm(f => ({ ...f, renewalReminderDays: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40">
              <option value={14}>14 days before</option>
              <option value={30}>30 days before</option>
              <option value={60}>60 days before</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Auto-Restrict Expired</label>
            <button onClick={() => setForm(f => ({ ...f, autoRestrictExpired: !f.autoRestrictExpired }))}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                form.autoRestrictExpired ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-white/40'
              }`}>
              <span>{form.autoRestrictExpired ? 'Enabled' : 'Disabled'}</span>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${form.autoRestrictExpired ? 'bg-primary' : 'bg-white/10'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.autoRestrictExpired ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-primary hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminKyc() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [tab, setTab]             = useState<'queue' | 'settings'>('queue');
  const [users, setUsers]         = useState<KycUser[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [sortBy, setSortBy]       = useState('newest');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<KycUser | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [stats, setStats]         = useState<KycStats | null>(null);
  const [settings, setSettings]   = useState<KycSettings | null>(null);
  const [counts, setCounts]       = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && !admin) navigate('/admin/login');
  }, [admin, authLoading, navigate]);

  const fetchUsers = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, page: String(page), limit: '15', sort: sortBy });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/kyc/queue?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setUsers(d.data ?? []);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 1);
      }
    } finally { setLoading(false); }
  }, [admin, statusFilter, page, search, sortBy]);

  const fetchStats = useCallback(async () => {
    if (!admin) return;
    const res = await fetch('/api/admin/kyc/stats', { headers: authHeaders() });
    if (res.ok) setStats(await res.json());
  }, [admin]);

  const fetchSettings = useCallback(async () => {
    if (!admin) return;
    const res = await fetch('/api/admin/kyc/settings', { headers: authHeaders() });
    if (res.ok) setSettings(await res.json());
  }, [admin]);

  const fetchCounts = useCallback(async () => {
    if (!admin) return;
    const statuses = ['submitted', 'approved', 'rejected', 'expired', 'not_submitted'];
    const results: Record<string, number> = {};
    await Promise.all(statuses.map(async s => {
      const res = await fetch(`/api/admin/kyc/queue?status=${s}&limit=1`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); results[s] = d.total ?? 0; }
    }));
    setCounts(results);
  }, [admin]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);
  useEffect(() => { void fetchStats(); void fetchSettings(); void fetchCounts(); }, [fetchStats, fetchSettings, fetchCounts]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleAction(action: string, payload?: Record<string, string>) {
    if (!selected) return;
    setProcessing(true);
    try {
      let url = `/api/admin/kyc/${action}`;
      let body: Record<string, unknown> = { userId: selected.id, ...payload };

      if (action === 'extend') {
        url = '/api/admin/kyc/extend';
        body = { userId: selected.id, action: 'extend', months: Number(payload?.months ?? 12) };
      } else if (action === 'revoke') {
        url = '/api/admin/kyc/extend';
        body = { userId: selected.id, action: 'revoke', reason: payload?.reason };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(d.message ?? 'Action completed', true);
        if (['approve', 'reject', 'revoke'].includes(action)) setSelected(null);
        void fetchUsers();
        void fetchStats();
        void fetchCounts();
        // Refresh selected user data for note/flag actions
        if (['note', 'flag', 'request-info'].includes(action)) {
          const refreshRes = await fetch(`/api/admin/kyc/queue?status=${selected.kycStatus}&search=${encodeURIComponent(selected.email)}&limit=1`, { headers: authHeaders() });
          if (refreshRes.ok) {
            const rd = await refreshRes.json();
            if (rd.data?.[0]) setSelected(rd.data[0]);
          }
        }
      } else {
        showToast(d.error ?? 'Action failed', false);
      }
    } finally { setProcessing(false); }
  }

  async function saveSettings(s: KycSettings) {
    const res = await fetch('/api/admin/kyc/settings', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    const d = await res.json();
    if (res.ok) { setSettings(s); showToast('Settings saved', true); }
    else showToast(d.error ?? 'Failed to save', false);
  }

  if (authLoading) return null;

  const statCards = stats ? [
    { label: 'Pending Review',      value: stats.pending,           color: 'text-amber-400',   icon: Clock },
    { label: 'Approved This Week',  value: stats.approvedThisWeek,  color: 'text-emerald-400', icon: BadgeCheck },
    { label: 'Rejected This Week',  value: stats.rejectedThisWeek,  color: 'text-red-400',     icon: XCircle },
    { label: 'Expired KYC',         value: stats.expired,           color: 'text-orange-400',  icon: AlertTriangle },
    { label: 'Avg Review Time',     value: `${stats.avgReviewHours}h`, color: 'text-primary',  icon: TrendingUp },
  ] : [];

  return (
    <AdminLayout>
      <Helmet>
        <title>KYC Management — City Gate Capital Admin</title>
        <meta name="description" content="KYC review queue and identity verification management for City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/kyc" />
      </Helmet>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">KYC Management</h1>
            <p className="text-sm text-foreground/40 mt-0.5">Identity verification queue, risk scoring, and compliance controls</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { void fetchUsers(); void fetchStats(); void fetchCounts(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-foreground/60 bg-white/5 hover:bg-white/8 border border-white/8 transition-colors">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {statCards.map(card => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon size={13} className={card.color} />
                  <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold">{card.label}</p>
                </div>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Approaching expiry alert */}
        {stats && stats.approachingExpiry > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/8 mb-5">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">
              <strong>{stats.approachingExpiry}</strong> user{stats.approachingExpiry !== 1 ? 's' : ''} approaching KYC expiry within the renewal reminder window.
            </p>
          </div>
        )}

        {/* Page tabs */}
        <div className="flex gap-1 mb-5 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/6">
          {[{ key: 'queue', label: 'Review Queue' }, { key: 'settings', label: 'Settings' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── QUEUE TAB ── */}
        {tab === 'queue' && (
          <>
            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {STATUS_TABS.map(t => (
                <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    statusFilter === t.key ? `${t.bg} ${t.color}` : 'bg-white/5 text-foreground/40 hover:bg-white/8'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  {t.label}
                  {counts[t.key] !== undefined && <span className="opacity-60">({counts[t.key]})</span>}
                </button>
              ))}
            </div>

            {/* Search + sort */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name or email…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary/40 transition-colors" />
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-primary/40">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="risk_high">Highest Risk</option>
                <option value="risk_low">Lowest Risk</option>
              </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Shield size={32} className="text-foreground/15 mb-3" />
                  <p className="text-sm text-foreground/30">No submissions in this category</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/6 bg-white/2">
                        {['Customer', 'Country', 'Document', 'Submitted', 'Risk Score', 'Status', ''].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-foreground/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {users.map((u, i) => (
                        <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="hover:bg-white/2 transition-colors group cursor-pointer"
                          onClick={() => setSelected(u)}>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-foreground text-sm">{u.name}</p>
                            <p className="text-xs text-foreground/40">{u.email}</p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-foreground/60">{u.country || '—'}</td>
                          <td className="px-5 py-3.5 text-xs text-foreground/60">{u.idType || '—'}</td>
                          <td className="px-5 py-3.5 text-xs text-foreground/40 whitespace-nowrap">{fmtDate(u.kycSubmittedAt)}</td>
                          <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                            <RiskBadge risk={u.risk} />
                          </td>
                          <td className="px-5 py-3.5">
                            {u.isExpired ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400">
                                <AlertTriangle size={10} /> Expired
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                u.kycStatus === 'submitted'     ? 'bg-amber-500/15 text-amber-400' :
                                u.kycStatus === 'approved'      ? 'bg-emerald-500/15 text-emerald-400' :
                                u.kycStatus === 'rejected'      ? 'bg-red-500/15 text-red-400' :
                                'bg-white/10 text-white/40'
                              }`}>
                                {u.kycStatus === 'submitted'     && <Clock size={10} />}
                                {u.kycStatus === 'approved'      && <CheckCircle size={10} />}
                                {u.kycStatus === 'rejected'      && <XCircle size={10} />}
                                {u.kycStatus === 'not_submitted' && <AlertCircle size={10} />}
                                {u.kycStatus === 'submitted'     ? 'Pending' :
                                 u.kycStatus === 'approved'      ? 'Approved' :
                                 u.kycStatus === 'rejected'      ? 'Rejected' : 'Not Submitted'}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <button onClick={e => { e.stopPropagation(); setSelected(u); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground/50 bg-white/5 hover:bg-white/10 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                              <Eye size={12} /> Review
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-foreground/40">{total} total · Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/8 disabled:opacity-30 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/8 disabled:opacity-30 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && settings && (
          <SettingsPanel settings={settings} onSave={saveSettings} />
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selected && (
          <KycDrawer
            user={selected}
            onClose={() => setSelected(null)}
            onAction={handleAction}
            processing={processing}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl z-50 ${
              toast.ok ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'
            }`}
          >
            {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
