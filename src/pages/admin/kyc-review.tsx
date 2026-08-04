import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Info, Flag } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

type Decision = 'approve' | 'reject' | 'request_info' | 'flag';
const TABS = ['ID Front', 'ID Back', 'Selfie', 'Proof of Address', 'Liveness'];
interface KYCReview {
  userId: string; fullName: string; email: string; status: string;
  riskScore: number; documentType: string; countryName: string;
  submittedAt: string; documents: Record<string, string>;
  extractedData: Record<string, string>; adminNotes: string;
}
export default function AdminKYCReview() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<KYCReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [modal, setModal] = useState<Decision | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/kyc/${userId}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setData(d); setNotes(d.adminNotes ?? ''); }
    } finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  async function decide(action: Decision) {
    try {
      const headers = { ...authHeaders(), 'Content-Type': 'application/json' };
      if (action === 'approve') {
        await fetch('/api/admin/kyc/approve', {
          method: 'POST', headers,
          body: JSON.stringify({ userId, note: notes || undefined }),
        });
      } else if (action === 'reject') {
        await fetch('/api/admin/kyc/reject', {
          method: 'POST', headers,
          body: JSON.stringify({ userId, reason }),
        });
      } else if (action === 'request_info') {
        await fetch('/api/admin/kyc/request-info', {
          method: 'POST', headers,
          body: JSON.stringify({ userId, message: reason }),
        });
      } else {
        await fetch('/api/admin/kyc/flag', {
          method: 'POST', headers,
          body: JSON.stringify({ userId, reason }),
        });
      }
      setModal(null);
      navigate('/admin/kyc-queue');
    } catch (err) { console.error(err); }
  }
  if (loading) return <AdminLayout title="KYC Review"><div className="text-white/50 p-8">Loading…</div></AdminLayout>;
  if (!data) return <AdminLayout title="KYC Review"><div className="text-white/50 p-8">Not found</div></AdminLayout>;
  const riskColor = data.riskScore >= 60 ? '#EF4444' : data.riskScore >= 30 ? '#EAB308' : '#22C55E';
  return (
    <AdminLayout title="KYC Review">
      <Helmet><title>KYC Review — {data.fullName} — CityGate Admin</title></Helmet>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/kyc-queue')}
          className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{data.fullName}</h1>
          <p className="text-white/50 text-sm">{data.email} · {data.countryName} · {data.documentType}</p>
        </div>
        <span className="ml-auto text-sm font-semibold px-3 py-1 rounded-full"
          style={{ color: riskColor, background: riskColor + '26' }}>Risk {data.riskScore}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3">
          <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
            <div className="flex border-b border-white/10 overflow-x-auto">
              {TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)}
                  className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${activeTab === i ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-white/50 hover:text-white/70'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-6 min-h-[320px] flex items-center justify-center">
              {data.documents?.[TABS[activeTab]] ? (
                <img src={data.documents[TABS[activeTab]]} alt={TABS[activeTab]}
                  className="max-w-full max-h-[480px] rounded-lg object-contain" />
              ) : (
                <div className="text-white/30 text-sm">No document uploaded</div>
              )}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <h2 className="text-white font-semibold mb-3 text-sm">Extracted Data</h2>
            <dl className="space-y-2">
              {Object.entries(data.extractedData ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <dt className="text-white/50">{k}</dt>
                  <dd className="text-white font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <h2 className="text-white font-semibold mb-3 text-sm">Admin Notes</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Add notes…"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 resize-none" />
            <button onClick={async () => {
              if (!notes.trim()) return;
              await fetch('/api/admin/kyc/note', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, note: notes }),
              });
            }} className="mt-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-xs transition-colors">
              Save Notes
            </button>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 py-4 flex items-center gap-3 border-t border-white/10 bg-[#0d0d1a]">
        <button onClick={() => setModal('approve')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-colors">
          <Check className="w-4 h-4" /> Approve
        </button>
        <button onClick={() => setModal('reject')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Reject
        </button>
        <button onClick={() => setModal('request_info')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-colors">
          <Info className="w-4 h-4" /> Request Info
        </button>
        <button onClick={() => setModal('flag')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm font-medium transition-colors">
          <Flag className="w-4 h-4" /> Flag
        </button>
      </div>
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-semibold mb-4 capitalize">{modal.replace('_', ' ')} — {data.fullName}</h3>
            {modal !== 'approve' && (
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Reason (optional)…"
                className="w-full mb-4 bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none resize-none" />
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-colors">Cancel</button>
              <button onClick={() => decide(modal)}
                className="px-4 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#C9A84C]/90 text-black text-sm font-medium transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
