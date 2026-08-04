/**
 * /dashboard/statements — Transaction statements with PDF/CSV export
 */
import { useState, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download,
  Loader2, Activity, Eye, EyeOff, ChevronDown,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface Tx {
  id: string; type: string; status: string; amount: number;
  currency: string; description: string; reference: string; createdAt: string;
}

function fmt(amount: number, currency: string): string {
  try { return amount.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function isCredit(type: string): boolean {
  return ['deposit', 'manual_credit', 'refund', 'crypto_sell'].includes(type);
}

function PV({ value, privacy, className = '' }: { value: string; privacy: boolean; className?: string }) {
  return privacy ? <span className={`font-mono tracking-widest select-none ${className}`}>••••••</span> : <span className={className}>{value}</span>;
}

function exportCSV(txs: Tx[], filename: string) {
  const header = 'Date,Type,Description,Reference,Currency,Amount,Status\n';
  const rows = txs.map(t => [
    new Date(t.createdAt).toISOString().split('T')[0],
    t.type,
    `"${(t.description ?? '').replace(/"/g, '""')}"`,
    t.reference ?? '',
    t.currency ?? 'USD',
    (isCredit(t.type) ? '' : '-') + Math.abs(Number(t.amount ?? 0)).toFixed(2),
    t.status,
  ].join(',')).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(txs: Tx[], customerName: string, period: string) {
  // Build a minimal printable HTML page and open in new tab for browser print-to-PDF
  const rows = txs.map(t => `
    <tr>
      <td>${new Date(t.createdAt).toLocaleDateString('en-GB')}</td>
      <td>${t.type.replace(/_/g, ' ')}</td>
      <td>${t.description ?? ''}</td>
      <td>${t.reference ?? ''}</td>
      <td>${t.currency ?? 'USD'}</td>
      <td style="color:${isCredit(t.type) ? '#10B981' : '#EF4444'}">${(isCredit(t.type) ? '+' : '-')}${Math.abs(Number(t.amount ?? 0)).toFixed(2)}</td>
      <td>${t.status}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Statement - ${period}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 40px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { color: #555; margin: 0 0 20px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f5f5f5; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; font-size: 11px; }
      td { padding: 7px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
      @media print { body { margin: 20px; } }
    </style></head><body>
    <h1>City Gate Capital — Account Statement</h1>
    <p>Account holder: ${customerName} &nbsp;|&nbsp; Period: ${period} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-GB')}</p>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Reference</th><th>Currency</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload = () => window.print();</script>
    </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const PERIODS = [
  { id: 'this_month',  label: 'This Month' },
  { id: 'last_month',  label: 'Last Month' },
  { id: 'last_3',      label: 'Last 3 Months' },
  { id: 'last_6',      label: 'Last 6 Months' },
  { id: 'this_year',   label: 'This Year' },
  { id: 'all',         label: 'All Time' },
];

function filterByPeriod(txs: Tx[], period: string): Tx[] {
  const now = new Date();
  let from: Date;
  switch (period) {
    case 'this_month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month': from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txs.filter(t => {
        const d = new Date(t.createdAt);
        return d >= from && d < new Date(now.getFullYear(), now.getMonth(), 1);
      });
    case 'last_3': from = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
    case 'last_6': from = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
    case 'this_year': from = new Date(now.getFullYear(), 0, 1); break;
    default: return txs;
  }
  return txs.filter(t => new Date(t.createdAt) >= from);
}

export default function StatementsPage() {
  const { customer, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [privacy, setPrivacy]     = useState(false);
  const [allTx, setAllTx]         = useState<Tx[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [period, setPeriod]       = useState('this_month');

  useEffect(() => { setPrivacy(localStorage.getItem('cgc_privacy_mode') === 'true'); }, []);
  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/users/transactions?limit=1000', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.transactions) setAllTx(data.transactions); })
      .catch(() => {}).finally(() => setTxLoading(false));
  }, [token]);

  if (loading || !customer) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const filtered = filterByPeriod(allTx, period);
  const periodLabel = PERIODS.find(p => p.id === period)?.label ?? 'All Time';
  const totalIn  = filtered.filter(t => isCredit(t.type)).reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const totalOut = filtered.filter(t => !isCredit(t.type)).reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const filename = `CGC-Statement-${periodLabel.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}`;

  return (
    <>
      <Helmet>
        <title>Statements — City Gate Capital</title>
        <meta name="description" content="Download your City Gate Capital account statements as PDF or CSV." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard/statements" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
            <Link to="/dashboard" className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5 flex-1">
              <FileText size={16} style={{ color: '#C9A84C' }} />
              <h1 className="text-sm font-semibold text-foreground">Statements</h1>
            </div>
            <button
              onClick={() => { const next = !privacy; setPrivacy(next); localStorage.setItem('cgc_privacy_mode', String(next)); }}
              className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all"
              style={{ background: privacy ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', borderColor: privacy ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)', color: privacy ? '#C9A84C' : 'rgba(255,255,255,0.4)' }}
            >
              {privacy ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 md:px-6 py-6">

          {/* Period selector + export */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative">
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="appearance-none bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-colors cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {PERIODS.map(p => <option key={p.id} value={p.id} style={{ background: '#0a0a0a' }}>{p.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => exportCSV(filtered, `${filename}.csv`)}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Download size={13} /> Export CSV
              </button>
              <button
                onClick={() => exportPDF(filtered, customer.name, periodLabel)}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                <FileText size={13} /> Export PDF
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total In',  value: fmt(totalIn, 'USD'),  color: '#10B981' },
              { label: 'Total Out', value: fmt(totalOut, 'USD'), color: '#EF4444' },
              { label: 'Net',       value: fmt(totalIn - totalOut, 'USD'), color: totalIn >= totalOut ? '#10B981' : '#EF4444' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-white/6 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10px] text-foreground/35 mb-1">{s.label}</p>
                <PV value={s.value} privacy={privacy} className="text-sm font-bold tabular-nums" />
              </div>
            ))}
          </div>

          {/* Transaction table */}
          <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">{periodLabel}</p>
              <span className="text-[10px] text-foreground/25">{filtered.length} transactions</span>
            </div>
            {txLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-foreground/25" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-foreground/20">
                <Activity size={28} />
                <p className="text-sm">No transactions in this period</p>
              </div>
            ) : filtered.map((tx, i) => {
              const positive = isCredit(tx.type);
              return (
                <div key={tx.id}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors ${i < filtered.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground/80 truncate">{tx.description || tx.type.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-foreground/30">
                        {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {tx.reference && <span className="text-[10px] text-foreground/20 font-mono hidden sm:inline">{tx.reference}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                    tx.status === 'completed' || tx.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                    tx.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                  }`}>{tx.status}</span>
                  <PV
                    value={`${positive ? '+' : '−'}${fmt(Math.abs(Number(tx.amount ?? 0)), tx.currency ?? 'USD')}`}
                    privacy={privacy}
                    className={`text-sm font-semibold tabular-nums shrink-0 ${positive ? 'text-emerald-400' : 'text-foreground/60'}`}
                  />
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}
