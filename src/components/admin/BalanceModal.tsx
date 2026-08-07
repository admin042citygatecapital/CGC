import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, TrendingDown, DollarSign, Loader2, AlertTriangle } from 'lucide-react';
import { authHeaders } from '@/lib/adminAuth';

interface User {
  id: string;
  name: string;
  email: string;
  balance?: number;
}

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: (userId: string, newBalance: number) => void;
}

type AdjustType = 'credit' | 'debit';

export default function BalanceModal({ user, onClose, onSuccess }: Props) {
  const [type, setType]         = useState<AdjustType>('credit');
  const [amount, setAmount]     = useState('');
  const [note, setNote]         = useState('');
  const [confirm, setConfirm]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const currentBalance = Number(user.balance ?? 0);
  const parsedAmount   = parseFloat(amount) || 0;
  const previewBalance = type === 'credit'
    ? currentBalance + parsedAmount
    : currentBalance - parsedAmount;

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/balance/adjust', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ userId: user.id, type, amount: parsedAmount, note }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Adjustment failed');
        setConfirm(false);
      } else {
        onSuccess(user.id, data.newBalance);
        onClose();
      }
    } catch {
      setError('Network error — please try again');
      setConfirm(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-semibold text-lg">Adjust Balance</h2>
            <p className="text-white/50 text-sm mt-0.5">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current balance */}
          <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-white/50 text-sm">Current Balance</span>
            <span className="text-white font-mono font-semibold text-lg">
              ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setType('credit')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-medium text-sm transition-all ${
                type === 'credit'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
              }`}
            >
              <TrendingUp size={16} />
              Credit (Add)
            </button>
            <button
              onClick={() => setType('debit')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-medium text-sm transition-all ${
                type === 'debit'
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
              }`}
            >
              <TrendingDown size={16} />
              Debit (Remove)
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-white/60 text-sm mb-2">Amount (USD)</label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50 font-mono"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-white/60 text-sm mb-2">Transaction Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for adjustment (required for audit log)"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50 resize-none text-sm"
            />
          </div>

          {/* Preview */}
          {parsedAmount > 0 && (
            <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-white/50 text-sm">New Balance</span>
              <span className={`font-mono font-semibold text-lg ${previewBalance < 0 ? 'text-red-400' : 'text-[#C9A84C]'}`}>
                ${previewBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          {/* Confirm step */}
          <AnimatePresence>
            {confirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300 text-sm"
              >
                <p className="font-medium mb-1">Confirm this adjustment?</p>
                <p className="text-amber-300/70">
                  {type === 'credit' ? 'Adding' : 'Removing'} ${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {type === 'credit' ? 'to' : 'from'} {user.name}'s account.
                  This action is logged and cannot be undone automatically.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all text-sm font-medium"
            >
              Cancel
            </button>
            {!confirm ? (
              <button
                onClick={() => {
                  setError('');
                  if (!parsedAmount || parsedAmount <= 0) { setError('Enter a valid amount'); return; }
                  if (!note.trim()) { setError('Transaction note is required'); return; }
                  setConfirm(true);
                }}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
                  type === 'credit'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                    : 'bg-red-500 hover:bg-red-400 text-white'
                }`}
              >
                {type === 'credit' ? 'Credit Account' : 'Debit Account'}
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-[#C9A84C] hover:bg-[#d4b55e] text-black font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={15} className="animate-spin" /> Processing…</> : 'Confirm Adjustment'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
