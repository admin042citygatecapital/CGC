import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useRef, useMemo, useCallback, type ElementType } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut, CreditCard, ArrowUpRight, ArrowDownLeft, Globe,
  TrendingUp, TrendingDown, Shield, Bell, Settings, ChevronRight,
  Wallet, RefreshCw, Send, DollarSign, Loader2, CheckCheck, Camera,
  ShieldCheck, BadgeCheck, Clock, XCircle, Snowflake, Eye, EyeOff,
  Zap, Plus, ChevronLeft, BarChart2, Activity,
  Lock, Fingerprint, Moon, Sun, Languages, Key, X,
  TrendingUp as TrendUp, Info, CreditCard as CardIcon,
  History, FileText, FileWarning, User, Users, Smartphone, MessageCircle,
  Target,
} from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';
import CgcLogo from '@/components/CgcLogo';
import { CurrencyMark } from '@/components/CurrencyMark';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id:        string;
  title:     string;
  message:   string;
  link?:     string;
  read:      boolean;
  createdAt: string;
  category?: 'transfer' | 'card' | 'security' | 'system';
}

interface Tx {
  id:          string;
  type:        string;
  status:      string;
  amount:      number;
  currency:    string;
  description: string;
  reference:   string;
  createdAt:   string;
}

interface CurrencyBalance {
  currency:      string;
  amount:        number;
  usdEquivalent: number;
}

interface BalanceData {
  primaryCurrency: string;
  primaryAmount:   number;
  totalUsd:        number;
  currencies:      CurrencyBalance[];
  storedBalance:   number;
}

interface VirtualCard {
  id:             string;
  cardholderName: string;
  numberMasked:   string;
  numberFull:     string;
  expiry:         string;
  cvv:            string;
  network:        string;
  status:         string;
  createdAt:      string;
}

// ── Country flags for currencies ──────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function txMeta(type: string): { Icon: ElementType; color: string } {
  switch (type) {
    case 'transfer':
    case 'wire_transfer':    return { Icon: Send,          color: '#C9A84C' };
    case 'crypto_buy':
    case 'crypto_sell':      return { Icon: RefreshCw,     color: '#627EEA' };
    case 'deposit':
    case 'manual_credit':
    case 'refund':           return { Icon: ArrowDownLeft, color: '#10B981' };
    case 'withdrawal':
    case 'manual_debit':
    case 'fee':              return { Icon: ArrowUpRight,  color: '#EF4444' };
    default:                 return { Icon: DollarSign,    color: '#C9A84C' };
  }
}

function isCredit(type: string): boolean {
  return ['deposit', 'manual_credit', 'refund', 'crypto_sell'].includes(type);
}

function fmtCurrency(amount: number, currency: string): string {
  try {
    return amount.toLocaleString('en-US', {
      style: 'currency', currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const CURRENCY_COLORS: Record<string, string> = {
  USD: '#C9A84C', EUR: '#627EEA', GBP: '#10B981', BTC: '#F7931A',
  ETH: '#627EEA', USDT: '#26A17B', BNB: '#F3BA2F', SOL: '#9945FF',
  CHF: '#EF4444', CAD: '#FF6B35', AUD: '#00B4D8', JPY: '#FF6B9D',
  SGD: '#4ECDC4', AED: '#45B7D1',
};

const CRYPTO_CURRENCIES = new Set(['BTC', 'ETH', 'USDT', 'BNB', 'SOL']);

// Quick actions — all routes stay within the authenticated /dashboard/* tree
const QUICK_ACTIONS = [
  { icon: Send,          label: 'Send',         href: '/dashboard/transfers',     color: '#C9A84C' },
  { icon: ArrowDownLeft, label: 'Deposit',      href: '/dashboard/deposits',      color: '#10B981' },
  { icon: Globe,         label: 'Exchange',     href: '/dashboard/exchange',      color: '#627EEA' },
  { icon: CreditCard,    label: 'Cards',        href: '/dashboard/cards',         color: '#9945FF' },
  { icon: BarChart2,     label: 'Trade',        href: '/dashboard/trading',       color: '#F7931A' },
  { icon: Shield,        label: 'Security',     href: '/dashboard/security',      color: '#F7931A' },
];

// ── Privacy mask component ────────────────────────────────────────────────────

function PrivacyValue({ value, privacy, className = '' }: { value: string; privacy: boolean; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {privacy ? (
        <motion.span
          key="masked"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.2 }}
          className={`font-mono tracking-widest select-none ${className}`}
        >
          ••••••
        </motion.span>
      ) : (
        <motion.span
          key="visible"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {value}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, color, height = 40 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120; const h = height;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const first = pts[0].split(',');
  const last  = pts[pts.length - 1].split(',');
  const area  = `M${first[0]},${h} L${polyline} L${last[0]},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={polyline} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Portfolio bar ─────────────────────────────────────────────────────────────

function PortfolioBar({ currencies, totalUsd, privacy }: { currencies: CurrencyBalance[]; totalUsd: number; privacy: boolean }) {
  const top = currencies.slice(0, 6);
  const otherUsd = currencies.slice(6).reduce((s, c) => s + c.usdEquivalent, 0);
  const segments = [
    ...top.map(c => ({ label: c.currency, usd: c.usdEquivalent, color: CURRENCY_COLORS[c.currency] ?? '#888' })),
    ...(otherUsd > 0 ? [{ label: 'Other', usd: otherUsd, color: '#444' }] : []),
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map(s => (
          <div key={s.label} className="h-full rounded-full transition-all"
            style={{ width: `${(s.usd / totalUsd) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {segments.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-foreground/50">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <PrivacyValue value={fmtCompact(s.usd)} privacy={privacy} className="text-xs text-foreground/70 font-medium" />
              <span className="text-[10px] text-foreground/30 w-8 text-right">
                {((s.usd / totalUsd) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notification category helper ──────────────────────────────────────────────

function inferCategory(n: Notification): 'transfer' | 'card' | 'security' | 'system' {
  if (n.category) return n.category;
  const t = (n.title + ' ' + n.message).toLowerCase();
  if (t.includes('transfer') || t.includes('send') || t.includes('deposit') || t.includes('withdraw')) return 'transfer';
  if (t.includes('card') || t.includes('virtual')) return 'card';
  if (t.includes('security') || t.includes('login') || t.includes('password') || t.includes('2fa')) return 'security';
  return 'system';
}

const NOTIF_CATEGORY_ICONS: Record<string, ElementType> = {
  transfer: Send,
  card:     CardIcon,
  security: Shield,
  system:   Info,
};

const NOTIF_CATEGORY_COLORS: Record<string, string> = {
  transfer: '#C9A84C',
  card:     '#9945FF',
  security: '#EF4444',
  system:   '#627EEA',
};

// ── Settings panel ────────────────────────────────────────────────────────────

interface SettingsState {
  privacyMode:    boolean;
  darkMode:       boolean;
  language:       string;
  currency:       string;
  biometric:      boolean;
}

const LANGUAGES = ['English', 'French', 'Spanish', 'Arabic', 'Portuguese'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'AED', 'CAD', 'AUD'];

function SettingsPanel({
  open, onClose, settings, onUpdate, onChangePassword, onLogout,
}: {
  open: boolean;
  onClose: () => void;
  settings: SettingsState;
  onUpdate: (patch: Partial<SettingsState>) => void;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: 320 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 320 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 flex flex-col border-l border-white/8 overflow-y-auto"
            style={{ background: 'rgba(10,10,10,0.98)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
              <div className="flex items-center gap-2.5">
                <Settings size={15} style={{ color: '#C9A84C' }} />
                <span className="text-sm font-semibold text-foreground">Settings</span>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
                <X size={13} />
              </button>
            </div>

            <div className="flex-1 px-5 py-4 flex flex-col gap-1">

              {/* Section: Preferences */}
              <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em] mb-2 mt-1">Preferences</p>

              {/* Privacy Mode */}
              <SettingsRow
                icon={settings.privacyMode ? EyeOff : Eye}
                label="Privacy Mode"
                sub="Hide all monetary values"
                checked={settings.privacyMode}
                onChange={v => onUpdate({ privacyMode: v })}
              />

              {/* Dark Mode */}
              <SettingsRow
                icon={settings.darkMode ? Moon : Sun}
                label="Dark Mode"
                sub="Always-on dark theme"
                checked={settings.darkMode}
                onChange={v => onUpdate({ darkMode: v })}
              />

              {/* Language */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Languages size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Language</p>
                  <p className="text-[10px] text-foreground/30">Display language</p>
                </div>
                <select
                  value={settings.language}
                  onChange={e => onUpdate({ language: e.target.value })}
                  className="text-xs text-foreground/60 bg-transparent border-none outline-none cursor-pointer"
                >
                  {LANGUAGES.map(l => <option key={l} value={l} style={{ background: '#0a0a0a' }}>{l}</option>)}
                </select>
              </div>

              {/* Currency */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <DollarSign size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Display Currency</p>
                  <p className="text-[10px] text-foreground/30">Default currency</p>
                </div>
                <select
                  value={settings.currency}
                  onChange={e => onUpdate({ currency: e.target.value })}
                  className="text-xs text-foreground/60 bg-transparent border-none outline-none cursor-pointer"
                >
                  {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a' }}>{c}</option>)}
                </select>
              </div>

              {/* Section: Security */}
              <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-[0.12em] mb-2 mt-4">Security</p>

              {/* Biometric */}
              <SettingsRow
                icon={Fingerprint}
                label="Biometric Interface"
                sub="Interface setting; native login is not currently active"
                checked={settings.biometric}
                onChange={v => onUpdate({ biometric: v })}
              />

              {/* Change Password */}
              <button
                onClick={onChangePassword}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors w-full text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Key size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Change Password</p>
                  <p className="text-[10px] text-foreground/30">Update your password</p>
                </div>
                <ChevronRight size={12} className="text-foreground/20" />
              </button>

              {/* Security Centre */}
              <Link
                to="/dashboard/security"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Shield size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Security Centre</p>
                  <p className="text-[10px] text-foreground/30">2FA, sessions & alerts</p>
                </div>
                <ChevronRight size={12} className="text-foreground/20" />
              </Link>

              {/* Beneficiaries */}
              <Link
                to="/dashboard/beneficiaries"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Users size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Beneficiaries</p>
                  <p className="text-[10px] text-foreground/30">Saved recipients</p>
                </div>
                <ChevronRight size={12} className="text-foreground/20" />
              </Link>

              {/* Currency Exchange */}
              <Link
                to="/dashboard/exchange"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Globe size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Currency Exchange</p>
                  <p className="text-[10px] text-foreground/30">Flags, rates & converter</p>
                </div>
                <ChevronRight size={12} className="text-foreground/20" />
              </Link>

              {/* Profile */}
              <Link
                to="/dashboard/profile"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Lock size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">My Profile</p>
                  <p className="text-[10px] text-foreground/30">Personal information</p>
                </div>
                <ChevronRight size={12} className="text-foreground/20" />
              </Link>

              {/* All Settings */}
              <Link
                to="/dashboard/settings"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
                  <Settings size={13} className="text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">All Settings</p>
                  <p className="text-[10px] text-foreground/30">Preferences & account</p>
                </div>
                <ChevronRight size={12} className="text-foreground/20" />
              </Link>

              {/* Logout */}
              <div className="mt-auto pt-6">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-500/8 transition-colors w-full text-left group"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-500/8 border border-red-500/12 flex items-center justify-center shrink-0">
                    <LogOut size={13} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-red-400">Log Out</p>
                    <p className="text-[10px] text-foreground/30">End your session</p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SettingsRow({
  icon: Icon, label, sub, checked, onChange,
}: { icon: ElementType; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors w-full text-left"
    >
      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/6 flex items-center justify-center shrink-0">
        <Icon size={13} className="text-foreground/40" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        <p className="text-[10px] text-foreground/30">{sub}</p>
      </div>
      {/* Toggle */}
      <div
        className="relative w-9 h-5 rounded-full transition-all shrink-0"
        style={{ background: checked ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)' }}
      >
        <motion.div
          animate={{ x: checked ? 16 : 2 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-0.5 w-4 h-4 rounded-full"
          style={{ background: checked ? '#C9A84C' : 'rgba(255,255,255,0.3)' }}
        />
      </div>
    </button>
  );
}

// ── Wallet Tx History Modal ───────────────────────────────────────────────────

function WalletTxModal({
  currency, txList, privacy, onClose,
}: { currency: string; txList: Tx[]; privacy: boolean; onClose: () => void }) {
  const filtered = txList.filter(t => t.currency === currency).slice(0, 20);
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-full max-w-md rounded-3xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(12,12,12,0.99)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <div className="flex items-center gap-2.5">
              <CurrencyMark currency={currency} size={28} />
              <div>
                <p className="text-sm font-semibold text-foreground">{currency} Transactions</p>
                <p className="text-[10px] text-foreground/30">{filtered.length} recent entries</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors">
              <X size={13} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-foreground/25">
                <History size={20} />
                <p className="text-xs">No {currency} transactions yet</p>
              </div>
            ) : filtered.map((tx, i) => {
              const { Icon, color } = txMeta(tx.type);
              const positive = isCredit(tx.type);
              return (
                <div key={tx.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-white/[0.025] transition-colors ${i < filtered.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground/80 truncate">
                      {tx.description || tx.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    <p className="text-[10px] text-foreground/30">
                      {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <PrivacyValue
                    value={`${positive ? '+' : '−'}${fmtCurrency(Math.abs(Number(tx.amount ?? 0)), tx.currency ?? 'USD')}`}
                    privacy={privacy}
                    className={`text-xs font-semibold tabular-nums ${positive ? 'text-emerald-400' : 'text-foreground/60'}`}
                  />
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { customer, token, loading, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const isPreview = import.meta.env.VITE_PLATFORM_MODE !== 'live';

  // ── Privacy mode (localStorage-persisted) ────────────────────────────────────
  const [privacy, setPrivacy] = useState<boolean>(false);
  useEffect(() => {
    const stored = localStorage.getItem('cgc_privacy_mode');
    if (stored === 'true') setPrivacy(true);
  }, []);
  const togglePrivacy = useCallback(() => {
    setPrivacy(p => {
      const next = !p;
      localStorage.setItem('cgc_privacy_mode', String(next));
      return next;
    });
  }, []);

  // ── Settings panel ────────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashSettings, setDashSettings] = useState<SettingsState>(() => {
    try {
      const raw = localStorage.getItem('cgc_dash_settings');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { privacyMode: false, darkMode: true, language: 'English', currency: 'USD', biometric: false };
  });

  const updateSettings = useCallback((patch: Partial<SettingsState>) => {
    setDashSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('cgc_dash_settings', JSON.stringify(next));
      // Sync privacy mode with the main privacy toggle
      if ('privacyMode' in patch) {
        setPrivacy(patch.privacyMode!);
        localStorage.setItem('cgc_privacy_mode', String(patch.privacyMode));
      }
      return next;
    });
  }, []);

  // Keep settings panel privacy in sync with the header toggle
  useEffect(() => {
    setDashSettings(prev => ({ ...prev, privacyMode: privacy }));
  }, [privacy]);

  // Transactions
  const [recentTx,  setRecentTx]  = useState<Tx[]>([]);
  const [allTx,     setAllTx]     = useState<Tx[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  // Balance
  const [balanceData,    setBalanceData]    = useState<BalanceData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null);

  // Notifications
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [unreadCount,      setUnreadCount]      = useState(0);
  const [bellOpen,         setBellOpen]         = useState(false);
  const [notifFilter,      setNotifFilter]      = useState<'all' | 'transfer' | 'card' | 'security' | 'system'>('all');
  const bellRef = useRef<HTMLDivElement>(null);

  // Virtual cards
  const [cards,        setCards]        = useState<VirtualCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [activeCard,   setActiveCard]   = useState(0);
  const [revealedCvv,  setRevealedCvv]  = useState<string | null>(null);
  const [revealedNum,  setRevealedNum]  = useState<string | null>(null);
  const [freezingId,   setFreezingId]   = useState<string | null>(null);

  // Wallet tx modal — kept for backwards compat but navigation now goes to /dashboard/wallets
  const [walletTxCurrency, setWalletTxCurrency] = useState<string | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!loading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, loading, navigate]);

  useEffect(() => {
    if (!token) return;
    setTxLoading(true);
    Promise.all([
      fetch('/api/users/transactions?limit=5',    { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/users/transactions?limit=1000', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([recent, all]) => {
      if (recent?.transactions) setRecentTx(recent.transactions);
      if (all?.transactions)    setAllTx(all.transactions);
    }).catch(() => {}).finally(() => setTxLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setBalanceLoading(true);
    fetch('/api/users/balance', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setBalanceData(data); setLastUpdated(new Date()); } })
      .catch(() => {})
      .finally(() => setBalanceLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/users/notifications?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setNotifications(data.notifications ?? []); setUnreadCount(data.unreadCount ?? 0); }
      }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setCardsLoading(true);
    fetch('/api/users/cards', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cards) setCards(data.cards.filter((c: VirtualCard) => c.status !== 'deleted')); })
      .catch(() => {}).finally(() => setCardsLoading(false));
  }, [token]);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const sparklineValues = useMemo(() => {
    if (allTx.length === 0) return [];
    const sorted = [...allTx].reverse();
    let running = 0;
    const points: number[] = [];
    for (const tx of sorted) {
      if (isCredit(tx.type)) running += Number(tx.amount ?? 0);
      else                   running -= Number(tx.amount ?? 0);
      points.push(Math.max(0, running));
    }
    if (points.length <= 30) return points;
    const step = points.length / 30;
    return Array.from({ length: 30 }, (_, i) => points[Math.floor(i * step)]);
  }, [allTx]);

  const sparklineTrend = useMemo(() => {
    if (sparklineValues.length < 2) return 0;
    const first = sparklineValues[0];
    const last  = sparklineValues[sparklineValues.length - 1];
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [sparklineValues]);

  const fiatBalances   = useMemo(() => (balanceData?.currencies ?? []).filter(c => !CRYPTO_CURRENCIES.has(c.currency)), [balanceData]);
  const cryptoBalances = useMemo(() => (balanceData?.currencies ?? []).filter(c => CRYPTO_CURRENCIES.has(c.currency)),  [balanceData]);

  // Portfolio card derived values
  const todayTx = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return allTx.filter(t => new Date(t.createdAt) >= today);
  }, [allTx]);

  const todayChange = useMemo(() => {
    return todayTx.reduce((sum, t) => {
      const amt = Number(t.amount ?? 0);
      return sum + (isCredit(t.type) ? amt : -amt);
    }, 0);
  }, [todayTx]);

  const monthlyPL = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return allTx
      .filter(t => new Date(t.createdAt) >= monthStart)
      .reduce((sum, t) => {
        const amt = Number(t.amount ?? 0);
        return sum + (isCredit(t.type) ? amt : -amt);
      }, 0);
  }, [allTx]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'all') return notifications;
    return notifications.filter(n => inferCategory(n) === notifFilter);
  }, [notifications, notifFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleBellClick() {
    setBellOpen(o => !o);
    if (!bellOpen && unreadCount > 0 && token) {
      fetch('/api/users/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      }).then(() => {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }).catch(() => {});
    }
  }

  function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    setBellOpen(false);
    if (token) {
      fetch('/api/users/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }

  function handleLogout() {
    setSettingsOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  function handleChangePassword() {
    setSettingsOpen(false);
    navigate('/forgot-password');
  }

  async function handleFreezeToggle(card: VirtualCard) {
    if (!token || freezingId) return;
    setFreezingId(card.id);
    try {
      const res = await fetch('/api/users/cards/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardId: card.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCards(prev => prev.map(c =>
          c.id === card.id ? { ...c, status: data.status ?? (card.status === 'frozen' ? 'active' : 'frozen') } : c
        ));
      }
    } catch { /* silent */ }
    finally { setFreezingId(null); }
  }

  // ── Loading gate ──────────────────────────────────────────────────────────────

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const firstName       = customer.name.split(' ')[0];
  const primaryBalance  = balanceData?.primaryAmount ?? customer.balance ?? 0;
  const primaryCurrency = balanceData?.primaryCurrency ?? 'USD';
  const totalUsd        = balanceData?.totalUsd ?? primaryBalance;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>Dashboard — City Gate Capital</title>
        <meta name="description" content="Manage your City Gate Capital account: view balances, send and receive funds, track transactions, and control your virtual cards." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/dashboard" />
      </Helmet>

      {/* Settings panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={dashSettings}
        onUpdate={updateSettings}
        onChangePassword={handleChangePassword}
        onLogout={handleLogout}
      />

      {/* Wallet tx modal */}
      {walletTxCurrency && (
        <WalletTxModal
          currency={walletTxCurrency}
          txList={allTx}
          privacy={privacy}
          onClose={() => setWalletTxCurrency(null)}
        />
      )}

      <div className="dashboard-accessible min-h-screen bg-background text-foreground">

        {/* ── Top nav ─────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
              <CgcLogo size={32} withWordmark glow imgClassName="h-8 w-auto" />
            </Link>

            {/* Nav links — desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {[
                { label: 'Overview',      href: '/dashboard' },
                { label: 'Wallets',       href: '/dashboard/wallets' },
                { label: 'Transfers',     href: '/dashboard/transfers' },
                { label: 'Cards',         href: '/dashboard/cards' },
                { label: 'Analytics',     href: '/dashboard/analytics' },
                { label: 'Exchange',      href: '/dashboard/exchange' },
                { label: 'Disputes',      href: '/dashboard/disputes' },
              ].map(({ label, href }) => (
                <Link key={label} to={href}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-foreground/50 hover:text-foreground hover:bg-white/5 transition-all">
                  {label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">

              {/* Privacy toggle */}
              <button
                onClick={togglePrivacy}
                className="relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all"
                style={{
                  background: privacy ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                  borderColor: privacy ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)',
                  color: privacy ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                }}
                aria-label={privacy ? 'Disable privacy mode' : 'Enable privacy mode'}
                title={privacy ? 'Privacy mode ON — click to reveal' : 'Privacy mode OFF — click to hide'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {privacy ? (
                    <motion.span key="off" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <EyeOff size={15} />
                    </motion.span>
                  ) : (
                    <motion.span key="on" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Eye size={15} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Bell */}
              <div ref={bellRef} className="relative">
                <button onClick={handleBellClick}
                  className="relative w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors"
                  aria-label="Notifications">
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold text-black flex items-center justify-center"
                      style={{ background: '#C9A84C' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </button>
                <AnimatePresence>
                  {bellOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 w-80 rounded-2xl border border-white/8 shadow-2xl overflow-hidden z-50"
                      style={{ background: 'rgba(12,12,12,0.98)' }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <p className="text-white text-sm font-semibold">Notifications</p>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C' }}>
                              {unreadCount} unread
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Filter tabs */}
                      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 overflow-x-auto">
                        {(['all', 'transfer', 'card', 'security', 'system'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setNotifFilter(f)}
                            className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all capitalize"
                            style={{
                              background: notifFilter === f ? 'rgba(201,168,76,0.15)' : 'transparent',
                              color: notifFilter === f ? '#C9A84C' : 'rgba(255,255,255,0.3)',
                              border: notifFilter === f ? '1px solid rgba(201,168,76,0.25)' : '1px solid transparent',
                            }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>

                      {/* List */}
                      <div className="max-h-72 overflow-y-auto">
                        {filteredNotifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-2 text-foreground/25">
                            <Bell size={20} /><p className="text-xs">No {notifFilter === 'all' ? '' : notifFilter} notifications</p>
                          </div>
                        ) : filteredNotifications.map(n => {
                          const cat = inferCategory(n);
                          const CatIcon = NOTIF_CATEGORY_ICONS[cat];
                          const catColor = NOTIF_CATEGORY_COLORS[cat];
                          return (
                            <div key={n.id}
                              className={`px-4 py-3 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors ${!n.read ? 'bg-primary/[0.04]' : ''}`}>
                              <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                  style={{ background: `${catColor}14`, border: `1px solid ${catColor}22` }}>
                                  <CatIcon size={11} style={{ color: catColor }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-white text-xs font-semibold leading-snug">{n.title}</p>
                                    {!n.read && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#C9A84C' }} />}
                                  </div>
                                  <p className="text-foreground/40 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                                  {n.link && (
                                    <Link to={n.link} onClick={() => setBellOpen(false)}
                                      className="text-[10px] mt-1 inline-block" style={{ color: '#C9A84C' }}>
                                      View details →
                                    </Link>
                                  )}
                                  <p className="text-foreground/20 text-[10px] mt-1">
                                    {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      {notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
                          <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/60 transition-colors">
                            <CheckCheck size={11} /> Mark all read
                          </button>
                          <Link to="/dashboard/notifications" onClick={() => setBellOpen(false)}
                            className="text-xs flex items-center gap-1" style={{ color: '#C9A84C' }}>
                            View all <ChevronRight size={10} />
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 hover:text-foreground transition-colors"
                aria-label="Settings">
                <Settings size={15} />
              </button>

              {/* Avatar */}
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-xs font-bold text-black shrink-0"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                {customer.avatarUrl
                  ? <img src={customer.avatarUrl} alt={customer.name} className="w-full h-full object-cover" />
                  : customer.name.charAt(0).toUpperCase()}
              </div>

              <button onClick={handleLogout}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-foreground/40 hover:text-foreground hover:bg-white/5 transition-colors">
                <LogOut size={13} /> Log out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">

          {/* ── Status banners ─────────────────────────────────────────────── */}
          {/* ── Welcome row ────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                Good day, <span style={{ color: '#C9A84C' }}>{firstName}</span>
              </h1>
              <p className="text-foreground/35 text-xs mt-0.5">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <Link to="/dashboard/transfers"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
              <Send size={13} /> New Transfer
            </Link>
          </motion.div>

          {/* ── MAIN GRID ──────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.03 }}
            aria-labelledby="account-standing-title"
            className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  customer.kycStatus === 'approved' ? 'bg-emerald-500/10' :
                  customer.kycStatus === 'rejected' ? 'bg-red-500/10' : 'bg-primary/10'
                }`}>
                  {customer.kycStatus === 'approved' ? <BadgeCheck size={18} className="text-emerald-400" /> :
                   customer.kycStatus === 'submitted' ? <Clock size={18} className="text-primary" /> :
                   customer.kycStatus === 'rejected' ? <XCircle size={18} className="text-red-400" /> :
                   <ShieldCheck size={18} className="text-primary" />}
                </div>
                <div>
                  <p id="account-standing-title" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/35">Account status</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {customer.kycStatus === 'approved' ? 'Verification recorded' :
                     customer.kycStatus === 'submitted' ? 'Verification assessment in progress' :
                     customer.kycStatus === 'rejected' ? 'Additional verification information required' :
                     'Onboarding information required'}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/40">
                    {customer.kycStatus === 'approved'
                      ? (isPreview ? 'Recorded for this product environment; regulated services remain provider-gated.' : 'Your account standing is current.')
                      : customer.kycStatus === 'submitted'
                      ? 'You can continue using available account features while the assessment is pending.'
                      : 'Complete the requested information to progress your account application.'}
                  </p>
                </div>
              </div>
              {customer.kycStatus !== 'approved' && (
                <Link to="/kyc" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15">
                  {customer.kycStatus === 'submitted' ? 'View verification status' : 'Continue onboarding'}
                  <ChevronRight size={13} />
                </Link>
              )}
            </div>
          </motion.section>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* ── LEFT COLUMN (8 cols) ──────────────────────────────────────── */}
            <div className="xl:col-span-8 flex flex-col gap-5">

              {/* ── Hero balance card ──────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.04 }}
                className="relative rounded-3xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1c1500 0%, #120e00 45%, #0a0a0a 100%)',
                  boxShadow: '0 0 0 1px rgba(201,168,76,0.1), 0 24px 64px rgba(201,168,76,0.06)',
                }}
              >
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 65%)' }} />
                  <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-8"
                    style={{ background: 'radial-gradient(circle, #F0D080 0%, transparent 65%)' }} />
                  <div className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent)' }} />
                </div>

                <div className="relative p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    {/* Balance */}
                    <div className="flex-1">
                      {/* Label + privacy toggle */}
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[11px] font-semibold text-foreground/35 uppercase tracking-[0.15em]">Total Portfolio Value</p>
                        <button
                          onClick={togglePrivacy}
                          className="w-5 h-5 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
                          style={{ color: privacy ? '#C9A84C' : 'rgba(255,255,255,0.25)' }}
                          aria-label="Toggle privacy"
                        >
                          {privacy ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>

                      {balanceLoading ? (
                        <div className="h-12 w-56 rounded-xl bg-white/5 animate-pulse mb-3" />
                      ) : (
                        <div className="flex items-end gap-3 mb-3">
                          <span className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                            <PrivacyValue value={fmtCurrency(primaryBalance, primaryCurrency)} privacy={privacy} />
                          </span>
                          <span className="text-foreground/30 text-sm mb-1.5 font-medium">{primaryCurrency}</span>
                        </div>
                      )}

                      {!balanceLoading && sparklineValues.length > 1 && (
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            sparklineTrend >= 0 ? 'bg-emerald-500/12 text-emerald-400' : 'bg-red-500/12 text-red-400'
                          }`}>
                            {sparklineTrend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {sparklineTrend >= 0 ? '+' : ''}{sparklineTrend.toFixed(1)}% all time
                          </div>
                          <span className="text-foreground/25 text-xs">·</span>
                          <span className="text-foreground/30 text-xs">
                            {balanceData?.currencies?.length ?? 0} active {(balanceData?.currencies?.length ?? 0) === 1 ? 'currency' : 'currencies'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs text-foreground/30">
                          <Shield size={11} className="text-emerald-400" />
                          <span>{isPreview ? 'Sample balances — not customer funds' : 'Protection depends on the account provider and published terms'}</span>
                        </div>
                        <span className="text-foreground/15">·</span>
                        <span className="text-xs text-foreground/30 font-mono">
                          #{customer.id.slice(-8).toUpperCase()}
                        </span>
                        <span className="text-foreground/15">·</span>
                        <span className={`text-xs font-medium ${customer.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {customer.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                    </div>

                    {sparklineValues.length > 1 && (
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <p className="text-[10px] text-foreground/25 uppercase tracking-wider">Balance trend</p>
                        <Sparkline values={sparklineValues} color="#C9A84C" height={52} />
                      </div>
                    )}
                  </div>

                  {primaryCurrency !== 'USD' && !balanceLoading && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-xs text-foreground/30">
                        ≈ <PrivacyValue value={fmtCurrency(totalUsd, 'USD')} privacy={privacy} /> USD equivalent
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── P2: Portfolio Card ─────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }}
                className="rounded-2xl border border-white/6 overflow-hidden"
                style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
              >
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">Portfolio Overview</h2>
                  {lastUpdated && (
                    <span className="text-[10px] text-foreground/25 flex items-center gap-1">
                      <Clock size={9} /> Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04]">
                  {[
                    {
                      label: 'Available Balance',
                      value: fmtCurrency(primaryBalance, primaryCurrency),
                      sub: primaryCurrency,
                      color: '#C9A84C',
                      icon: Wallet,
                    },
                    {
                      label: 'Pending Balance',
                      value: fmtCurrency(
                        allTx.filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.amount ?? 0), 0),
                        'USD'
                      ),
                      sub: 'Awaiting clearance',
                      color: '#F7931A',
                      icon: Clock,
                    },
                    {
                      label: "Today's Change",
                      value: (todayChange >= 0 ? '+' : '') + fmtCurrency(Math.abs(todayChange), 'USD'),
                      sub: todayTx.length + ' transactions',
                      color: todayChange >= 0 ? '#10B981' : '#EF4444',
                      icon: todayChange >= 0 ? TrendingUp : TrendingDown,
                    },
                    {
                      label: 'Monthly P&L',
                      value: (monthlyPL >= 0 ? '+' : '') + fmtCurrency(Math.abs(monthlyPL), 'USD'),
                      sub: new Date().toLocaleDateString('en-GB', { month: 'long' }),
                      color: monthlyPL >= 0 ? '#10B981' : '#EF4444',
                      icon: monthlyPL >= 0 ? TrendUp : TrendingDown,
                    },
                  ].map(({ label, value, sub, color, icon: Icon }) => (
                    <div key={label} className="flex flex-col gap-2 p-4" style={{ background: 'rgba(10,10,10,0.6)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${color}14`, border: `1px solid ${color}22` }}>
                          <Icon size={11} style={{ color }} />
                        </div>
                        <p className="text-[10px] text-foreground/35 leading-tight">{label}</p>
                      </div>
                      <PrivacyValue
                        value={value}
                        privacy={privacy}
                        className="text-sm font-bold text-foreground tabular-nums"
                      />
                      <p className="text-[10px] text-foreground/30">{sub}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Quick actions ──────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
              >
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {QUICK_ACTIONS.map(({ icon: Icon, label, href, color }) => (
                    <Link key={label} to={href}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border border-white/6 hover:border-white/12 transition-all group"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                        style={{ background: `${color}14`, border: `1px solid ${color}28` }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <span className="text-[11px] font-medium text-foreground/50 group-hover:text-foreground/80 transition-colors">{label}</span>
                    </Link>
                  ))}
                </div>
              </motion.div>

              {/* ── P3: Currency wallets (improved) ───────────────────────── */}
              {!balanceLoading && (balanceData?.currencies?.length ?? 0) > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">Currency Wallets</h2>
                    <Link to="/dashboard/wallets" className="text-[11px] flex items-center gap-1 text-foreground/30 hover:text-primary transition-colors">
                      View all <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(balanceData?.currencies ?? []).slice(0, 8).map(c => {
                      const isCrypto = CRYPTO_CURRENCIES.has(c.currency);
                      // Derive locked/pending from tx data
                      const pendingAmt = allTx
                        .filter(t => t.currency === c.currency && t.status === 'pending')
                        .reduce((s, t) => s + Number(t.amount ?? 0), 0);
                      const lockedAmt = allTx
                        .filter(t => t.currency === c.currency && t.status === 'frozen')
                        .reduce((s, t) => s + Number(t.amount ?? 0), 0);
                      return (
                        <motion.button
                          key={c.currency}
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => navigate(`/dashboard/wallets?currency=${c.currency}`)}
                          className="rounded-2xl p-4 border border-white/6 hover:border-white/12 transition-all cursor-pointer text-left w-full"
                          style={{ background: 'rgba(255,255,255,0.02)' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <CurrencyMark currency={c.currency} size={32} />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {isCrypto && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                                  style={{ background: 'rgba(99,126,234,0.12)', color: '#627EEA' }}>
                                  CRYPTO
                                </span>
                              )}
                              <History size={10} className="text-foreground/20" />
                            </div>
                          </div>
                          <PrivacyValue
                            value={c.amount.toLocaleString('en-US', { maximumFractionDigits: isCrypto ? 6 : 2 })}
                            privacy={privacy}
                            className="text-sm font-bold text-foreground block mb-0.5"
                          />
                          <p className="text-[10px] text-foreground/35">{c.currency}</p>
                          <p className="text-[10px] text-foreground/25 mt-1">
                            ≈ <PrivacyValue value={fmtCompact(c.usdEquivalent)} privacy={privacy} />
                          </p>
                          {/* Locked / Pending indicators */}
                          {(lockedAmt > 0 || pendingAmt > 0) && (
                            <div className="mt-2 pt-2 border-t border-white/[0.05] flex flex-col gap-1">
                              {lockedAmt > 0 && (
                                <div className="flex items-center gap-1">
                                  <Lock size={8} className="text-blue-400" />
                                  <span className="text-[9px] text-blue-400">
                                    <PrivacyValue value={`Locked: ${fmtCurrency(lockedAmt, c.currency)}`} privacy={privacy} />
                                  </span>
                                </div>
                              )}
                              {pendingAmt > 0 && (
                                <div className="flex items-center gap-1">
                                  <Clock size={8} className="text-amber-400" />
                                  <span className="text-[9px] text-amber-400">
                                    <PrivacyValue value={`Pending: ${fmtCurrency(pendingAmt, c.currency)}`} privacy={privacy} />
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-[9px] text-foreground/20 mt-2 flex items-center gap-1">
                            <History size={8} /> Tap to view details
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Virtual card ───────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">My Cards</h2>
                  <Link to="/dashboard/cards" className="text-[11px] flex items-center gap-1 transition-colors"
                    style={{ color: '#C9A84C' }}>
                    Manage <ChevronRight size={11} />
                  </Link>
                </div>

                {cardsLoading ? (
                  <div className="h-44 rounded-3xl border border-white/6 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <Loader2 size={18} className="animate-spin text-foreground/25" />
                  </div>
                ) : cards.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/8 p-8 flex flex-col items-center gap-4 text-center"
                    style={{ background: 'rgba(201,168,76,0.02)' }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.18)' }}>
                      <CreditCard size={20} style={{ color: '#C9A84C' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground/60">No cards yet</p>
                      <p className="text-xs text-foreground/30 mt-1">Card issuance is not currently available</p>
                    </div>
                    <Link to="/dashboard/cards"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                      style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.22)' }}>
                      <Plus size={12} /> View Card Interface
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card visual */}
                    <div className="relative">
                      <AnimatePresence mode="wait">
                        {cards[activeCard] && (() => {
                          const card = cards[activeCard];
                          const isFrozen = card.status === 'frozen';
                          return (
                            <motion.div key={card.id}
                              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
                              className="relative rounded-3xl p-5 overflow-hidden select-none"
                              style={{
                                background: isFrozen
                                  ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                                  : 'linear-gradient(135deg, #1c1500 0%, #2a1f00 40%, #1a1200 70%, #0f0c00 100%)',
                                minHeight: '168px',
                                boxShadow: isFrozen
                                  ? '0 16px 48px rgba(0,100,200,0.12), 0 0 0 1px rgba(255,255,255,0.05)'
                                  : '0 16px 48px rgba(201,168,76,0.1), 0 0 0 1px rgba(201,168,76,0.1)',
                              }}
                            >
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20"
                                  style={{ background: isFrozen ? 'radial-gradient(circle, #4488ff 0%, transparent 70%)' : 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />
                                <div className="absolute top-5 left-5 w-9 h-6 rounded-md opacity-55"
                                  style={{ background: 'linear-gradient(135deg, #d4a843 0%, #f0d060 50%, #b8922e 100%)', border: '1px solid rgba(255,255,255,0.18)' }} />
                              </div>
                              {isFrozen && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                  <div className="flex flex-col items-center gap-1 opacity-55">
                                    <Snowflake size={24} className="text-blue-300" />
                                    <span className="text-blue-200 text-[10px] font-semibold tracking-widest uppercase">Frozen</span>
                                  </div>
                                </div>
                              )}
                              <div className="relative flex items-start justify-between mb-6">
                                <div className="mt-0.5 ml-12">
                                  <p className="text-[9px] text-white/35 uppercase tracking-widest">City Gate Capital</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-white/50 text-[10px] font-bold italic tracking-widest uppercase">{card.network || 'VISA'}</span>
                                  <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full opacity-80" style={{ background: '#EB001B' }} />
                                    <div className="w-4 h-4 rounded-full opacity-80 -ml-2" style={{ background: '#F79E1B' }} />
                                  </div>
                                </div>
                              </div>
                              <div className="relative mb-3">
                                <button
                                  onClick={() => !privacy && setRevealedNum(prev => prev === card.id ? null : card.id)}
                                  className="flex items-center gap-2 group"
                                  disabled={privacy}
                                >
                                  <span className="text-white font-mono text-sm tracking-[0.18em]">
                                    {privacy
                                      ? '**** **** **** ' + (card.numberMasked?.slice(-4) ?? '****')
                                      : (revealedNum === card.id ? card.numberFull : card.numberMasked)
                                    }
                                  </span>
                                  {!privacy && (
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      {revealedNum === card.id ? <EyeOff size={11} className="text-white/35" /> : <Eye size={11} className="text-white/35" />}
                                    </span>
                                  )}
                                </button>
                              </div>
                              <div className="relative flex items-end justify-between">
                                <div>
                                  <p className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">Card Holder</p>
                                  <p className="text-white text-[11px] font-semibold tracking-wide">{card.cardholderName}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">Expires</p>
                                  <p className="text-white text-[11px] font-semibold">{card.expiry}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">CVV</p>
                                  <button
                                    onClick={() => !privacy && setRevealedCvv(prev => prev === card.id ? null : card.id)}
                                    className="text-white text-[11px] font-semibold font-mono"
                                    disabled={privacy}
                                  >
                                    {privacy ? '•••' : (revealedCvv === card.id ? card.cvv : '•••')}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })()}
                      </AnimatePresence>

                      {cards.length > 1 && (
                        <div className="flex items-center justify-center gap-1.5 mt-2.5">
                          {cards.map((_, i) => (
                            <button key={i} onClick={() => setActiveCard(i)}
                              className="rounded-full transition-all"
                              style={{ width: i === activeCard ? '18px' : '5px', height: '5px', background: i === activeCard ? '#C9A84C' : 'rgba(255,255,255,0.12)' }} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card actions panel */}
                    {cards[activeCard] && (
                      <div className="flex flex-col gap-3">
                        <div className="rounded-2xl border border-white/6 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <p className="text-[10px] text-foreground/30 uppercase tracking-wider mb-2">Card Details</p>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-foreground/40">Status</span>
                              <span className={`text-xs font-semibold ${cards[activeCard].status === 'active' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                {cards[activeCard].status.charAt(0).toUpperCase() + cards[activeCard].status.slice(1)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-foreground/40">Network</span>
                              <span className="text-xs font-semibold text-foreground/70">{cards[activeCard].network || 'VISA'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-foreground/40">Card Number</span>
                              <span className="text-xs font-mono text-foreground/50">
                                {privacy ? '**** **** **** ' + (cards[activeCard].numberMasked?.slice(-4) ?? '****') : cards[activeCard].numberMasked}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-foreground/40">Issued</span>
                              <span className="text-xs text-foreground/50">
                                {new Date(cards[activeCard].createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button onClick={() => handleFreezeToggle(cards[activeCard])} disabled={!!freezingId}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110 disabled:opacity-50 w-full"
                            style={cards[activeCard].status === 'frozen'
                              ? { background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.22)' }
                              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }
                            }>
                            {freezingId === cards[activeCard].id ? <Loader2 size={12} className="animate-spin" /> : <Snowflake size={12} />}
                            {cards[activeCard].status === 'frozen' ? 'Unfreeze Card' : 'Freeze Card'}
                          </button>
                          <Link to="/dashboard/cards"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all hover:brightness-110 w-full"
                            style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.18)' }}>
                            <Zap size={12} /> Manage Cards
                          </Link>
                        </div>

                        {cards.length > 1 && (
                          <div className="flex items-center justify-between mt-auto">
                            <button onClick={() => setActiveCard(i => Math.max(0, i - 1))} disabled={activeCard === 0}
                              className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center text-foreground/35 hover:text-foreground disabled:opacity-20 transition-colors">
                              <ChevronLeft size={13} />
                            </button>
                            <span className="text-xs text-foreground/25">{activeCard + 1} of {cards.length}</span>
                            <button onClick={() => setActiveCard(i => Math.min(cards.length - 1, i + 1))} disabled={activeCard === cards.length - 1}
                              className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center text-foreground/35 hover:text-foreground disabled:opacity-20 transition-colors">
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* ── Recent transactions ────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">Recent Transactions</h2>
                  <Link to="/dashboard/transfers" className="text-[11px] flex items-center gap-1 text-foreground/30 hover:text-primary transition-colors">
                    View all <ChevronRight size={11} />
                  </Link>
                </div>
                <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  {txLoading ? (
                    <div className="flex items-center justify-center py-10 text-foreground/25">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                  ) : recentTx.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-foreground/25">
                      <Activity size={22} />
                      <p className="text-xs">No transactions yet</p>
                    </div>
                  ) : (
                    recentTx.map((tx, i) => {
                      const { Icon, color } = txMeta(tx.type);
                      const positive = isCredit(tx.type);
                      return (
                        <div key={tx.id}
                          className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors ${i < recentTx.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                            <Icon size={14} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground/80 truncate">
                              {tx.description || tx.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-foreground/30">
                                {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                                tx.status === 'completed' || tx.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                                tx.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                          <PrivacyValue
                            value={`${positive ? '+' : '−'}${fmtCurrency(Math.abs(Number(tx.amount ?? 0)), tx.currency ?? 'USD')}`}
                            privacy={privacy}
                            className={`text-sm font-semibold tabular-nums ${positive ? 'text-emerald-400' : 'text-foreground/60'}`}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>

            {/* ── RIGHT COLUMN (4 cols) ─────────────────────────────────────── */}
            <div className="xl:col-span-4 flex flex-col gap-5">

              {/* ── Profile card ───────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }}
                className="rounded-2xl border border-white/6 p-5"
                style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <label className="relative cursor-pointer group shrink-0">
                    <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center text-sm font-bold text-black"
                      style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                      {customer.avatarUrl
                        ? <img src={customer.avatarUrl} alt={customer.name} className="w-full h-full object-cover" />
                        : customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={11} className="text-white" />
                    </div>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file || !token) return;
                        const reader = new FileReader();
                        reader.onload = async ev => {
                          const b64 = ev.target?.result as string;
                          await fetch('/api/users/avatar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ avatarBase64: b64 }),
                          });
                          window.location.reload();
                        };
                        reader.readAsDataURL(file);
                      }} />
                  </label>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{customer.name}</p>
                    <p className="text-xs text-foreground/35 truncate">{customer.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Account', value: customer.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ok: customer.status === 'active' },
                    { label: 'KYC', value: customer.kycStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ok: customer.kycStatus === 'approved' },
                    { label: 'AML', value: customer.amlStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ok: customer.amlStatus === 'cleared' },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className="rounded-xl p-3 border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-[10px] text-foreground/30 mb-1">{label}</p>
                      <p className={`text-xs font-semibold ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Portfolio breakdown ────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-2xl border border-white/6 p-5"
                style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">Portfolio</h3>
                  <PrivacyValue value={fmtCompact(totalUsd) + ' total'} privacy={privacy} className="text-[11px] text-foreground/25" />
                </div>

                {balanceLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1,2,3].map(i => <div key={i} className="h-4 rounded-lg bg-white/5 animate-pulse" />)}
                  </div>
                ) : (balanceData?.currencies?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-foreground/20">
                    <Wallet size={20} />
                    <p className="text-xs">No balances yet</p>
                  </div>
                ) : (
                  <PortfolioBar currencies={balanceData!.currencies} totalUsd={totalUsd} privacy={privacy} />
                )}
              </motion.div>

              {/* ── Crypto snapshot ────────────────────────────────────────── */}
              {cryptoBalances.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14 }}
                  className="rounded-2xl border border-white/6 p-5"
                  style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">Crypto Holdings</h3>
                    <Link to="/dashboard/wallets" className="text-[11px] text-foreground/25 hover:text-primary transition-colors flex items-center gap-1">
                      Wallet <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {cryptoBalances.map(c => {
                      return (
                        <div key={c.currency} className="flex items-center gap-3">
                          <CurrencyMark currency={c.currency} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground/80">{c.currency}</p>
                            <PrivacyValue
                              value={`${c.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${c.currency}`}
                              privacy={privacy}
                              className="text-[10px] text-foreground/30"
                            />
                          </div>
                          <div className="text-right">
                            <PrivacyValue value={fmtCompact(c.usdEquivalent)} privacy={privacy} className="text-xs font-semibold text-foreground/70" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Fiat snapshot ─────────────────────────────────────────── */}
              {cryptoBalances.length === 0 && fiatBalances.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14 }}
                  className="rounded-2xl border border-white/6 p-5"
                  style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
                >
                  <h3 className="text-[11px] font-semibold text-foreground/40 uppercase tracking-[0.12em] mb-4">Fiat Wallets</h3>
                  <div className="flex flex-col gap-2.5">
                    {fiatBalances.slice(0, 5).map(c => {
                      return (
                        <div key={c.currency} className="flex items-center gap-3">
                          <CurrencyMark currency={c.currency} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground/80">{c.currency}</p>
                          </div>
                          <PrivacyValue
                            value={fmtCurrency(c.amount, c.currency)}
                            privacy={privacy}
                            className="text-xs font-semibold text-foreground/70 tabular-nums"
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Quick nav links ────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}
                className="rounded-2xl border border-white/6 overflow-hidden"
              >
                {[
                  { icon: Wallet,     label: 'My Wallets',        href: '/dashboard/wallets',       sub: 'Multi-currency' },
                  { icon: TrendingUp, label: 'Transfers',          href: '/dashboard/transfers',     sub: 'Send & receive' },
                  { icon: Activity,   label: 'Analytics',          href: '/dashboard/analytics',     sub: 'Spending insights' },
                  { icon: Shield,     label: 'Security',           href: '/dashboard/security',      sub: 'Sessions & alerts' },
                  { icon: FileText,   label: 'Statements',         href: '/dashboard/statements',    sub: 'Export PDF / CSV' },
                  { icon: Users,      label: 'Beneficiaries',      href: '/dashboard/beneficiaries', sub: 'Saved recipients' },
                  { icon: Globe,      label: 'Currency Exchange',  href: '/dashboard/exchange',      sub: 'Flags, rates & converter' },
                  { icon: Smartphone, label: 'Devices',            href: '/dashboard/devices',       sub: 'Trusted devices' },
                  { icon: User,       label: 'My Profile',         href: '/dashboard/profile',       sub: 'Personal info' },
                  { icon: MessageCircle, label: 'Customer Support', href: '/dashboard/support',       sub: 'Tickets & messages' },
                  { icon: FileWarning, label: 'Transaction Disputes', href: '/dashboard/disputes', sub: 'Report & track claims' },
                  { icon: Target,      label: 'Financial Goals',      href: '/dashboard/goals',    sub: 'Targets & progress' },
                ].map(({ icon: Icon, label, href, sub }, i, arr) => (
                  <Link key={label} to={href}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                    <div className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center shrink-0">
                      <Icon size={13} className="text-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground/70">{label}</p>
                      <p className="text-[10px] text-foreground/25">{sub}</p>
                    </div>
                    <ChevronRight size={12} className="text-foreground/20 shrink-0" />
                  </Link>
                ))}
              </motion.div>

              {/* ── Last login + security score ────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22 }}
                className="rounded-2xl border border-white/6 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.01)' }}
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-[11px] font-semibold text-foreground/35 uppercase tracking-[0.12em]">Account Status</p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center shrink-0">
                      <Clock size={13} className="text-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/40">Last Login</p>
                      <p className="text-xs font-medium text-foreground/70">
                        {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: customer.kycStatus === 'approved' && customer.amlStatus === 'cleared' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${customer.kycStatus === 'approved' && customer.amlStatus === 'cleared' ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.22)'}` }}>
                      <ShieldCheck size={13} className={customer.kycStatus === 'approved' && customer.amlStatus === 'cleared' ? 'text-emerald-400' : 'text-amber-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/40">Security Score</p>
                      <p className={`text-xs font-semibold ${customer.kycStatus === 'approved' && customer.amlStatus === 'cleared' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {customer.kycStatus === 'approved' && customer.amlStatus === 'cleared' ? 'KYC and AML controls cleared' : `KYC ${customer.kycStatus.replace(/_/g, ' ')} · AML ${customer.amlStatus.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                    <Link to="/dashboard/security" className="text-[10px] text-foreground/25 hover:text-primary transition-colors">
                      View
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center shrink-0">
                      <BadgeCheck size={13} className="text-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/40">Account Tier</p>
                      <p className="text-xs font-medium text-foreground/70">
                        {(customer as any).tier ?? 'Standard'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </main>
      </div>
    </>
  );
}
