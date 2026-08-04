import { Helmet } from '@dr.pogodin/react-helmet';
import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Plus, Send, X, Loader2 } from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

interface Message {
  id: string;
  from: 'customer' | 'admin';
  text: string;
  ts: string;
  adminName?: string;
}

interface Conversation {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-emerald-500/15 text-emerald-400',
  pending:     'bg-amber-500/15 text-amber-400',
  in_progress: 'bg-blue-500/15 text-blue-400',
  resolved:    'bg-white/10 text-white/40',
  closed:      'bg-white/5 text-white/30',
};

const CATEGORIES = ['Account Access', 'KYC Verification', 'Transfer Issue', 'Card Problem', 'Crypto Support', 'General Inquiry', 'Withdrawal Issue', 'Deposit Issue', 'Technical Support'];

export default function DashboardSupportPage() {
  const { customer, token, loading: authLoading } = useCustomerAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !customer) navigate('/login?reason=session_expired', { replace: true });
  }, [customer, authLoading, navigate]);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users/support', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setConversations(d.conversations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  async function submitNewTicket(e: FormEvent) {
    e.preventDefault();
    if (!token || !newSubject.trim() || !newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/users/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: newSubject.trim(), category: newCategory, message: newMessage.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setConversations(list => [d.conversation, ...list]);
        setSelected(d.conversation);
        setShowNewForm(false);
        setNewSubject('');
        setNewMessage('');
      }
    } finally {
      setSending(false);
    }
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/users/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: selected.id, message: reply.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setSelected(d.conversation);
        setConversations(list => list.map(c => c.id === d.conversation.id ? d.conversation : c));
        setReply('');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Helmet><title>Support — City Gate Capital</title><meta name="robots" content="noindex" /></Helmet>
      <div className="min-h-screen bg-[#0A0A0A] pt-28 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-white text-xl font-bold">Support</h1>
            <button onClick={() => { setShowNewForm(true); setSelected(null); }}
              className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-black text-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <span className="relative flex items-center gap-1.5"><Plus size={14} /> New Ticket</span>
            </button>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* Conversation list */}
            <div className="lg:col-span-2 rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4"><div className="h-12 bg-white/[0.04] rounded animate-pulse" /></div>
                  ))
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center text-white/30 text-sm">No support tickets yet.</div>
                ) : conversations.map(c => (
                  <button key={c.id} onClick={() => { setSelected(c); setShowNewForm(false); }}
                    className={`w-full text-left p-4 hover:bg-white/[0.03] transition-colors ${selected?.id === c.id ? 'bg-white/[0.04] border-l-2 border-primary' : ''}`}>
                    <p className="text-white text-xs font-medium leading-snug line-clamp-1 mb-1.5">{c.subject}</p>
                    <p className="text-white/30 text-[10px] mb-1.5">{c.category}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[c.status] ?? ''}`}>{c.status.replace('_', ' ')}</span>
                      <p className="text-white/20 text-[10px]">{new Date(c.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail / new-ticket form */}
            <div className="lg:col-span-3">
              {showNewForm ? (
                <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-semibold text-sm">New Support Ticket</p>
                    <button onClick={() => setShowNewForm(false)} className="text-white/25 hover:text-white"><X size={14} /></button>
                  </div>
                  <form onSubmit={submitNewTicket} className="space-y-3">
                    <input value={newSubject} onChange={e => setNewSubject(e.target.value)} required
                      placeholder="Subject"
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
                      {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#0A0A0A]">{cat}</option>)}
                    </select>
                    <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} required rows={5}
                      placeholder="Describe your issue..."
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 resize-none" />
                    <button type="submit" disabled={sending || !newSubject.trim() || !newMessage.trim()}
                      className="relative w-full px-4 py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-50">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                      <span className="relative flex items-center justify-center gap-2">
                        {sending ? <Loader2 size={14} className="animate-spin" /> : 'Submit Ticket'}
                      </span>
                    </button>
                  </form>
                </div>
              ) : selected ? (
                <div className="rounded-2xl border border-white/5 overflow-hidden flex flex-col" style={{ background: 'rgba(255,255,255,0.02)', maxHeight: '600px' }}>
                  <div className="flex items-start justify-between p-5 border-b border-white/5">
                    <div>
                      <p className="text-white font-semibold text-sm">{selected.subject}</p>
                      <p className="text-white/30 text-xs mt-0.5">{selected.category}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[selected.status] ?? ''}`}>{selected.status.replace('_', ' ')}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {selected.messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs rounded-2xl px-4 py-3 text-xs ${
                          msg.from === 'customer' ? 'text-black rounded-br-sm' : 'bg-white/[0.06] text-white/80 rounded-bl-sm'
                        }`} style={msg.from === 'customer' ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                          {msg.from === 'admin' && msg.adminName && (
                            <p className="text-[9px] font-semibold mb-1 opacity-70">{msg.adminName}</p>
                          )}
                          <p className="leading-relaxed">{msg.text}</p>
                          <p className={`text-[9px] mt-1 ${msg.from === 'customer' ? 'text-black/40' : 'text-white/25'}`}>{new Date(msg.ts).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selected.status !== 'closed' && (
                    <form onSubmit={sendReply} className="p-4 border-t border-white/5 flex gap-2">
                      <input value={reply} onChange={e => setReply(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
                      <button type="submit" disabled={sending || !reply.trim()}
                        className="relative px-4 py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden shrink-0 disabled:opacity-50">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                        <span className="relative">{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}</span>
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 flex items-center justify-center h-64" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="text-center">
                    <MessageCircle size={32} className="text-white/10 mx-auto mb-3" />
                    <p className="text-white/20 text-sm">Select a ticket, or open a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
