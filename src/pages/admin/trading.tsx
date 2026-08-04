/**
 * /admin/trading — Trading Administration Center
 *
 * 11 tabs:
 *  1. Overview      — KPI grid, risk flags, top symbols, P&L summary
 *  2. Markets       — enable/disable/suspend markets, spread config
 *  3. Providers     — API provider health, priority, enable/disable
 *  4. Fees          — fee tier management (maker/taker per asset class)
 *  5. Spreads       — per-market spread configuration
 *  6. Active Traders — live trader list with volume & P&L
 *  7. Accounts      — trading account management (positions + orders per user)
 *  8. Freeze        — global freeze / per-market suspend controls
 *  9. Logs          — admin action audit log
 * 10. Analytics     — volume charts, fee revenue, asset breakdown
 * 11. Risk          — high-loss positions, leverage flags
 */
import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, BarChart2, Activity, DollarSign,
  AlertTriangle, RefreshCw, Loader2, Users, ShieldAlert,
  CheckCircle, Clock, Globe, ChevronRight,
  Server,
  Percent, Layers, FileText, Lock, Unlock, Edit3,
  Save, X, Plus, Trash2, ArrowUpDown,
  ChevronDown, ChevronUp,
  AlertCircle, Pause, Play,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradingSummary {
  openPositions: number; closedPositions: number;
  openOrders: number; filledOrders: number;
  totalTrades: number; activeTraders: number;
  totalUnrealisedPnl: number; totalRealisedPnl: number;
  totalVolume: number; totalFees: number; riskFlagCount: number;
}
interface Position {
  id: string; userId: string; symbol: string; assetClass: string;
  side: string; quantity: number; avgEntryPrice: number; currentPrice: number;
  unrealisedPnl: number; leverage: number; openedAt: string; currency: string;
  realisedPnl: number; status: string;
}
interface Order {
  id: string; userId: string; symbol: string; side: string; type: string;
  quantity: number; filledQty: number; price?: number; status: string;
  createdAt: string; currency: string; leverage: number;
}
interface Trade {
  id: string; userId: string; symbol: string; side: string;
  quantity: number; price: number; fee: number; currency: string;
  executedAt: string; pnl?: number;
}
interface MarketItem {
  symbol: string; name: string; assetClass: string;
  price: number; change24h: number; volume24h: number;
}
interface TopSymbol { symbol: string; value: number; }
interface TradingData {
  summary: TradingSummary;
  openPositions: Position[];
  openOrders: Order[];
  riskFlags: Position[];
  topSymbols: TopSymbol[];
  recentTrades: Trade[];
  markets: MarketItem[];
}

interface MarketConfig {
  id: string; symbol: string; name: string; assetClass: string;
  status: 'active' | 'suspended' | 'maintenance' | 'disabled';
  spreadBps: number; minOrderSize: number; maxOrderSize: number;
  maxLeverage: number; tradingHours: string;
  suspendedAt?: string; suspendReason?: string; updatedAt: string;
}
interface FeeTier {
  id: string; name: string; assetClass: string;
  makerFeeRate: number; takerFeeRate: number;
  minVolume30d: number; maxVolume30d: number | null;
  isDefault: boolean; updatedAt: string; createdAt: string;
}
interface ProviderConfig {
  id: string; name: string; type: string;
  status: 'active' | 'degraded' | 'offline' | 'disabled';
  priority: number; apiKeySet: boolean;
  capabilities: string[]; rateLimit: number;
  lastChecked: string; latencyMs: number | null;
  errorRate: number; uptime24h: number; notes: string;
}
interface FreezeEvent {
  id: string; type: string; targetSymbol?: string;
  reason: string; adminId: string; adminEmail: string; createdAt: string;
}
interface TradingLog {
  id: string; action: string; category: string;
  targetId?: string; targetLabel?: string;
  details: string; adminId: string; adminEmail: string;
  ip?: string; createdAt: string;
}
interface ActiveTrader {
  userId: string; email: string; name: string; tier: string;
  openPositions: number; openOrders: number; totalTrades: number;
  totalVolume: number; unrealisedPnl: number; realisedPnl: number;
  lastActivity: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtUSD(n: number) {
  const abs = Math.abs(n); const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function pnlColor(v: number) { return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-white/50'; }
function fmtPct(r: number) { return `${(r * 100).toFixed(3)}%`; }

const ASSET_COLORS: Record<string, string> = {
  crypto: '#F7931A', forex: '#627EEA', stock: '#10B981', commodity: '#C9A84C', etf: '#9945FF',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-400/10',
  suspended: 'text-red-400 bg-red-400/10',
  maintenance: 'text-amber-400 bg-amber-400/10',
  disabled: 'text-white/30 bg-white/5',
  degraded: 'text-amber-400 bg-amber-400/10',
  offline: 'text-red-400 bg-red-400/10',
};
// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, alert }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; alert?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 flex flex-col gap-3 ${alert ? 'border-red-400/30 bg-red-400/5' : 'border-white/8 bg-white/3'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 font-medium">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-white font-mono">{value}</div>
        {sub && <div className="text-xs text-white/30 mt-1">{sub}</div>}
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[status] ?? 'text-white/40 bg-white/5'}`}>
      {status}
    </span>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ data, onTabChange }: { data: TradingData; onTabChange: (t: string) => void }) {
  return (
    <div className="space-y-6">
      {data.riskFlags.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-400/30 bg-red-400/8 p-4 flex items-center gap-3"
        >
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-red-300">{data.riskFlags.length} position{data.riskFlags.length > 1 ? 's' : ''} flagged for high unrealised loss</div>
            <div className="text-xs text-red-400/70 mt-0.5">Positions with &gt;20% unrealised loss against cost basis</div>
          </div>
          <button onClick={() => onTabChange('risk')} className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
            View <ChevronRight className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Open Positions"   value={String(data.summary.openPositions)}  sub="Live exposure"       icon={BarChart2}   color="#C9A84C" />
        <KpiCard label="Active Traders"   value={String(data.summary.activeTraders)}  sub="With open positions" icon={Users}       color="#627EEA" />
        <KpiCard label="Total Volume"     value={fmtUSD(data.summary.totalVolume)}    sub="All time"            icon={Activity}    color="#10B981" />
        <KpiCard label="Platform Fees"    value={fmtUSD(data.summary.totalFees)}      sub="Collected"           icon={DollarSign}  color="#9945FF" />
        <KpiCard label="Unrealised P&L"   value={fmtUSD(data.summary.totalUnrealisedPnl)} sub="Open positions"  icon={TrendingUp}  color={data.summary.totalUnrealisedPnl >= 0 ? '#10B981' : '#EF4444'} />
        <KpiCard label="Realised P&L"     value={fmtUSD(data.summary.totalRealisedPnl)}  sub="Closed positions" icon={CheckCircle} color="#10B981" />
        <KpiCard label="Open Orders"      value={String(data.summary.openOrders)}     sub="Pending execution"   icon={Clock}       color="#F59E0B" />
        <KpiCard label="Risk Flags"       value={String(data.summary.riskFlagCount)}  sub="High loss positions" icon={ShieldAlert} color="#EF4444" alert={data.summary.riskFlagCount > 0} />
      </div>

      {data.topSymbols.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white text-sm">Top Symbols by Open Interest</span>
          </div>
          <div className="space-y-2">
            {data.topSymbols.map((s, i) => {
              const maxVal = data.topSymbols[0]?.value ?? 1;
              const pct    = (s.value / maxVal) * 100;
              return (
                <div key={s.symbol} className="flex items-center gap-3">
                  <span className="text-xs text-white/30 w-4 text-right">{i + 1}</span>
                  <span className="text-sm font-mono text-white w-24 shrink-0">{s.symbol}</span>
                  <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono text-white/60 w-20 text-right">{fmtUSD(s.value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent trades preview */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <SectionHeader title="Recent Trades" sub="Last 10 executed trades" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/8">
                {['User', 'Symbol', 'Side', 'Qty', 'Price', 'Fee', 'P&L', 'Executed'].map(h => (
                  <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.recentTrades.slice(0, 10).map(t => (
                <tr key={t.id} className="hover:bg-white/3 transition-colors">
                  <td className="py-2.5 px-2 font-mono text-white/50">{t.userId.slice(0, 8)}…</td>
                  <td className="py-2.5 px-2 font-semibold text-white">{t.symbol}</td>
                  <td className="py-2.5 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${t.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'}`}>{t.side.toUpperCase()}</span>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-white/70">{fmt(t.quantity, 4)}</td>
                  <td className="py-2.5 px-2 font-mono text-white/70">${fmt(t.price, 4)}</td>
                  <td className="py-2.5 px-2 font-mono text-white/40">${fmt(t.fee)}</td>
                  <td className={`py-2.5 px-2 font-mono font-semibold ${t.pnl !== undefined ? pnlColor(t.pnl) : 'text-white/30'}`}>
                    {t.pnl !== undefined ? fmtUSD(t.pnl) : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-white/30">{fmtDate(t.executedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Markets ──────────────────────────────────────────────────────────────

function MarketsTab() {
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MarketConfig | null>(null);
  const [saving, setSaving]   = useState(false);
  const [suspendModal, setSuspendModal] = useState<{ market: MarketConfig; action: 'suspend' | 'resume' } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trading/markets', { headers: authHeaders() });
      if (res.ok) setMarkets((await res.json()).markets);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveMarket = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/trading/markets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(editing),
      });
      if (res.ok) { setEditing(null); void load(); }
    } finally { setSaving(false); }
  };

  const doSuspend = async () => {
    if (!suspendModal) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/trading/markets/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ marketId: suspendModal.market.id, action: suspendModal.action, reason: suspendReason }),
      });
      if (res.ok) { setSuspendModal(null); setSuspendReason(''); void load(); }
    } finally { setSaving(false); }
  };

  const filtered = filter === 'all' ? markets : markets.filter(m => m.status === filter || m.assetClass === filter);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Market Configuration"
        sub="Enable, disable, suspend markets and configure trading parameters"
        action={
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="text-xs bg-white/8 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 focus:outline-none"
            >
              <option value="all">All Markets</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="crypto">Crypto</option>
              <option value="forex">Forex</option>
              <option value="stock">Stocks</option>
              <option value="commodity">Commodities</option>
              <option value="etf">ETFs</option>
            </select>
            <button onClick={load} className="p-1.5 rounded-lg bg-white/8 hover:bg-white/12 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/8 bg-white/2">
                {['Symbol', 'Name', 'Class', 'Status', 'Spread', 'Min Size', 'Max Lev', 'Hours', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-white/3 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: ASSET_COLORS[m.assetClass] ?? '#C9A84C' }} />
                      <span className="font-semibold text-white">{m.symbol}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-white/60">{m.name}</td>
                  <td className="py-3 px-3 capitalize text-white/40">{m.assetClass}</td>
                  <td className="py-3 px-3"><StatusBadge status={m.status} /></td>
                  <td className="py-3 px-3 font-mono text-white/70">{m.spreadBps} bps</td>
                  <td className="py-3 px-3 font-mono text-white/50">{m.minOrderSize}</td>
                  <td className="py-3 px-3 font-mono text-amber-400">{m.maxLeverage}x</td>
                  <td className="py-3 px-3 text-white/40 max-w-[120px] truncate">{m.tradingHours}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditing({ ...m })}
                        className="p-1.5 rounded-lg bg-white/8 hover:bg-amber-400/20 transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3 text-white/50 hover:text-amber-400" />
                      </button>
                      {m.status === 'active' ? (
                        <button
                          onClick={() => { setSuspendModal({ market: m, action: 'suspend' }); setSuspendReason(''); }}
                          className="p-1.5 rounded-lg bg-white/8 hover:bg-red-400/20 transition-colors"
                          title="Suspend"
                        >
                          <Pause className="w-3 h-3 text-white/50 hover:text-red-400" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSuspendModal({ market: m, action: 'resume' }); setSuspendReason(''); }}
                          className="p-1.5 rounded-lg bg-white/8 hover:bg-emerald-400/20 transition-colors"
                          title="Resume"
                        >
                          <Play className="w-3 h-3 text-white/50 hover:text-emerald-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Edit Market — {editing.symbol}</h3>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Spread (bps)', key: 'spreadBps', type: 'number' },
                  { label: 'Min Order Size', key: 'minOrderSize', type: 'number' },
                  { label: 'Max Order Size', key: 'maxOrderSize', type: 'number' },
                  { label: 'Max Leverage', key: 'maxLeverage', type: 'number' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="text-xs text-white/40 mb-1 block">{label}</label>
                    <input
                      type={type}
                      value={String((editing as unknown as Record<string, unknown>)[key] ?? '')}
                      onChange={e => setEditing(prev => prev ? { ...prev, [key]: parseFloat(e.target.value) || 0 } : prev)}
                      className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs text-white/40 mb-1 block">Trading Hours</label>
                  <input
                    type="text"
                    value={editing.tradingHours}
                    onChange={e => setEditing(prev => prev ? { ...prev, tradingHours: e.target.value } : prev)}
                    className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-white/40 mb-1 block">Status</label>
                  <select
                    value={editing.status}
                    onChange={e => setEditing(prev => prev ? { ...prev, status: e.target.value as MarketConfig['status'] } : prev)}
                    className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-xl bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-colors">Cancel</button>
                <button
                  onClick={saveMarket}
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suspend/Resume Modal */}
      <AnimatePresence>
        {suspendModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setSuspendModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                {suspendModal.action === 'suspend'
                  ? <Pause className="w-5 h-5 text-red-400" />
                  : <Play className="w-5 h-5 text-emerald-400" />
                }
                <h3 className="font-semibold text-white">
                  {suspendModal.action === 'suspend' ? 'Suspend' : 'Resume'} Market — {suspendModal.market.symbol}
                </h3>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Reason {suspendModal.action === 'suspend' ? '(required)' : '(optional)'}</label>
                <textarea
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  rows={3}
                  placeholder={suspendModal.action === 'suspend' ? 'e.g. Unusual volatility detected' : 'e.g. Issue resolved'}
                  className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSuspendModal(null)} className="flex-1 py-2 rounded-xl bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-colors">Cancel</button>
                <button
                  onClick={doSuspend}
                  disabled={saving || (suspendModal.action === 'suspend' && !suspendReason.trim())}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    suspendModal.action === 'suspend' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  }`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm {suspendModal.action === 'suspend' ? 'Suspend' : 'Resume'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab: Providers ────────────────────────────────────────────────────────────

function ProvidersTab() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<ProviderConfig | null>(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trading/providers', { headers: authHeaders() });
      if (res.ok) setProviders((await res.json()).providers);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveProvider = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/trading/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(editing),
      });
      if (res.ok) { setEditing(null); void load(); }
    } finally { setSaving(false); }
  };

  const sorted = [...providers].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="API Provider Health"
        sub="Monitor and configure market data providers in the fallback chain"
        action={
          <button onClick={load} className="p-1.5 rounded-lg bg-white/8 hover:bg-white/12 transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-white/50" />
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {sorted.map(p => {
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/8 bg-white/3 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
                      <Server className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{p.name}</span>
                        <StatusBadge status={p.status} />
                        <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">Priority {p.priority}</span>
                        {p.apiKeySet && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">API Key Set</span>}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5 capitalize">{p.type} · {p.capabilities.join(', ')}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing({ ...p })}
                    className="p-1.5 rounded-lg bg-white/8 hover:bg-amber-400/20 transition-colors shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-white/50" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-white/4 p-2.5">
                    <div className="text-xs text-white/30 mb-1">Latency</div>
                    <div className="text-sm font-mono text-white">{p.latencyMs !== null ? `${p.latencyMs}ms` : '—'}</div>
                  </div>
                  <div className="rounded-lg bg-white/4 p-2.5">
                    <div className="text-xs text-white/30 mb-1">Error Rate</div>
                    <div className={`text-sm font-mono ${p.errorRate > 0.05 ? 'text-red-400' : 'text-emerald-400'}`}>{(p.errorRate * 100).toFixed(1)}%</div>
                  </div>
                  <div className="rounded-lg bg-white/4 p-2.5">
                    <div className="text-xs text-white/30 mb-1">24h Uptime</div>
                    <div className={`text-sm font-mono ${p.uptime24h < 0.95 ? 'text-amber-400' : 'text-emerald-400'}`}>{(p.uptime24h * 100).toFixed(1)}%</div>
                  </div>
                  <div className="rounded-lg bg-white/4 p-2.5">
                    <div className="text-xs text-white/30 mb-1">Rate Limit</div>
                    <div className="text-sm font-mono text-white/70">{p.rateLimit}/min</div>
                  </div>
                </div>

                {p.notes && (
                  <div className="mt-2 text-xs text-white/30 bg-white/3 rounded-lg px-3 py-2">{p.notes}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Edit Provider — {editing.name}</h3>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Status</label>
                    <select
                      value={editing.status}
                      onChange={e => setEditing(prev => prev ? { ...prev, status: e.target.value as ProviderConfig['status'] } : prev)}
                      className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                    >
                      <option value="active">Active</option>
                      <option value="degraded">Degraded</option>
                      <option value="offline">Offline</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Priority</label>
                    <input
                      type="number" min={1} max={20}
                      value={editing.priority}
                      onChange={e => setEditing(prev => prev ? { ...prev, priority: parseInt(e.target.value) || 1 } : prev)}
                      className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Notes</label>
                  <textarea
                    value={editing.notes}
                    onChange={e => setEditing(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                    rows={3}
                    className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-xl bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-colors">Cancel</button>
                <button
                  onClick={saveProvider}
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab: Fees ─────────────────────────────────────────────────────────────────

function FeesTab() {
  const [fees, setFees]       = useState<FeeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FeeTier | null>(null);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trading/fees', { headers: authHeaders() });
      if (res.ok) setFees((await res.json()).fees);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveFee = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/trading/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action: 'upsert', fee: editing }),
      });
      if (res.ok) { setEditing(null); void load(); }
    } finally { setSaving(false); }
  };

  const deleteFee = async (id: string, name: string) => {
    if (!confirm(`Delete fee tier "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch('/api/admin/trading/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action: 'delete', fee: { id, name } }),
      });
      if (res.ok) void load();
    } finally { setDeleting(null); }
  };

  const newFee = (): FeeTier => ({
    id: '', name: 'New Tier', assetClass: 'all',
    makerFeeRate: 0.001, takerFeeRate: 0.002,
    minVolume30d: 0, maxVolume30d: null,
    isDefault: false, updatedAt: '', createdAt: '',
  });

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Fee Tiers"
        sub="Configure maker/taker fees per asset class and volume tier"
        action={
          <button
            onClick={() => setEditing(newFee())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Tier
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {fees.map(f => (
            <div key={f.id} className="rounded-2xl border border-white/8 bg-white/3 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center">
                    <Percent className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{f.name}</span>
                      {f.isDefault && <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Default</span>}
                      <span className="text-xs text-white/30 capitalize">{f.assetClass}</span>
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      Vol: ${f.minVolume30d.toLocaleString()} — {f.maxVolume30d ? `$${f.maxVolume30d.toLocaleString()}` : 'Unlimited'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-white/30">Maker</div>
                    <div className="text-sm font-mono text-emerald-400">{fmtPct(f.makerFeeRate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/30">Taker</div>
                    <div className="text-sm font-mono text-amber-400">{fmtPct(f.takerFeeRate)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setEditing({ ...f })} className="p-1.5 rounded-lg bg-white/8 hover:bg-amber-400/20 transition-colors">
                      <Edit3 className="w-3.5 h-3.5 text-white/50" />
                    </button>
                    <button
                      onClick={() => deleteFee(f.id, f.name)}
                      disabled={deleting === f.id || f.isDefault}
                      className="p-1.5 rounded-lg bg-white/8 hover:bg-red-400/20 transition-colors disabled:opacity-30"
                    >
                      {deleting === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5 text-white/50" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{editing.id ? 'Edit' : 'New'} Fee Tier</h3>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Tier Name</label>
                  <input type="text" value={editing.name}
                    onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Asset Class</label>
                  <select value={editing.assetClass}
                    onChange={e => setEditing(prev => prev ? { ...prev, assetClass: e.target.value } : prev)}
                    className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="all">All</option>
                    <option value="crypto">Crypto</option>
                    <option value="forex">Forex</option>
                    <option value="stock">Stock</option>
                    <option value="commodity">Commodity</option>
                    <option value="etf">ETF</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Maker Fee Rate', key: 'makerFeeRate' },
                    { label: 'Taker Fee Rate', key: 'takerFeeRate' },
                    { label: 'Min Volume 30d ($)', key: 'minVolume30d' },
                    { label: 'Max Volume 30d ($)', key: 'maxVolume30d' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-xs text-white/40 mb-1 block">{label}</label>
                      <input type="number" step="0.0001"
                        value={String((editing as unknown as Record<string, unknown>)[key] ?? '')}
                        onChange={e => setEditing(prev => prev ? { ...prev, [key]: e.target.value === '' ? null : parseFloat(e.target.value) } : prev)}
                        className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editing.isDefault}
                    onChange={e => setEditing(prev => prev ? { ...prev, isDefault: e.target.checked } : prev)}
                    className="rounded"
                  />
                  <span className="text-sm text-white/60">Set as default tier</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-xl bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-colors">Cancel</button>
                <button onClick={saveFee} disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab: Spreads ──────────────────────────────────────────────────────────────

function SpreadsTab() {
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trading/markets', { headers: authHeaders() });
      if (res.ok) setMarkets((await res.json()).markets);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveSpread = async (market: MarketConfig) => {
    const newSpread = editing[market.id];
    if (newSpread === undefined) return;
    setSaving(market.id);
    try {
      const res = await fetch('/api/admin/trading/markets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...market, spreadBps: newSpread }),
      });
      if (res.ok) {
        setEditing(prev => { const n = { ...prev }; delete n[market.id]; return n; });
        void load();
      }
    } finally { setSaving(null); }
  };

  const grouped = markets.reduce<Record<string, MarketConfig[]>>((acc, m) => {
    (acc[m.assetClass] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <SectionHeader title="Spread Configuration" sub="Configure bid-ask spread in basis points per market (1 bps = 0.01%)" />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : (
        Object.entries(grouped).map(([cls, mks]) => (
          <div key={cls} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: ASSET_COLORS[cls] ?? '#C9A84C' }} />
              <span className="text-sm font-semibold text-white capitalize">{cls}</span>
              <span className="text-xs text-white/30">{mks.length} markets</span>
            </div>
            <div className="divide-y divide-white/5">
              {mks.map(m => {
                const current = editing[m.id] ?? m.spreadBps;
                const changed  = editing[m.id] !== undefined && editing[m.id] !== m.spreadBps;
                return (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{m.symbol}</div>
                      <div className="text-xs text-white/40">{m.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={500} step={1}
                        value={current}
                        onChange={e => setEditing(prev => ({ ...prev, [m.id]: parseFloat(e.target.value) || 0 }))}
                        className="w-20 bg-white/8 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono text-right focus:outline-none focus:border-amber-400/50"
                      />
                      <span className="text-xs text-white/30 w-8">bps</span>
                      <span className="text-xs text-white/20 w-16">= {(current * 0.01).toFixed(2)}%</span>
                      {changed && (
                        <button
                          onClick={() => saveSpread(m)}
                          disabled={saving === m.id}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {saving === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Tab: Active Traders ───────────────────────────────────────────────────────

function ActiveTradersTab() {
  const [traders, setTraders] = useState<ActiveTrader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [sort, setSort]       = useState<'volume' | 'pnl' | 'positions'>('volume');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trading/active-traders', { headers: authHeaders() });
      if (res.ok) setTraders((await res.json()).traders);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = traders
    .filter(t => !search || t.email.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'volume')    return b.totalVolume - a.totalVolume;
      if (sort === 'pnl')       return (b.unrealisedPnl + b.realisedPnl) - (a.unrealisedPnl + a.realisedPnl);
      return b.openPositions - a.openPositions;
    });

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Active Traders"
        sub={`${traders.length} traders with open positions or recent activity`}
        action={
          <div className="flex items-center gap-2">
            <input
              type="text" placeholder="Search traders…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 text-white/70 focus:outline-none w-40"
            />
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
              className="text-xs bg-white/8 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 focus:outline-none"
            >
              <option value="volume">By Volume</option>
              <option value="pnl">By P&L</option>
              <option value="positions">By Positions</option>
            </select>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">No active traders found</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/8 bg-white/2">
                {['Trader', 'Tier', 'Open Pos', 'Open Orders', 'Trades', 'Volume', 'Unreal. P&L', 'Real. P&L', 'Last Active'].map(h => (
                  <th key={h} className="text-left py-3 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(t => (
                <tr key={t.userId} className="hover:bg-white/3 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-medium text-white">{t.name || t.email}</div>
                    <div className="text-white/30 font-mono">{t.email}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 capitalize">{t.tier}</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-white">{t.openPositions}</td>
                  <td className="py-3 px-3 font-mono text-white/60">{t.openOrders}</td>
                  <td className="py-3 px-3 font-mono text-white/60">{t.totalTrades}</td>
                  <td className="py-3 px-3 font-mono text-white/70">{fmtUSD(t.totalVolume)}</td>
                  <td className={`py-3 px-3 font-mono font-semibold ${pnlColor(t.unrealisedPnl)}`}>{fmtUSD(t.unrealisedPnl)}</td>
                  <td className={`py-3 px-3 font-mono font-semibold ${pnlColor(t.realisedPnl)}`}>{fmtUSD(t.realisedPnl)}</td>
                  <td className="py-3 px-3 text-white/30">{fmtDate(t.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Accounts ─────────────────────────────────────────────────────────────

function AccountsTab({ data }: { data: TradingData }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Group positions by userId
  const byUser = data.openPositions.reduce<Record<string, Position[]>>((acc, p) => {
    (acc[p.userId] ??= []).push(p);
    return acc;
  }, {});

  const userIds = Object.keys(byUser).filter(uid =>
    !search || uid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Trading Accounts"
        sub="Per-user position and order overview"
        action={
          <input type="text" placeholder="Search by user ID…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 text-white/70 focus:outline-none w-44"
          />
        }
      />

      {userIds.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">No trading accounts with open positions</div>
      ) : (
        <div className="space-y-2">
          {userIds.map(uid => {
            const positions = byUser[uid];
            const totalPnl  = positions.reduce((s, p) => s + p.unrealisedPnl, 0);
            const isOpen    = expanded === uid;
            return (
              <div key={uid} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : uid)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-mono text-white">{uid.slice(0, 16)}…</div>
                      <div className="text-xs text-white/40">{positions.length} open position{positions.length > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-sm font-mono font-semibold ${pnlColor(totalPnl)}`}>{fmtUSD(totalPnl)}</div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden border-t border-white/8"
                    >
                      <div className="overflow-x-auto p-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-white/30 border-b border-white/8">
                              {['Symbol', 'Side', 'Qty', 'Entry', 'Current', 'Unreal. P&L', 'Lev', 'Opened'].map(h => (
                                <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {positions.map(p => (
                              <tr key={p.id} className="hover:bg-white/3 transition-colors">
                                <td className="py-2 px-2 font-semibold text-white">{p.symbol}</td>
                                <td className="py-2 px-2">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'}`}>{p.side.toUpperCase()}</span>
                                </td>
                                <td className="py-2 px-2 font-mono text-white/70">{fmt(p.quantity, 4)}</td>
                                <td className="py-2 px-2 font-mono text-white/70">${fmt(p.avgEntryPrice, 4)}</td>
                                <td className="py-2 px-2 font-mono text-white">${fmt(p.currentPrice, 4)}</td>
                                <td className={`py-2 px-2 font-mono font-semibold ${pnlColor(p.unrealisedPnl)}`}>{fmtUSD(p.unrealisedPnl)}</td>
                                <td className="py-2 px-2">
                                  {p.leverage > 1 && <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 text-xs">{p.leverage}x</span>}
                                </td>
                                <td className="py-2 px-2 text-white/30">{fmtDate(p.openedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Freeze / Suspend ─────────────────────────────────────────────────────

function FreezeTab() {
  const [frozen, setFrozen]   = useState(false);
  const [events, setEvents]   = useState<FreezeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [reason, setReason]   = useState('');
  const [showConfirm, setShowConfirm] = useState<'freeze' | 'unfreeze' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trading/freeze', { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setFrozen(d.frozen); setEvents(d.events); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const doAction = async (action: 'freeze' | 'unfreeze') => {
    setActing(true);
    try {
      const res = await fetch('/api/admin/trading/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) { setShowConfirm(null); setReason(''); void load(); }
    } finally { setActing(false); }
  };

  const EVENT_ICONS: Record<string, React.ElementType> = {
    freeze_all: Lock, unfreeze_all: Unlock, suspend_market: Pause, resume_market: Play,
  };
  const EVENT_COLORS: Record<string, string> = {
    freeze_all: 'text-red-400', unfreeze_all: 'text-emerald-400',
    suspend_market: 'text-amber-400', resume_market: 'text-emerald-400',
  };

  return (
    <div className="space-y-6">
      {/* Global freeze control */}
      <div className={`rounded-2xl border p-6 ${frozen ? 'border-red-400/30 bg-red-400/5' : 'border-white/8 bg-white/3'}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${frozen ? 'bg-red-400/20' : 'bg-emerald-400/10'}`}>
              {frozen ? <Lock className="w-6 h-6 text-red-400" /> : <Unlock className="w-6 h-6 text-emerald-400" />}
            </div>
            <div>
              <div className="font-semibold text-white text-base">Global Trading {frozen ? 'FROZEN' : 'Active'}</div>
              <div className="text-sm text-white/40 mt-0.5">
                {frozen ? 'All trading is currently suspended platform-wide' : 'All markets are open and accepting orders'}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {frozen ? (
              <button
                onClick={() => setShowConfirm('unfreeze')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors"
              >
                <Unlock className="w-4 h-4" /> Unfreeze Trading
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm('freeze')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-400 transition-colors"
              >
                <Lock className="w-4 h-4" /> Freeze All Trading
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowConfirm(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                {showConfirm === 'freeze'
                  ? <Lock className="w-5 h-5 text-red-400" />
                  : <Unlock className="w-5 h-5 text-emerald-400" />
                }
                <h3 className="font-semibold text-white">
                  {showConfirm === 'freeze' ? 'Freeze All Trading' : 'Unfreeze Trading'}
                </h3>
              </div>
              {showConfirm === 'freeze' && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/8 p-3 text-xs text-red-300">
                  This will immediately halt all order placement and position opening platform-wide. Existing positions remain open.
                </div>
              )}
              <div>
                <label className="text-xs text-white/40 mb-1 block">Reason (required)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder={showConfirm === 'freeze' ? 'e.g. Emergency maintenance, market circuit breaker' : 'e.g. Maintenance complete, normal operations resumed'}
                  className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(null)} className="flex-1 py-2 rounded-xl bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-colors">Cancel</button>
                <button
                  onClick={() => doAction(showConfirm)}
                  disabled={acting || !reason.trim()}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    showConfirm === 'freeze' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  }`}
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirm {showConfirm === 'freeze' ? 'Freeze' : 'Unfreeze'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event history */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <SectionHeader title="Freeze / Suspend History" sub="Last 50 events" />
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-amber-400 animate-spin" /></div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-white/30 text-sm">No freeze events recorded</div>
        ) : (
          <div className="space-y-2">
            {events.map(ev => {
              const Icon = EVENT_ICONS[ev.type] ?? AlertCircle;
              const color = EVENT_COLORS[ev.type] ?? 'text-white/50';
              return (
                <div key={ev.id} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium ${color}`}>{ev.type.replace(/_/g, ' ').toUpperCase()}</span>
                      {ev.targetSymbol && <span className="text-xs text-white/50 font-mono">{ev.targetSymbol}</span>}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{ev.reason}</div>
                    <div className="text-xs text-white/20 mt-0.5">{ev.adminEmail} · {fmtDate(ev.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Logs ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs]       = useState<TradingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trading/logs', { headers: authHeaders() });
      if (res.ok) setLogs((await res.json()).logs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.category === filter);

  const CATEGORY_COLORS: Record<string, string> = {
    market: 'text-amber-400 bg-amber-400/10',
    fee: 'text-purple-400 bg-purple-400/10',
    provider: 'text-blue-400 bg-blue-400/10',
    freeze: 'text-red-400 bg-red-400/10',
    account: 'text-emerald-400 bg-emerald-400/10',
    config: 'text-white/50 bg-white/8',
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Admin Action Log"
        sub="Audit trail of all trading administration actions"
        action={
          <div className="flex items-center gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="text-xs bg-white/8 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="market">Market</option>
              <option value="fee">Fee</option>
              <option value="provider">Provider</option>
              <option value="freeze">Freeze</option>
              <option value="account">Account</option>
            </select>
            <button onClick={load} className="p-1.5 rounded-lg bg-white/8 hover:bg-white/12 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">No log entries found</div>
      ) : (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="divide-y divide-white/5">
            {filtered.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                <FileText className="w-4 h-4 text-white/20 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${CATEGORY_COLORS[log.category] ?? 'text-white/40 bg-white/5'}`}>
                      {log.category}
                    </span>
                    <span className="text-xs font-mono text-white/60">{log.action.replace(/_/g, ' ')}</span>
                    {log.targetLabel && <span className="text-xs text-white/40">{log.targetLabel}</span>}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5 truncate">{log.details}</div>
                  <div className="text-xs text-white/20 mt-0.5">{log.adminEmail} · {log.ip} · {fmtDate(log.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Analytics ────────────────────────────────────────────────────────────

function AnalyticsTab({ data }: { data: TradingData }) {
  // Volume by asset class
  const volumeByClass = data.recentTrades.reduce<Record<string, number>>((acc, t) => {
    // Infer asset class from symbol
    const cls = t.symbol.includes('/') ? (t.symbol.includes('USD') && !t.symbol.startsWith('XAU') && !t.symbol.startsWith('XAG') ? 'forex' : 'commodity') :
                t.symbol.endsWith('USDT') || t.symbol.endsWith('USD') ? 'crypto' : 'stock';
    acc[cls] = (acc[cls] ?? 0) + t.price * t.quantity;
    return acc;
  }, {});

  const totalVol = Object.values(volumeByClass).reduce((s, v) => s + v, 0) || 1;

  // Fee revenue by day (last 7 days)
  const now = Date.now();
  const dayMs = 86_400_000;
  const feeByDay = Array.from({ length: 7 }, (_, i) => {
    const dayStart = now - (6 - i) * dayMs;
    const dayEnd   = dayStart + dayMs;
    const fees = data.recentTrades
      .filter(t => { const ts = new Date(t.executedAt).getTime(); return ts >= dayStart && ts < dayEnd; })
      .reduce((s, t) => s + t.fee, 0);
    return {
      label: new Date(dayStart).toLocaleDateString('en-US', { weekday: 'short' }),
      fees,
    };
  });
  const maxFee = Math.max(...feeByDay.map(d => d.fees), 1);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Volume"    value={fmtUSD(data.summary.totalVolume)}   sub="All time"         icon={Activity}   color="#C9A84C" />
        <KpiCard label="Total Fees"      value={fmtUSD(data.summary.totalFees)}     sub="Collected"        icon={DollarSign} color="#9945FF" />
        <KpiCard label="Total Trades"    value={String(data.summary.totalTrades)}   sub="Executed"         icon={BarChart2}  color="#627EEA" />
        <KpiCard label="Avg Trade Size"  value={data.summary.totalTrades > 0 ? fmtUSD(data.summary.totalVolume / data.summary.totalTrades) : '$0'} sub="Per trade" icon={TrendingUp} color="#10B981" />
      </div>

      {/* Volume by asset class */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <SectionHeader title="Volume by Asset Class" sub="Based on recent trade history" />
        <div className="space-y-3">
          {Object.entries(volumeByClass).sort((a, b) => b[1] - a[1]).map(([cls, vol]) => (
            <div key={cls} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ASSET_COLORS[cls] ?? '#C9A84C' }} />
              <span className="text-sm capitalize text-white/70 w-20 shrink-0">{cls}</span>
              <div className="flex-1 h-2.5 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(vol / totalVol) * 100}%`, background: ASSET_COLORS[cls] ?? '#C9A84C' }} />
              </div>
              <span className="text-xs font-mono text-white/50 w-20 text-right">{fmtUSD(vol)}</span>
              <span className="text-xs text-white/30 w-10 text-right">{((vol / totalVol) * 100).toFixed(1)}%</span>
            </div>
          ))}
          {Object.keys(volumeByClass).length === 0 && (
            <div className="text-center text-white/30 text-sm py-4">No trade data available</div>
          )}
        </div>
      </div>

      {/* Fee revenue chart */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <SectionHeader title="Fee Revenue — Last 7 Days" sub="Daily fee collection" />
        <div className="flex items-end gap-2 h-32">
          {feeByDay.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{
                    height: `${Math.max((d.fees / maxFee) * 100, d.fees > 0 ? 4 : 0)}%`,
                    background: 'linear-gradient(to top, #C9A84C, #F0D080)',
                    opacity: d.fees > 0 ? 1 : 0.2,
                  }}
                />
              </div>
              <span className="text-xs text-white/30">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-white/30">
          <span>Total 7d: {fmtUSD(feeByDay.reduce((s, d) => s + d.fees, 0))}</span>
          <span>Avg/day: {fmtUSD(feeByDay.reduce((s, d) => s + d.fees, 0) / 7)}</span>
        </div>
      </div>

      {/* Top markets by volume */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <SectionHeader title="Top Markets by Volume" sub="From recent trades" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/8">
                {['Symbol', 'Name', 'Class', 'Price', '24h Change', 'Volume'].map(h => (
                  <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.markets.map(m => (
                <tr key={m.symbol} className="hover:bg-white/3 transition-colors">
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: ASSET_COLORS[m.assetClass] ?? '#C9A84C' }} />
                      <span className="font-semibold text-white">{m.symbol}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-white/50">{m.name}</td>
                  <td className="py-2.5 px-2 capitalize text-white/40">{m.assetClass}</td>
                  <td className="py-2.5 px-2 font-mono text-white">${m.price.toLocaleString()}</td>
                  <td className={`py-2.5 px-2 font-mono font-semibold ${m.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.change24h >= 0 ? '+' : ''}{m.change24h.toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-2 font-mono text-white/40">
                    ${m.volume24h >= 1_000_000 ? `${(m.volume24h / 1_000_000).toFixed(1)}M` : `${(m.volume24h / 1_000).toFixed(0)}K`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Risk ─────────────────────────────────────────────────────────────────

function RiskTab({ data }: { data: TradingData }) {
  // Also flag high-leverage positions
  const highLeverage = data.openPositions.filter(p => p.leverage >= 5);

  return (
    <div className="space-y-6">
      {/* High-loss positions */}
      <div>
        <SectionHeader
          title="High-Loss Positions"
          sub="Positions with >20% unrealised loss against cost basis"
        />
        {data.riskFlags.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-white/8 bg-white/3">
            <CheckCircle className="w-10 h-10 text-emerald-400/40 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No risk flags — all positions within normal parameters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.riskFlags.map(p => {
              const cost    = p.avgEntryPrice * p.quantity;
              const lossPct = cost > 0 ? (p.unrealisedPnl / cost) * 100 : 0;
              return (
                <div key={p.id} className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{p.symbol}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${p.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'}`}>{p.side.toUpperCase()}</span>
                          {p.leverage > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400">{p.leverage}x</span>}
                        </div>
                        <div className="text-xs text-white/40 mt-0.5">User: {p.userId.slice(0, 16)}…</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold text-red-400">{fmtUSD(p.unrealisedPnl)}</div>
                      <div className="text-xs text-red-400/70">{lossPct.toFixed(1)}% loss</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div><div className="text-white/30">Quantity</div><div className="text-white font-mono mt-0.5">{fmt(p.quantity, 4)}</div></div>
                    <div><div className="text-white/30">Entry Price</div><div className="text-white font-mono mt-0.5">${fmt(p.avgEntryPrice, 4)}</div></div>
                    <div><div className="text-white/30">Current Price</div><div className="text-white font-mono mt-0.5">${fmt(p.currentPrice, 4)}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* High-leverage positions */}
      <div>
        <SectionHeader
          title="High-Leverage Positions"
          sub="Positions with 5x leverage or higher"
        />
        {highLeverage.length === 0 ? (
          <div className="py-8 text-center rounded-2xl border border-white/8 bg-white/3">
            <p className="text-white/30 text-sm">No high-leverage positions open</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/8 bg-white/2">
                  {['User', 'Symbol', 'Side', 'Qty', 'Entry', 'Current', 'Unreal. P&L', 'Leverage', 'Opened'].map(h => (
                    <th key={h} className="text-left py-3 px-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {highLeverage.map(p => (
                  <tr key={p.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-white/50">{p.userId.slice(0, 8)}…</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{p.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.side === 'buy' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'}`}>{p.side.toUpperCase()}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-white/70">{fmt(p.quantity, 4)}</td>
                    <td className="py-2.5 px-3 font-mono text-white/70">${fmt(p.avgEntryPrice, 4)}</td>
                    <td className="py-2.5 px-3 font-mono text-white">${fmt(p.currentPrice, 4)}</td>
                    <td className={`py-2.5 px-3 font-mono font-semibold ${pnlColor(p.unrealisedPnl)}`}>{fmtUSD(p.unrealisedPnl)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.leverage >= 10 ? 'bg-red-400/15 text-red-400' : 'bg-amber-400/15 text-amber-400'}`}>{p.leverage}x</span>
                    </td>
                    <td className="py-2.5 px-3 text-white/30">{fmtDate(p.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'markets' | 'providers' | 'fees' | 'spreads' | 'traders' | 'accounts' | 'freeze' | 'logs' | 'analytics' | 'risk';

export default function AdminTradingPage() {
  const [data, setData]         = useState<TradingData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/trading', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load trading data');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => void load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const TABS: { key: TabKey; label: string; icon: React.ElementType; count?: number; alert?: boolean }[] = [
    { key: 'overview',   label: 'Overview',        icon: BarChart2 },
    { key: 'markets',    label: 'Markets',          icon: Globe },
    { key: 'providers',  label: 'Providers',        icon: Server },
    { key: 'fees',       label: 'Fees',             icon: Percent },
    { key: 'spreads',    label: 'Spreads',          icon: ArrowUpDown },
    { key: 'traders',    label: 'Active Traders',   icon: Users,      count: data?.summary.activeTraders },
    { key: 'accounts',   label: 'Accounts',         icon: Layers,     count: data?.openPositions.length },
    { key: 'freeze',     label: 'Freeze / Suspend', icon: Lock },
    { key: 'logs',       label: 'Logs',             icon: FileText },
    { key: 'analytics',  label: 'Analytics',        icon: TrendingUp },
    { key: 'risk',       label: 'Risk',             icon: ShieldAlert, count: data?.riskFlags.length, alert: (data?.riskFlags.length ?? 0) > 0 },
  ];

  return (
    <>
      <Helmet>
        <title>Trading Administration — City Gate Capital Admin</title>
        <meta name="description" content="Full trading administration: markets, providers, fees, spreads, freeze controls, risk monitoring." />
        <link rel="canonical" href="https://citygate.capital/admin/trading" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <AdminLayout>
        <h1 className="sr-only">Trading Administration</h1>

        <div className="space-y-6">
          {/* Page header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                Trading Administration
              </h2>
              <p className="text-sm text-white/40 mt-1">Markets, providers, fees, risk monitoring, and platform controls</p>
            </div>
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/8 p-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
              <button onClick={() => void load()} className="ml-auto text-xs text-red-400 underline">Retry</button>
            </div>
          )}

          {!loading && (
            <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
              {/* Tab bar */}
              <div className="flex overflow-x-auto border-b border-white/8 scrollbar-none">
                {TABS.map(({ key, label, icon: Icon, count, alert }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all shrink-0 ${
                      activeTab === key
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-white/40 hover:text-white/70'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {count !== undefined && count > 0 && (
                      <span className={`text-xs px-1.5 rounded-full ${
                        alert ? 'bg-red-400/20 text-red-400' :
                        activeTab === key ? 'bg-amber-400/20 text-amber-400' : 'bg-white/8 text-white/30'
                      }`}>{count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {activeTab === 'overview'  && data && <OverviewTab data={data} onTabChange={k => setActiveTab(k as TabKey)} />}
                    {activeTab === 'markets'   && <MarketsTab />}
                    {activeTab === 'providers' && <ProvidersTab />}
                    {activeTab === 'fees'      && <FeesTab />}
                    {activeTab === 'spreads'   && <SpreadsTab />}
                    {activeTab === 'traders'   && <ActiveTradersTab />}
                    {activeTab === 'accounts'  && data && <AccountsTab data={data} />}
                    {activeTab === 'freeze'    && <FreezeTab />}
                    {activeTab === 'logs'      && <LogsTab />}
                    {activeTab === 'analytics' && data && <AnalyticsTab data={data} />}
                    {activeTab === 'risk'      && data && <RiskTab data={data} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </>
  );
}
