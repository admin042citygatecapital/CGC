/**
 * /admin/users — City Gate Capital Customer Management
 *
 * All 14 Super Admin capabilities:
 *  1.  Create Customer          — full form modal
 *  2.  Edit Customer            — ClientEditModal (existing)
 *  3.  Suspend Customer         — one-click with confirm
 *  4.  Activate Customer        — reactivate suspended/frozen
 *  5.  Delete Customer          — confirm dialog + reason
 *  6.  Reset Password           — set new password modal
 *  7.  Reset 2FA                — one-click with confirm
 *  8.  Review KYC               — dedicated evidence-review workflow
 * 10.  Manage Wallets           — BalanceModal (existing)
 * 11.  Manage Cards             — link to /admin/cards?userId=X
 * 12.  View Devices             — slide-out panel
 * 13.  View Login History       — slide-out panel
 * 14.  View Security Events     — slide-out panel
 *      View Audit Logs          — slide-out panel (bonus)
 */
import BalanceModal from '@/components/admin/BalanceModal';
import ClientEditModal,{ type EditableUser } from '@/components/admin/ClientEditModal';
import AdminLayout from '@/layouts/AdminLayout';
import { adminFetch,authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { customerCountSummary } from '@/lib/adminCustomerLoading';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertTriangle,
Bell,
CheckCircle,
ChevronLeft,ChevronRight,
CreditCard,
Edit3,
Eye,
FileText,
History,
KeyRound,
Link2,
Loader2,
Lock,
Minus,
Monitor,
MoreHorizontal,
Plus,
RefreshCw,
Search,
Shield,
ShieldCheck,
ShieldOff,
Unlock,
UserCheck,
Wallet,
X
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface User {
  id: string; name: string; email: string; phone?: string; country?: string;
  status: string; kycStatus: string; emailVerified: boolean;
  createdAt: string; approvedAt?: string; rejectedAt?: string;
  rejectionReason?: string; lastLoginAt?: string; lastLoginIp?: string;
  balance?: number; primaryCurrency?: string; accountTier?: string;
  dateOfBirth?: string; address?: string; city?: string; postalCode?: string;
  idType?: string; idNumber?: string; idDocumentUrl?: string; kycSubmittedAt?: string;
  kycRejectionReason?: string; selfieUrl?: string;
  walletBtc?: string; walletEth?: string; walletUsdt?: string; walletSol?: string;
  bankName?: string; bankAccountNumber?: string; bankSwift?: string; bankIban?: string;
}

interface AuditEntry {
  event: string; userId?: string; email?: string; ip?: string;
  ua?: string; reason?: string; meta?: Record<string, unknown>; ts: string;
}

interface DeviceRecord {
  deviceId: string; ua?: string; ip?: string; name?: string;
  createdAt: string; lastSeenAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:               'bg-emerald-500/15 text-emerald-400',
  pending_verification: 'bg-amber-500/15 text-amber-400',
  pending_kyc:          'bg-blue-500/15 text-blue-400',
  pending_approval:     'bg-purple-500/15 text-purple-400',
  suspended:            'bg-red-500/15 text-red-400',
  frozen:               'bg-cyan-500/15 text-cyan-400',
  rejected:             'bg-red-900/30 text-red-300',
};
const KYC_STYLES: Record<string, string> = {
  not_submitted: 'bg-white/10 text-white/40',
  submitted:     'bg-amber-500/15 text-amber-400',
  approved:      'bg-emerald-500/15 text-emerald-400',
  rejected:      'bg-red-500/15 text-red-400',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Active', pending_verification: 'Pending Email', pending_kyc: 'Pending KYC',
  pending_approval: 'Pending Approval', suspended: 'Suspended', frozen: 'Frozen', rejected: 'Rejected',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center font-bold text-black shrink-0`}
      style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', fontSize: size <= 8 ? 12 : 16 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      className={`fixed top-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl ${
        ok ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' : 'bg-red-500/15 border-red-500/20 text-red-400'
      }`}>
      {ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
      {msg}
    </motion.div>
  );
}

function ModalShell({ title, onClose, children, icon: Icon, iconColor = '#C9A84C', width = 'max-w-lg' }: {
  title: string; onClose: () => void; children: React.ReactNode;
  icon?: React.ElementType; iconColor?: string; width?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.93, opacity: 0 }}
        className={`w-full ${width} rounded-2xl border border-white/8 overflow-hidden`}
        style={{ background: 'rgba(10,10,10,0.98)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon size={15} style={{ color: iconColor }} />}
            <p className="text-white font-bold text-sm">{title}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Customer Modal
// ─────────────────────────────────────────────────────────────────────────────
function CreateCustomerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', country: '', password: '', address: '', city: '', postalCode: '',
    requestedProduct: 'personal-account', reason: '', confirmed: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit() {
    if (!form.name || !form.email || !form.password) { setError('Name, email and temporary password are required'); return; }
    if (!form.phone || !form.country || !form.address || !form.city || !form.postalCode) { setError('Complete the customer contact and address fields.'); return; }
    if (form.password.length < 12 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password)) {
      setError('Temporary password must be at least 12 characters and include uppercase, lowercase, number and special characters'); return;
    }
    if (form.reason.trim().length < 10 || !form.confirmed) { setError('A reason and explicit confirmation are required.'); return; }
    setLoading(true); setError('');
    const res = await adminFetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess(); onClose(); }
    else setError(d.error ?? 'Failed to create customer');
  }

  const inputCls = 'w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40';
  const labelCls = 'text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block';
  const selectCls = 'w-full bg-[#111] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40';

  return (
    <ModalShell title="Create Customer Registration" onClose={onClose} icon={Plus} iconColor="#10B981" width="max-w-2xl">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="create-customer-name" className={labelCls}>Full Name *</label>
          <input id="create-customer-name" name="name" required autoComplete="name" value={form.name} onChange={set('name')} placeholder="Customer name" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-email" className={labelCls}>Email Address *</label>
          <input id="create-customer-email" name="email" required autoComplete="email" type="email" value={form.email} onChange={set('email')} placeholder="customer@example.com" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-password" className={labelCls}>Temporary Password *</label>
          <input id="create-customer-password" name="new-password" required minLength={12} autoComplete="new-password" type="password" value={form.password} onChange={set('password')} placeholder="12+ characters with mixed character types" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-phone" className={labelCls}>Phone *</label>
          <input id="create-customer-phone" name="phone" required autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-country" className={labelCls}>Country *</label>
          <input id="create-customer-country" name="country" required autoComplete="country-name" value={form.country} onChange={set('country')} placeholder="Country" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-address" className={labelCls}>Address *</label>
          <input id="create-customer-address" name="street-address" required autoComplete="street-address" value={form.address} onChange={set('address')} placeholder="Street address" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-city" className={labelCls}>City *</label>
          <input id="create-customer-city" name="address-level2" required autoComplete="address-level2" value={form.city} onChange={set('city')} placeholder="City" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-postal" className={labelCls}>Postal Code *</label>
          <input id="create-customer-postal" name="postal-code" required autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} placeholder="Postal code" className={inputCls} />
        </div>
        <div>
          <label htmlFor="create-customer-product" className={labelCls}>Requested Service</label>
          <select id="create-customer-product" name="requestedProduct" value={form.requestedProduct} onChange={set('requestedProduct')} className={selectCls}>
            <option value="personal-account">Personal Account</option>
            <option value="savings-account">Savings Account</option>
            <option value="business-account">Business Account</option>
            <option value="multi-currency-wallet">Multi-Currency Service Wallet</option>
          </select>
        </div>
        <div className="col-span-2"><label htmlFor="create-customer-reason" className={labelCls}>Administration Reason *</label><textarea id="create-customer-reason" name="reason" required minLength={10} maxLength={500} rows={2} value={form.reason} onChange={set('reason')} placeholder="Explain why this registration is being created." className={`${inputCls} resize-none`} /></div>
        <label className="col-span-2 flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs text-white/50"><input type="checkbox" name="confirmed" checked={form.confirmed} onChange={set('confirmed')} className="mt-0.5 accent-emerald-400" /><span>I confirm this creates a pending registration record only. Email verification, identity review, compliance approval, and service availability remain required.</span></label>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={submit} disabled={loading || !form.confirmed || form.reason.trim().length < 10}
          className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Create Registration
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password Modal
// ─────────────────────────────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!pw || pw.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    const res = await adminFetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newPassword: pw }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess(d.message ?? 'Password reset'); onClose(); }
    else setError(d.error ?? 'Failed to reset password');
  }

  return (
    <ModalShell title={`Reset Password — ${user.name}`} onClose={onClose} icon={KeyRound} iconColor="#F59E0B">
      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4"><AlertTriangle size={13} />{error}</div>}
      <p className="text-white/40 text-xs mb-4">Sets a new password and immediately invalidates the customer's active session.</p>
      <div className="space-y-3">
        <div>
          <label htmlFor="customer-password-reset-new" className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">New Password</label>
          <input id="customer-password-reset-new" name="newPassword" type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} placeholder="Uppercase, number and special character"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/40" />
        </div>
        <div>
          <label htmlFor="customer-password-reset-confirm" className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Confirm Password</label>
          <input id="customer-password-reset-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/40" />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={submit} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
          Reset Password
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reversible customer suspension modal
// ─────────────────────────────────────────────────────────────────────────────
function SuspendModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const expected = user.email.split('@')[0];

  async function submit() {
    if (confirm !== expected) { setError(`Type "${expected}" to confirm`); return; }
    setLoading(true); setError('');
    if (reason.trim().length < 10) { setError('Provide a rationale of at least 10 characters'); return; }
    const res = await adminFetch('/api/admin/users/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, action: 'suspend', reason }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess(d.message ?? 'Customer access suspended'); onClose(); }
    else setError(d.error ?? 'Suspension failed');
  }

  return (
    <ModalShell title="Suspend Customer Access" onClose={onClose} icon={ShieldOff} iconColor="#F59E0B">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/20 mb-4">
        <AlertTriangle size={16} className="text-red-400 shrink-0" />
        <div>
          <p className="text-red-300 text-sm font-semibold">Access will be blocked immediately.</p>
          <p className="text-red-400/60 text-xs mt-0.5">Records for <strong className="text-red-300">{user.name}</strong> are retained for audit and can be reactivated after review.</p>
        </div>
      </div>
      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4"><AlertTriangle size={13} />{error}</div>}
      <div className="space-y-3">
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Suspension rationale</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why access must be suspended..."
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/40" />
        </div>
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">
            Type <span className="text-red-400 font-mono">{expected}</span> to confirm
          </label>
          <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={expected}
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-red-500/40" />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={submit} disabled={loading || confirm !== expected}
          className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/30 flex items-center justify-center gap-2 disabled:opacity-40">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />}
          Suspend Access
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Modal
// ─────────────────────────────────────────────────────────────────────────────
function NotifModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [form, setForm] = useState({ title: '', message: '', link: '' });
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function send() {
    setLoading(true);
    const res = await adminFetch('/api/admin/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...form }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { onSuccess('Notification sent to ' + user.name); onClose(); }
    else onSuccess(d.error ?? 'Failed to send');
  }

  return (
    <ModalShell title={`Send Notification — ${user.name}`} onClose={onClose} icon={Bell} iconColor="#627EEA">
      <div className="space-y-3">
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Title *</label>
          <input value={form.title} onChange={set('title')} placeholder="e.g. Account Update"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Message *</label>
          <textarea rows={3} value={form.message} onChange={set('message')} placeholder="Your account has been approved..."
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 resize-none" />
        </div>
        <div>
          <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Link (optional)</label>
          <input value={form.link} onChange={set('link')} placeholder="/dashboard/wallets"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
        <button onClick={send} disabled={loading || !form.title || !form.message}
          className="flex-1 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-40">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
          Send Notification
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Drawer — full customer profile + all actions
// ─────────────────────────────────────────────────────────────────────────────
type DrawerTab = 'profile' | 'devices' | 'login' | 'security' | 'audit';

function CustomerDrawer({
  user, onClose, onAction, onEdit, onBalance, onResetPw, onReset2fa, onDelete, onNotif,
}: {
  user: User; onClose: () => void;
  onAction: (userId: string, action: string) => void;
  onEdit: (u: User) => void;
  onBalance: (u: User) => void;
  onResetPw: (u: User) => void;
  onReset2fa: (u: User) => void;
  onDelete: (u: User) => void;
  onNotif: (u: User) => void;
}) {
  const [tab, setTab] = useState<DrawerTab>('profile');
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loginHistory, setLoginHistory] = useState<AuditEntry[]>([]);
  const [secEvents, setSecEvents] = useState<AuditEntry[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const loadedTabs = useRef<Set<DrawerTab>>(new Set(['profile']));

  async function loadTab(t: DrawerTab) {
    if (loadedTabs.current.has(t)) return;
    setTabLoading(true);
    try {
      if (t === 'devices') {
        const r = await fetch(`/api/admin/users/${user.id}/devices`, { headers: authHeaders() });
        if (r.ok) { const d = await r.json(); setDevices(d.data); }
      } else if (t === 'login') {
        const r = await fetch(`/api/admin/users/${user.id}/login-history`, { headers: authHeaders() });
        if (r.ok) { const d = await r.json(); setLoginHistory(d.data); }
      } else if (t === 'security') {
        const r = await fetch(`/api/admin/users/${user.id}/security-events`, { headers: authHeaders() });
        if (r.ok) { const d = await r.json(); setSecEvents(d.data); }
      } else if (t === 'audit') {
        const r = await fetch(`/api/admin/users/${user.id}/audit`, { headers: authHeaders() });
        if (r.ok) { const d = await r.json(); setAuditLog(d.data); }
      }
      loadedTabs.current.add(t);
    } finally { setTabLoading(false); }
  }

  function switchTab(t: DrawerTab) { setTab(t); loadTab(t); }

  const canReviewKyc = user.kycStatus === 'submitted';

  const tabs: { key: DrawerTab; label: string; icon: React.ElementType }[] = [
    { key: 'profile',  label: 'Profile',  icon: Eye },
    { key: 'devices',  label: 'Devices',  icon: Monitor },
    { key: 'login',    label: 'Logins',   icon: History },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'audit',    label: 'Audit',    icon: FileText },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-md h-full flex flex-col border-l border-white/8 overflow-hidden"
        style={{ background: 'rgba(10,10,10,0.99)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={10} />
            <div>
              <p className="text-white font-bold text-sm leading-tight">{user.name}</p>
              <p className="text-white/35 text-xs">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.04] shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[user.status] ?? 'bg-white/10 text-white/40'}`}>
            {STATUS_LABELS[user.status] ?? user.status}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${KYC_STYLES[user.kycStatus] ?? 'bg-white/10 text-white/40'}`}>
            KYC: {user.kycStatus.replace(/_/g, ' ')}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-white/40 capitalize">
            {user.accountTier ?? 'personal'}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.04] shrink-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors border-b-2 ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-white/30 hover:text-white/60'
              }`}>
              <t.icon size={11} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tabLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-white/20" />
            </div>
          )}

          {/* ── Profile tab ── */}
          {tab === 'profile' && !tabLoading && (
            <div className="p-5 space-y-4">
              {/* Core info */}
              <div className="space-y-0">
                {[
                  ['ID', user.id],
                  ['Phone', user.phone ?? '—'],
                  ['Country', user.country ?? '—'],
                  ['Email Verified', user.emailVerified ? 'Yes' : 'No'],
                  ['Balance', `$${Number(user.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                  ['Currency', user.primaryCurrency ?? 'USD'],
                  ['Registered', new Date(user.createdAt).toLocaleString()],
                  ['Last Login', user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'],
                  ['Last Login IP', user.lastLoginIp ?? '—'],
                  ['Approved', user.approvedAt ? new Date(user.approvedAt).toLocaleString() : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-white/[0.04]">
                    <span className="text-white/30 text-xs">{k}</span>
                    <span className="text-white/70 text-xs text-right max-w-[60%] break-all font-mono">{v}</span>
                  </div>
                ))}
              </div>

              {/* KYC details */}
              {(user.dateOfBirth || user.idType || user.address) && (
                <div>
                  <p className="text-white/20 text-[9px] uppercase tracking-widest mb-2 pt-1">KYC Details</p>
                  {[
                    ['Date of Birth', user.dateOfBirth ?? '—'],
                    ['Address', user.address ?? '—'],
                    ['City', user.city ?? '—'],
                    ['Postal Code', user.postalCode ?? '—'],
                    ['ID Type', user.idType ?? '—'],
                    ['ID Number', user.idNumber ?? '—'],
                    ['KYC Submitted', user.kycSubmittedAt ? new Date(user.kycSubmittedAt).toLocaleString() : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1.5 border-b border-white/[0.03]">
                      <span className="text-white/25 text-xs">{k}</span>
                      <span className="text-white/55 text-xs text-right max-w-[60%] break-all">{v}</span>
                    </div>
                  ))}
                  {user.idDocumentUrl && (
                    <div className="mt-3">
                      <p className="text-white/25 text-xs mb-1.5">ID Document</p>
                      <a href={user.idDocumentUrl} target="_blank" rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-white/10 hover:border-primary/40 transition-colors">
                        <img src={user.idDocumentUrl} alt="ID Document" className="w-full max-h-40 object-contain bg-white/5" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Wallet addresses */}
              {(user.walletBtc || user.walletEth || user.walletUsdt || user.walletSol) && (
                <div>
                  <p className="text-white/20 text-[9px] uppercase tracking-widest mb-2">Crypto Addresses</p>
                  {[['BTC', user.walletBtc], ['ETH', user.walletEth], ['USDT', user.walletUsdt], ['SOL', user.walletSol]]
                    .filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1.5 border-b border-white/[0.03]">
                        <span className="text-white/25 text-xs">{k}</span>
                        <span className="text-white/50 text-xs font-mono text-right max-w-[70%] break-all">{v}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Bank info */}
              {user.bankName && (
                <div>
                  <p className="text-white/20 text-[9px] uppercase tracking-widest mb-2">Bank Details</p>
                  {[
                    ['Bank', user.bankName],
                    ['Account', user.bankAccountNumber ?? '—'],
                    ['SWIFT', user.bankSwift ?? '—'],
                    ['IBAN', user.bankIban ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1.5 border-b border-white/[0.03]">
                      <span className="text-white/25 text-xs">{k}</span>
                      <span className="text-white/50 text-xs font-mono text-right max-w-[60%] break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Devices tab ── */}
          {tab === 'devices' && !tabLoading && (
            <div className="p-5">
              {devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                  <Monitor size={24} />
                  <p className="text-sm">No devices registered</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map(d => (
                    <div key={d.deviceId} className="p-3 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-white/70 text-xs font-semibold">{d.name ?? 'Unknown Device'}</p>
                        <span className="text-white/25 text-[9px] font-mono">{d.ip ?? '—'}</span>
                      </div>
                      <p className="text-white/30 text-[10px] break-all">{d.ua ?? '—'}</p>
                      <p className="text-white/20 text-[9px] mt-1">
                        Added {new Date(d.createdAt).toLocaleDateString()}
                        {d.lastSeenAt && ` · Last seen ${new Date(d.lastSeenAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Login History tab ── */}
          {tab === 'login' && !tabLoading && (
            <div className="p-5">
              {loginHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                  <History size={24} />
                  <p className="text-sm">No login history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {loginHistory.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] bg-white/[0.015]">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${e.event.includes('fail') ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white/60 text-xs font-medium">{e.event.replace(/_/g, ' ')}</p>
                        <p className="text-white/25 text-[10px] font-mono">{e.ip ?? '—'}</p>
                      </div>
                      <p className="text-white/25 text-[9px] shrink-0">{new Date(e.ts).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Security Events tab ── */}
          {tab === 'security' && !tabLoading && (
            <div className="p-5">
              {secEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                  <Shield size={24} />
                  <p className="text-sm">No security events</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {secEvents.map((e, i) => {
                    const isRisk = e.event.includes('fail') || e.event.includes('lock') || e.event.includes('fraud') || e.event.includes('suspend') || e.event.includes('delete');
                    return (
                      <div key={i} className={`p-3 rounded-xl border ${isRisk ? 'border-red-500/15 bg-red-500/5' : 'border-white/[0.04] bg-white/[0.015]'}`}>
                        <div className="flex items-start justify-between mb-1">
                          <p className={`text-xs font-semibold ${isRisk ? 'text-red-300' : 'text-white/60'}`}>
                            {e.event.replace(/_/g, ' ')}
                          </p>
                          <p className="text-white/20 text-[9px] shrink-0 ml-2">{new Date(e.ts).toLocaleString()}</p>
                        </div>
                        {e.ip && <p className="text-white/25 text-[10px] font-mono">IP: {e.ip}</p>}
                        {e.reason && <p className="text-white/30 text-[10px] mt-0.5">Reason: {e.reason}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Audit Log tab ── */}
          {tab === 'audit' && !tabLoading && (
            <div className="p-5">
              {auditLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-white/20">
                  <FileText size={24} />
                  <p className="text-sm">No audit entries</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {auditLog.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 border-b border-white/[0.03]">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white/55 text-xs">{e.event.replace(/_/g, ' ')}</p>
                        {e.reason && <p className="text-white/25 text-[10px]">{e.reason}</p>}
                        {e.ip && <p className="text-white/20 text-[9px] font-mono">IP: {e.ip}</p>}
                      </div>
                      <p className="text-white/20 text-[9px] shrink-0">{new Date(e.ts).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="border-t border-white/8 p-4 shrink-0">
          <p className="text-white/20 text-[9px] uppercase tracking-widest mb-3">Actions</p>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {/* KYC decisions belong to the evidence-review workflow. */}
            {canReviewKyc ? (
              <Link to={`/admin/kyc?search=${encodeURIComponent(user.email)}`} title="Open KYC review"
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span className="text-[9px] text-emerald-400/70">Review KYC</span>
              </Link>
            ) : user.kycStatus === 'not_submitted' ? (
              <div title="The customer must submit identity evidence before review"
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.03] text-white/30">
                <Shield size={13} />
                <span className="text-[9px] text-center">Awaiting KYC</span>
              </div>
            ) : null}
            {/* Suspend */}
            {user.status === 'active' && (
              <button onClick={() => onAction(user.id, 'suspend')} title="Suspend"
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
                <Lock size={13} className="text-amber-400" />
                <span className="text-[9px] text-amber-400/70">Suspend</span>
              </button>
            )}
            {/* Activate */}
            {['suspended', 'frozen', 'rejected'].includes(user.status) && (
              <button onClick={() => onAction(user.id, 'reactivate')} title="Activate"
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                <Unlock size={13} className="text-blue-400" />
                <span className="text-[9px] text-blue-400/70">Activate</span>
              </button>
            )}
            {/* Freeze */}
            {user.status === 'active' && (
              <button onClick={() => onAction(user.id, 'freeze')} title="Freeze"
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors">
                <Minus size={13} className="text-cyan-400" />
                <span className="text-[9px] text-cyan-400/70">Freeze</span>
              </button>
            )}
            {/* Edit */}
            <button onClick={() => onEdit(user)} title="Edit Profile"
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors">
              <Edit3 size={13} className="text-primary" />
              <span className="text-[9px] text-primary/70">Edit</span>
            </button>
            {/* Balance */}
            <button onClick={() => onBalance(user)} title="Manage Wallets"
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
              <Wallet size={13} className="text-white/50" />
              <span className="text-[9px] text-white/30">Wallets</span>
            </button>
            {/* Cards */}
            <Link to={`/admin/cards?userId=${user.id}`} title="Manage Cards"
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
              <CreditCard size={13} className="text-white/50" />
              <span className="text-[9px] text-white/30">Cards</span>
            </Link>
            {/* Reset Password */}
            <button onClick={() => onResetPw(user)} title="Reset Password"
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
              <KeyRound size={13} className="text-amber-400" />
              <span className="text-[9px] text-amber-400/70">Reset PW</span>
            </button>
            {/* Reset 2FA */}
            <button onClick={() => onReset2fa(user)} title="Reset 2FA"
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors">
              <ShieldOff size={13} className="text-purple-400" />
              <span className="text-[9px] text-purple-400/70">Reset 2FA</span>
            </button>
            {/* Notification */}
            <button onClick={() => onNotif(user)} title="Send Notification"
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
              <Bell size={13} className="text-blue-400" />
              <span className="text-[9px] text-blue-400/70">Notify</span>
            </button>
            {/* Suspend and preserve */}
            <button onClick={() => onDelete(user)} title="Suspend Account"
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors">
              <ShieldOff size={13} className="text-red-400" />
              <span className="text-[9px] text-red-400/70">Suspend</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();

  const [users, setUsers]         = useState<User[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [kycFilter, setKyc]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setAL]    = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const requestIdRef              = useRef(0);

  // Modals
  const [selected,    setSelected]    = useState<User | null>(null);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [editUser,    setEditUser]    = useState<User | null>(null);
  const [balanceUser, setBalanceUser] = useState<User | null>(null);
  const [resetPwUser, setResetPwUser] = useState<User | null>(null);
  const [deleteUser,  setDeleteUser]  = useState<User | null>(null);
  const [notifUser,   setNotifUser]   = useState<User | null>(null);
  const [confirm2fa,  setConfirm2fa]  = useState<User | null>(null);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchUsers = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) p.set('search', search);
    if (statusFilter) p.set('status', statusFilter);
    if (kycFilter) p.set('kyc', kycFilter);
    try {
      const res = await fetch(`/api/admin/users?${p}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Customer request failed with ${res.status}`);
      const d = await res.json();
      if (!Array.isArray(d.data) || !Number.isFinite(d.total)) throw new Error('Customer response is malformed');
      if (requestId !== requestIdRef.current) return;
      setUsers(d.data); setTotal(d.total); setPages(d.pages ?? Math.ceil(d.total / 20));
    } catch {
      if (requestId !== requestIdRef.current) return;
      setUsers([]);
      setTotal(0);
      setPages(1);
      setLoadError('Customer records could not be loaded. No customer data has been changed.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, search, statusFilter, kycFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Deep-link support: /admin/users?id=<id> (from support.tsx) opens that customer's drawer.
  const deepLinkId = new URLSearchParams(window.location.search).get('id');
  useEffect(() => {
    if (!deepLinkId || authLoading || !admin) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(deepLinkId)}`, { headers: authHeaders() });
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled && d?.id) setSelected(d as User);
      } catch { /* deep-link open is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [deepLinkId, authLoading, admin]);

  async function doAction(userId: string, action: string, extra?: object) {
    let actionPayload = extra ?? {};
    if (['suspend', 'freeze', 'reactivate'].includes(action) && !('reason' in actionPayload)) {
      const reason = window.prompt(`Enter the required rationale to ${action} this platform profile:`)?.trim() ?? '';
      if (reason.length < 10) {
        showToast('A rationale of at least 10 characters is required.', false);
        return;
      }
      actionPayload = { ...actionPayload, reason };
    }
    setAL(userId + action);
    const res = await adminFetch('/api/admin/users/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, ...actionPayload }),
    });
    const d = await res.json();
    setAL(null);
    if (res.ok) {
      showToast(d.message ?? 'Action completed');
      fetchUsers();
      // Update selected user in drawer if open
      if (selected?.id === userId) setSelected(null);
    } else showToast(d.error ?? 'Action failed', false);
  }

  async function approveUser(userId: string) {
    const reason = window.prompt('Enter the final registration approval rationale:')?.trim() ?? '';
    if (reason.length < 10) {
      showToast('A final approval rationale of at least 10 characters is required.', false);
      return;
    }
    setAL(userId + 'approve');
    const res = await adminFetch('/api/admin/users/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason }),
    });
    const d = await res.json();
    setAL(null);
    if (res.ok) { showToast(d.message ?? 'User approved'); fetchUsers(); setSelected(null); }
    else showToast(d.error ?? 'Approval failed', false);
  }

  async function confirmReset2fa(user: User) {
    const reason = prompt(`Security reason for resetting 2FA for ${user.name}:`)?.trim();
    if (!reason || reason.length < 8) {
      showToast('A clear security reason is required.', false);
      return;
    }
    setAL(user.id + 'reset2fa');
    const res = await adminFetch('/api/admin/users/reset-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, reason, confirmation: 'CONFIRM CUSTOMER 2FA RESET' }),
    });
    const d = await res.json();
    setAL(null);
    setConfirm2fa(null);
    if (res.ok) showToast(d.message ?? '2FA reset');
    else showToast(d.error ?? '2FA reset failed', false);
  }

  const submittedKycCount = users.filter(u => u.kycStatus === 'submitted').length;
  const incompleteKycCount = users.filter(u => u.kycStatus === 'not_submitted' && u.status === 'pending_kyc').length;

  return (
    <>
      <Helmet>
        <title>Customer Management — CGC Admin</title>
        <meta name="description" content="Full customer account management for City Gate Capital." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/users" />
      </Helmet>
      <AdminLayout title="Customer Management">

        {/* Toast */}
        <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-white text-xl font-bold">Customer Management</h1>
            <p className="text-white/30 text-sm" aria-live="polite">
              {customerCountSummary({ loading, error: loadError, total })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/customer-relationships"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/60 text-sm hover:text-white hover:border-primary/30 transition-colors">
              <Link2 size={14} /> Customer Relations
            </Link>
            <button onClick={fetchUsers} disabled={loading} aria-label={loading ? 'Loading customer records' : 'Refresh customer records'}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 text-sm hover:text-white transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)', color: '#000' }}>
              <Plus size={14} /> Create Registration
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, email, ID..."
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
          </div>
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <option value="" className="bg-[#0A0A0A]">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v} className="bg-[#0A0A0A]">{l}</option>)}
          </select>
          <select value={kycFilter} onChange={e => { setKyc(e.target.value); setPage(1); }}
            className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <option value="" className="bg-[#0A0A0A]">All KYC</option>
            <option value="not_submitted" className="bg-[#0A0A0A]">Not Submitted</option>
            <option value="submitted" className="bg-[#0A0A0A]">Submitted</option>
            <option value="approved" className="bg-[#0A0A0A]">Approved</option>
            <option value="rejected" className="bg-[#0A0A0A]">Rejected</option>
          </select>
        </div>

        {/* ── Pending banner ── */}
        {(submittedKycCount > 0 || incompleteKycCount > 0) && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-4">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <p className="text-amber-300 text-sm">
              {submittedKycCount > 0 && <><strong>{submittedKycCount}</strong> submitted case{submittedKycCount > 1 ? 's are' : ' is'} ready for review.</>}
              {submittedKycCount > 0 && incompleteKycCount > 0 && ' '}
              {incompleteKycCount > 0 && <><strong>{incompleteKycCount}</strong> customer{incompleteKycCount > 1 ? 's have' : ' has'} not yet submitted identity evidence.</>}
            </p>
            <button onClick={() => { setKyc(submittedKycCount > 0 ? 'submitted' : 'not_submitted'); setPage(1); }}
              className="ml-auto text-amber-400 text-xs underline underline-offset-2 hover:text-amber-300">
              Filter
            </button>
          </div>
        )}

        {/* ── Table ── */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Customer', 'Status', 'KYC', 'Tier', 'Balance', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-white/[0.04] rounded animate-pulse" /></td></tr>
                )) : loadError ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center">
                    <AlertTriangle size={18} className="mx-auto mb-3 text-red-400" />
                    <p className="text-red-300 text-sm font-medium">Unable to load customer records</p>
                    <p className="text-white/30 text-xs mt-1 mb-4">{loadError}</p>
                    <button type="button" onClick={fetchUsers}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs hover:text-white hover:bg-white/[0.04]">
                      <RefreshCw size={12} /> Retry
                    </button>
                  </td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center text-white/25 text-sm">No customers found</td></tr>
                ) : users.map(u => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    tabIndex={0}
                    onClick={() => setSelected(u)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(u);
                      }
                    }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div>
                          <p className="text-white text-sm font-medium">{u.name}</p>
                          <p className="text-white/30 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[u.status] ?? 'bg-white/10 text-white/40'}`}>
                        {STATUS_LABELS[u.status] ?? u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${KYC_STYLES[u.kycStatus] ?? 'bg-white/10 text-white/40'}`}>
                        {u.kycStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/40 text-xs capitalize">{u.accountTier ?? 'personal'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/70 font-mono text-xs">
                          ${Number(u.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <button onClick={e => { e.stopPropagation(); setBalanceUser(u); }}
                          className="w-5 h-5 rounded flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors">
                          <Wallet size={10} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {/* Evidence review is separate from final account activation. */}
                        {u.kycStatus === 'submitted' && (
                          <Link to={`/admin/kyc?search=${encodeURIComponent(u.email)}`} title="Review submitted KYC"
                            className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 hover:bg-purple-500/25 transition-colors">
                            <ShieldCheck size={11} />
                          </Link>
                        )}
                        {u.status === 'pending_approval' && u.kycStatus === 'approved' && (
                          <button onClick={() => approveUser(u.id)} disabled={!!actionLoading} title="Final account activation"
                            className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                            {actionLoading === u.id + 'approve' ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
                          </button>
                        )}
                        {/* Suspend / Activate */}
                        {u.status === 'active' ? (
                          <button onClick={() => doAction(u.id, 'suspend')} disabled={!!actionLoading} title="Suspend"
                            className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 hover:bg-amber-500/25 transition-colors">
                            {actionLoading === u.id + 'suspend' ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
                          </button>
                        ) : ['suspended', 'frozen'].includes(u.status) ? (
                          <button onClick={() => doAction(u.id, 'reactivate')} disabled={!!actionLoading} title="Activate"
                            className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 hover:bg-blue-500/25 transition-colors">
                            {actionLoading === u.id + 'reactivate' ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />}
                          </button>
                        ) : null}
                        {/* Edit */}
                        <button onClick={() => setEditUser(u)} title="Edit"
                          className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary/60 hover:text-primary hover:bg-primary/20 transition-colors">
                          <Edit3 size={11} />
                        </button>
                        {/* More — opens drawer */}
                        <button onClick={() => setSelected(u)} title="View All Actions"
                          className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors">
                          <MoreHorizontal size={11} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-white/25 text-xs">
              {loading
                ? 'Loading customer records…'
                : loadError
                  ? 'Customer records unavailable'
                  : `Showing ${Math.min((page - 1) * 20 + 1, total)}–${Math.min(page * 20, total)} of ${total.toLocaleString()}`}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:bg-white/[0.08]">
                <ChevronLeft size={12} />
              </button>
              <span className="flex items-center px-3 text-white/30 text-xs">{page} / {pages || 1}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 disabled:opacity-30 hover:bg-white/[0.08]">
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Modals & Drawers ── */}
        <AnimatePresence>
          {createOpen && (
            <CreateCustomerModal
              onClose={() => setCreateOpen(false)}
              onSuccess={() => { showToast('Customer registration created'); fetchUsers(); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editUser && (
            <ClientEditModal
              user={editUser as EditableUser}
              onClose={() => setEditUser(null)}
              onSuccess={updated => {
                setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
                showToast('Customer account updated');
                setEditUser(null);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {resetPwUser && (
            <ResetPasswordModal
              user={resetPwUser}
              onClose={() => setResetPwUser(null)}
              onSuccess={msg => { showToast(msg); fetchUsers(); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deleteUser && (
            <SuspendModal
              user={deleteUser}
              onClose={() => setDeleteUser(null)}
              onSuccess={msg => { showToast(msg); fetchUsers(); setSelected(null); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {notifUser && (
            <NotifModal
              user={notifUser}
              onClose={() => setNotifUser(null)}
              onSuccess={msg => showToast(msg)}
            />
          )}
        </AnimatePresence>

        {/* 2FA reset confirm */}
        <AnimatePresence>
          {confirm2fa && (
            <ModalShell title="Reset 2FA" onClose={() => setConfirm2fa(null)} icon={ShieldOff} iconColor="#8B5CF6">
              <p className="text-white/50 text-sm mb-4">
                This will clear 2FA for <strong className="text-white">{confirm2fa.name}</strong> and invalidate their active session.
                They must re-enroll on next login.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirm2fa(null)} className="flex-1 py-2.5 rounded-xl border border-white/8 text-white/50 text-sm hover:bg-white/[0.04]">Cancel</button>
                <button onClick={() => confirmReset2fa(confirm2fa)} disabled={!!actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-semibold hover:bg-purple-500/30 flex items-center justify-center gap-2">
                  {actionLoading === confirm2fa.id + 'reset2fa' ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />}
                  Reset 2FA
                </button>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* Customer detail drawer */}
        <AnimatePresence>
          {selected && (
            <CustomerDrawer
              user={selected}
              onClose={() => setSelected(null)}
              onAction={(id, action) => doAction(id, action)}
              onEdit={u => { setSelected(null); setEditUser(u); }}
              onBalance={u => { setSelected(null); setBalanceUser(u); }}
              onResetPw={u => { setSelected(null); setResetPwUser(u); }}
              onReset2fa={u => { setSelected(null); setConfirm2fa(u); }}
              onDelete={u => { setSelected(null); setDeleteUser(u); }}
              onNotif={u => { setSelected(null); setNotifUser(u); }}
            />
          )}
        </AnimatePresence>

      </AdminLayout>

      {/* Balance modal (outside AdminLayout to avoid z-index stacking) */}
      <AnimatePresence>
        {balanceUser && (
          <BalanceModal
            user={balanceUser}
            onClose={() => setBalanceUser(null)}
            onSuccess={(userId, newBalance) => {
              setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: newBalance } : u));
              showToast('Balance updated');
              setBalanceUser(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
