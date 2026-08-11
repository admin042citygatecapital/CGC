/**
 * /admin/compliance — AML, Compliance & Regulatory Centre
 *
 * Features:
 *  - AML flag queue: suspicious transactions, high-risk users
 *  - Suspicious Activity Report (SAR) tracker
 *  - Regulatory checklist (GDPR, AML5, KYC/CDD)
 *  - Risk scoring matrix
 *  - Document archive (KYC docs, SARs, audit exports)
 *  - Compliance metrics: flagged users, pending SARs, overdue reviews
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertCircle,
AlertTriangle,
Check,
CheckCircle2,
ChevronRight,
Clock,
Eye,Flag,
Loader2,
RefreshCw,
Scale,
Save,
ShieldCheck,
ShieldX,
Users,
X
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

interface SecurityFlag {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

interface KycUser {
  id: string; name: string; email: string; kycStatus: string;
  status: string; kycSubmittedAt?: string; country?: string;
}

type AmlStatus = 'not_screened' | 'pending' | 'cleared' | 'review' | 'blocked';
type AmlRiskLevel = 'unrated' | 'low' | 'medium' | 'high';

interface AmlUser {
  id: string; name: string; email: string; country?: string;
  status: string; kycStatus: string; amlStatus: AmlStatus;
  amlRiskLevel: AmlRiskLevel; amlReviewedAt?: string;
  amlReviewedBy?: string; amlReviewReason?: string; amlNextReviewAt?: string;
  financialAccess: { allowed: boolean; code?: string; message: string };
}

const SEV_CFG = {
  low:      { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: 'Low' },
  medium:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: 'Medium' },
  high:     { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'High' },
  critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.15)',   label: 'Critical' },
};

const STATUS_CFG = {
  open:          { color: '#F59E0B', label: 'Open' },
  investigating: { color: '#627EEA', label: 'Investigating' },
  resolved:      { color: '#10B981', label: 'Resolved' },
  escalated:     { color: '#EF4444', label: 'Escalated' },
};

const AML_CFG: Record<AmlStatus, { color: string; label: string }> = {
  not_screened: { color: '#94A3B8', label: 'Not screened' },
  pending:      { color: '#F59E0B', label: 'Pending' },
  cleared:      { color: '#10B981', label: 'Cleared' },
  review:       { color: '#F97316', label: 'Manual review' },
  blocked:      { color: '#EF4444', label: 'Blocked' },
};

// Regulatory checklist items
const CHECKLIST = [
  { id: 'kyc_policy',      label: 'KYC Policy documented & published',         category: 'KYC/CDD' },
  { id: 'aml_policy',      label: 'AML Policy documented & published',          category: 'AML' },
  { id: 'gdpr_privacy',    label: 'GDPR Privacy Policy in place',               category: 'GDPR' },
  { id: 'gdpr_dpa',        label: 'Data Processing Agreement (DPA) signed',     category: 'GDPR' },
  { id: 'sar_procedure',   label: 'SAR filing procedure documented',            category: 'AML' },
  { id: 'pep_screening',   label: 'PEP & sanctions screening active',           category: 'KYC/CDD' },
  { id: 'tx_monitoring',   label: 'Transaction monitoring rules configured',    category: 'AML' },
  { id: 'risk_assessment', label: 'Annual risk assessment completed',           category: 'AML' },
  { id: 'staff_training',  label: 'AML staff training records maintained',      category: 'AML' },
  { id: 'data_retention',  label: 'Data retention policy (5yr minimum)',        category: 'GDPR' },
  { id: 'incident_plan',   label: 'Data breach incident response plan',         category: 'GDPR' },
  { id: 'audit_trail',     label: 'Immutable audit trail enabled',              category: 'Audit' },
];

export default function AdminCompliance() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [flags, setFlags]       = useState<SecurityFlag[]>([]);
  const [kycQueue, setKycQueue] = useState<KycUser[]>([]);
  const [amlUsers, setAmlUsers] = useState<AmlUser[]>([]);
  const [selectedAml, setSelectedAml] = useState<AmlUser | null>(null);
  const [amlForm, setAmlForm] = useState<{ amlStatus: AmlStatus; amlRiskLevel: AmlRiskLevel; reason: string; nextReviewAt: string }>({
    amlStatus: 'pending', amlRiskLevel: 'unrated', reason: '', nextReviewAt: '',
  });
  const [amlSaving, setAmlSaving] = useState(false);
  const [amlError, setAmlError] = useState('');
  const [loading, setLoading]   = useState(true);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('cgc_compliance_checklist') ?? '{}'); } catch { return {}; }
  });
  const [activeTab, setActiveTab] = useState<'flags' | 'aml' | 'kyc' | 'checklist'>('aml');

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [flagsRes, kycRes, amlRes] = await Promise.all([
        fetch('/api/admin/security/threats', { headers: authHeaders() }),
        fetch('/api/admin/kyc/queue', { headers: authHeaders() }),
        fetch('/api/admin/kyc/aml?status=all&limit=100', { headers: authHeaders() }),
      ]);
      if (flagsRes.ok) { const d = await flagsRes.json(); setFlags(d.threats ?? d.flags ?? []); }
      if (kycRes.ok)   { const d = await kycRes.json();   setKycQueue(d.data ?? d.queue ?? d.users ?? []); }
      if (amlRes.ok)   { const d = await amlRes.json();   setAmlUsers(d.data ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleCheck(id: string) {
    setChecklist(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('cgc_compliance_checklist', JSON.stringify(next));
      return next;
    });
  }

  function openAmlDecision(user: AmlUser) {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    setSelectedAml(user);
    setAmlError('');
    setAmlForm({
      amlStatus: user.amlStatus,
      amlRiskLevel: user.amlRiskLevel,
      reason: user.amlReviewReason ?? '',
      nextReviewAt: user.amlNextReviewAt?.slice(0, 10) ?? oneYear.toISOString().slice(0, 10),
    });
  }

  async function saveAmlDecision() {
    if (!selectedAml) return;
    setAmlSaving(true);
    setAmlError('');
    try {
      const response = await fetch('/api/admin/kyc/aml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId: selectedAml.id,
          ...amlForm,
          nextReviewAt: amlForm.amlStatus === 'cleared' ? new Date(`${amlForm.nextReviewAt}T12:00:00Z`).toISOString() : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) setAmlError(data.error ?? 'Unable to save AML decision.');
      else {
        setSelectedAml(null);
        await fetchData();
      }
    } catch {
      setAmlError('Network error while saving the AML decision.');
    } finally {
      setAmlSaving(false);
    }
  }

  const openFlags     = flags.filter(f => f.status === 'open' || f.status === 'escalated');
  const criticalFlags = flags.filter(f => f.severity === 'critical' || f.severity === 'high');
  const pendingKyc    = kycQueue.filter(u => u.kycStatus === 'submitted');
  const pendingAml    = amlUsers.filter(u => u.amlStatus !== 'cleared' && u.amlStatus !== 'blocked');
  const checklistPct  = CHECKLIST.length ? Math.round((CHECKLIST.filter(c => checklist[c.id]).length / CHECKLIST.length) * 100) : 0;

  const metrics = [
    { label: 'Open Flags',       value: openFlags.length,     color: '#EF4444', icon: Flag,         href: null },
    { label: 'Critical/High',    value: criticalFlags.length, color: '#DC2626', icon: AlertCircle,  href: null },
    { label: 'Pending KYC',      value: pendingKyc.length,    color: '#F59E0B', icon: Clock,        href: '/admin/kyc' },
    { label: 'Pending AML',      value: pendingAml.length,    color: '#F97316', icon: ShieldCheck,  href: null },
    { label: 'Readiness Checklist', value: `${checklistPct}%`, color: checklistPct >= 80 ? '#10B981' : '#F59E0B', icon: Scale, href: null },
  ];

  return (
    <>
      <Helmet>
        <title>Compliance — City Gate Capital Admin</title>
        <meta name="description" content="Internal KYC and AML decision controls for the City Gate Capital pre-deployment platform." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/compliance" />
      </Helmet>
      <AdminLayout title="Compliance">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-white text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
              <Scale size={18} style={{ color: '#C9A84C' }} /> Compliance Centre
            </h1>
            <p className="text-white/30 text-xs mt-0.5">KYC decisions, AML clearance and financial-access controls</p>
          </div>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white text-xs transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {metrics.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              {m.href ? (
                <Link to={m.href} className="block rounded-2xl p-4 border border-white/[0.05] hover:border-white/10 transition-all"
                  style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${m.color}15` }}>
                    <m.icon size={14} style={{ color: m.color }} />
                  </div>
                  <p className="text-white text-xl font-bold leading-none mb-0.5">{m.value}</p>
                  <p className="text-white/30 text-[11px]">{m.label}</p>
                </Link>
              ) : (
                <div className="rounded-2xl p-4 border border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${m.color}15` }}>
                    <m.icon size={14} style={{ color: m.color }} />
                  </div>
                  <p className="text-white text-xl font-bold leading-none mb-0.5">{m.value}</p>
                  <p className="text-white/30 text-[11px]">{m.label}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white/[0.03] rounded-xl p-1 w-fit">
          {([
            { id: 'flags',     label: `AML Flags (${openFlags.length})` },
            { id: 'aml',       label: `AML Decisions (${pendingAml.length})` },
            { id: 'kyc',       label: `KYC Queue (${pendingKyc.length})` },
            { id: 'checklist', label: `Readiness Checklist (${checklistPct}%)` },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: activeTab === t.id ? 'rgba(201,168,76,0.12)' : 'transparent',
                color: activeTab === t.id ? '#C9A84C' : 'rgba(255,255,255,0.35)',
                border: activeTab === t.id ? '1px solid rgba(201,168,76,0.25)' : '1px solid transparent',
              }}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-white/25" /></div>
        ) : (
          <>
            {/* AML Flags */}
            {activeTab === 'flags' && (
              <div className="rounded-2xl border border-white/[0.05] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.12em]">Security & AML Flags</p>
                  <Link to="/admin/security" className="text-[11px] flex items-center gap-0.5" style={{ color: '#C9A84C' }}>
                    Full security view <ChevronRight size={10} />
                  </Link>
                </div>
                {flags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                    <CheckCircle2 size={24} />
                    <p className="text-sm">No active flags</p>
                  </div>
                ) : flags.slice(0, 15).map((flag, i) => {
                  const sev = SEV_CFG[flag.severity] ?? SEV_CFG.medium;
                  const st  = STATUS_CFG[flag.status] ?? STATUS_CFG.open;
                  return (
                    <div key={flag.id} className={`flex items-start gap-3 px-5 py-4 hover:bg-white/[0.025] transition-colors ${i < Math.min(flags.length, 15) - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: sev.bg }}>
                        <AlertTriangle size={13} style={{ color: sev.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-white/80 text-xs font-semibold">{flag.userName ?? flag.userId}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: st.color, background: `${st.color}15` }}>{st.label}</span>
                        </div>
                        <p className="text-white/40 text-xs">{flag.description}</p>
                        <p className="text-white/20 text-[10px] mt-1">{flag.type.replace(/_/g, ' ')} · {new Date(flag.createdAt).toLocaleDateString('en-GB')}</p>
                      </div>
                      <Link to="/admin/security" className="text-white/20 hover:text-primary transition-colors shrink-0">
                        <Eye size={13} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Persisted AML decisions */}
            {activeTab === 'aml' && (
              <div className="rounded-2xl border border-white/[0.05] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.12em]">Customer AML Decisions</p>
                    <p className="text-white/25 text-[10px] mt-1">Financial operations remain blocked unless KYC is current and AML is cleared.</p>
                  </div>
                  <span className="text-[10px] text-amber-300/70 border border-amber-500/20 bg-amber-500/8 px-2.5 py-1.5 rounded-lg">
                    Provider screening evidence must be reviewed externally
                  </span>
                </div>
                {amlUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                    <Users size={24} />
                    <p className="text-sm">No customer compliance records</p>
                  </div>
                ) : amlUsers.map((user, i) => {
                  const cfg = AML_CFG[user.amlStatus] ?? AML_CFG.not_screened;
                  return (
                    <div key={user.id} className={`flex items-center gap-3 px-5 py-4 hover:bg-white/[0.025] transition-colors ${i < amlUsers.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}>
                        {user.amlStatus === 'cleared' ? <ShieldCheck size={15} style={{ color: cfg.color }} /> : <ShieldX size={15} style={{ color: cfg.color }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-white/80 text-xs font-semibold">{user.name}</p>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: `${cfg.color}15` }}>{cfg.label}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/40">Risk: {user.amlRiskLevel}</span>
                        </div>
                        <p className="text-white/35 text-[10px] mt-1">{user.email} · KYC {user.kycStatus.replace(/_/g, ' ')} · {user.country ?? 'Country unknown'}</p>
                        <p className={`text-[10px] mt-1 ${user.financialAccess.allowed ? 'text-emerald-400/70' : 'text-amber-300/60'}`}>
                          {user.financialAccess.allowed ? 'Financial gate: permitted' : `Financial gate: blocked — ${user.financialAccess.message}`}
                        </p>
                      </div>
                      <div className="hidden md:block text-right shrink-0">
                        <p className="text-white/25 text-[9px] uppercase">Next review</p>
                        <p className="text-white/50 text-[10px]">{user.amlNextReviewAt ? new Date(user.amlNextReviewAt).toLocaleDateString('en-GB') : 'Not scheduled'}</p>
                      </div>
                      <button onClick={() => openAmlDecision(user)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:brightness-110"
                        style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                        Decide
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* KYC Queue */}
            {activeTab === 'kyc' && (
              <div className="rounded-2xl border border-white/[0.05] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.12em]">Pending KYC Reviews</p>
                  <Link to="/admin/kyc" className="text-[11px] flex items-center gap-0.5" style={{ color: '#C9A84C' }}>
                    Full KYC queue <ChevronRight size={10} />
                  </Link>
                </div>
                {pendingKyc.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                    <CheckCircle2 size={24} />
                    <p className="text-sm">KYC queue is clear</p>
                  </div>
                ) : pendingKyc.map((user, i) => (
                  <div key={user.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.025] transition-colors ${i < pendingKyc.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Users size={13} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-xs font-semibold">{user.name}</p>
                      <p className="text-white/35 text-[10px]">{user.email} · {user.country ?? 'Unknown'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-[10px]">Submitted</p>
                      <p className="text-white/60 text-[11px]">{user.kycSubmittedAt ? new Date(user.kycSubmittedAt).toLocaleDateString('en-GB') : '—'}</p>
                    </div>
                    <Link to="/admin/kyc"
                      className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:brightness-110"
                      style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* Regulatory checklist */}
            {activeTab === 'checklist' && (
              <div className="rounded-2xl border border-white/[0.05] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.12em]">Readiness Planning Checklist</p>
                    <p className="text-white/25 text-[10px] mt-1">Browser-local planning aid only; checked items are not proof of legal or regulatory completion.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${checklistPct}%`, background: checklistPct >= 80 ? '#10B981' : '#F59E0B' }} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: checklistPct >= 80 ? '#10B981' : '#F59E0B' }}>{checklistPct}%</span>
                  </div>
                </div>
                {['KYC/CDD', 'AML', 'GDPR', 'Audit'].map(cat => (
                  <div key={cat}>
                    <div className="px-5 py-2 bg-white/[0.015] border-b border-white/[0.04]">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em]">{cat}</p>
                    </div>
                    {CHECKLIST.filter(c => c.category === cat).map((item, i, arr) => (
                      <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${i < arr.length - 1 ? 'border-b border-white/[0.03]' : 'border-b border-white/[0.04]'}`}>
                        <button onClick={() => toggleCheck(item.id)}
                          className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all"
                          style={{
                            background: checklist[item.id] ? 'rgba(16,185,129,0.2)' : 'transparent',
                            borderColor: checklist[item.id] ? '#10B981' : 'rgba(255,255,255,0.15)',
                          }}>
                          {checklist[item.id] && <Check size={11} className="text-emerald-400" />}
                        </button>
                        <p className={`text-xs flex-1 ${checklist[item.id] ? 'text-white/40 line-through' : 'text-white/70'}`}>{item.label}</p>
                        {checklist[item.id]
                          ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          : <AlertCircle size={13} className="text-amber-400/50 shrink-0" />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </AdminLayout>

      {selectedAml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close AML decision" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedAml(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-white font-semibold">AML decision · {selectedAml.name}</p>
                <p className="text-white/35 text-xs mt-1">{selectedAml.email}</p>
              </div>
              <button onClick={() => setSelectedAml(null)} className="p-2 rounded-lg text-white/35 hover:text-white hover:bg-white/5"><X size={16} /></button>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/7 p-3 mb-5 text-[11px] leading-relaxed text-amber-100/65">
              Record only a documented human decision supported by the approved KYC/AML provider, sanctions and PEP screening, source-of-funds review where required, and your applicable policy. This screen does not perform those checks.
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-white/35">AML decision</span>
                <select value={amlForm.amlStatus} onChange={event => setAmlForm(form => ({ ...form, amlStatus: event.target.value as AmlStatus }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50">
                  <option value="not_screened">Not screened</option>
                  <option value="pending">Pending</option>
                  <option value="cleared">Cleared</option>
                  <option value="review">Manual review</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-white/35">Risk level</span>
                <select value={amlForm.amlRiskLevel} onChange={event => setAmlForm(form => ({ ...form, amlRiskLevel: event.target.value as AmlRiskLevel }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50">
                  <option value="unrated">Unrated</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>

            {amlForm.amlStatus === 'cleared' && (
              <label className="block space-y-1.5 mt-4">
                <span className="text-[10px] uppercase tracking-wider text-white/35">Mandatory next review date</span>
                <input type="date" value={amlForm.nextReviewAt} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                  onChange={event => setAmlForm(form => ({ ...form, nextReviewAt: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50" />
              </label>
            )}

            <label className="block space-y-1.5 mt-4">
              <span className="text-[10px] uppercase tracking-wider text-white/35">Decision rationale</span>
              <textarea value={amlForm.reason} onChange={event => setAmlForm(form => ({ ...form, reason: event.target.value }))}
                maxLength={500} rows={4} placeholder="Document evidence reviewed, match disposition, source-of-funds assessment, and reason for this decision."
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50" />
            </label>

            {amlError && <p className="mt-3 text-xs text-red-400">{amlError}</p>}
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setSelectedAml(null)} className="px-4 py-2.5 rounded-xl border border-white/10 text-xs text-white/50 hover:text-white">Cancel</button>
              <button onClick={saveAmlDecision} disabled={amlSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-bold disabled:opacity-50">
                {amlSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save audited decision
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
