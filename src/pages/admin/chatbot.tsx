/**
 * /admin/chatbot — City Gate Capital Chatbot Center (Smartsupp)
 *
 * 8 tabs:
 *   1. Widget Settings     — Smartsupp embed config, colors, position, auto-message
 *   2. Live Chats          — Real-time open conversations, takeover, assign
 *   3. Conversation History— Full searchable history with message thread viewer
 *   4. Agents              — Manage support agents, status, stats
 *   5. FAQ                 — Bot knowledge base entries, categories, keywords
 *   6. Analytics           — 14-day charts, KPIs, rating breakdown
 *   7. Tickets             — Create/manage support tickets from conversations
 *   8. Settings            — API key, Chat ID, advanced options
 */
import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders,useAdminAuth } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
AlertTriangle,
ArrowRight,
BarChart2,
BookOpen,
CheckCircle,
Clock,
Edit2,
Eye,EyeOff,
Loader2,
MessageSquare,
Monitor,
PhoneCall,
Plus,
RefreshCw,
Save,
Search,
Send,
Settings,
Smartphone,
Star,
Ticket,
Trash2,
UserCheck,
UserPlus,
Users,
X,
XCircle,
Zap
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useCallback,useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrors smartsuppStore)
// ─────────────────────────────────────────────────────────────────────────────
interface SmartsuppConfig {
  apiKey: string; chatId: string;
  widgetEnabled: boolean; widgetColor: string;
  widgetPosition: 'bottom-right' | 'bottom-left';
  widgetGreeting: string; widgetName: string; widgetAvatar: string;
  offlineMessage: string; autoMessage: string; autoMessageDelay: number;
  soundEnabled: boolean; ratingEnabled: boolean; updatedAt: string;
}
interface ChatMessage { id: string; role: 'visitor' | 'agent' | 'bot'; text: string; ts: string; agentId?: string; }
interface Conversation {
  id: string; visitorName: string; visitorEmail: string; visitorIp: string;
  visitorCountry: string; status: 'open' | 'assigned' | 'resolved' | 'missed';
  assignedAgentId: string | null; messages: ChatMessage[]; tags: string[];
  rating: number | null; createdAt: string; updatedAt: string; resolvedAt: string | null;
  pageUrl: string; device: 'desktop' | 'mobile' | 'tablet';
}
interface Agent {
  id: string; name: string; email: string; role: 'admin' | 'agent';
  status: 'online' | 'away' | 'offline'; avatar: string;
  assignedCount: number; resolvedCount: number; avgResponseTime: number; createdAt: string;
}
interface SupportTicket {
  id: string; conversationId: string | null; visitorName: string; visitorEmail: string;
  subject: string; description: string; status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent'; assignedAgentId: string | null;
  tags: string[]; createdAt: string; updatedAt: string; resolvedAt: string | null; notes: string;
}
interface FaqEntry {
  id: string; question: string; answer: string; category: string;
  enabled: boolean; triggerKeywords: string[]; viewCount: number; helpfulCount: number;
  createdAt: string; updatedAt: string;
}
interface AnalyticsSnapshot {
  date: string; totalConversations: number; resolvedConversations: number;
  missedConversations: number; avgResponseTime: number; avgRating: number;
  totalMessages: number; uniqueVisitors: number; ticketsCreated: number; ticketsResolved: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'widget',   label: 'Widget Settings',       icon: MessageSquare },
  { id: 'live',     label: 'Live Chats',             icon: Zap },
  { id: 'history',  label: 'Conversation History',   icon: Clock },
  { id: 'agents',   label: 'Agents',                 icon: Users },
  { id: 'faq',      label: 'FAQ',                    icon: BookOpen },
  { id: 'analytics',label: 'Analytics',              icon: BarChart2 },
  { id: 'tickets',  label: 'Tickets',                icon: Ticket },
  { id: 'settings', label: 'Settings',               icon: Settings },
] as const;
type TabId = typeof TABS[number]['id'];

const STATUS_CONV: Record<string, { label: string; color: string; bg: string }> = {
  open:     { label: 'Open',     color: '#10B981', bg: 'bg-emerald-500/15 text-emerald-400' },
  assigned: { label: 'Assigned', color: '#C9A84C', bg: 'bg-amber-500/15 text-amber-400' },
  resolved: { label: 'Resolved', color: '#6B7280', bg: 'bg-white/10 text-white/40' },
  missed:   { label: 'Missed',   color: '#EF4444', bg: 'bg-red-500/15 text-red-400' },
};
const STATUS_TICKET: Record<string, string> = {
  open:        'bg-emerald-500/15 text-emerald-400',
  in_progress: 'bg-amber-500/15 text-amber-400',
  resolved:    'bg-white/10 text-white/40',
  closed:      'bg-white/5 text-white/25',
};
const PRIORITY_TICKET: Record<string, string> = {
  low:    'bg-white/8 text-white/40',
  medium: 'bg-blue-500/15 text-blue-400',
  high:   'bg-amber-500/15 text-amber-400',
  urgent: 'bg-red-500/15 text-red-400',
};
const AGENT_STATUS: Record<string, { dot: string; label: string }> = {
  online:  { dot: 'bg-emerald-400', label: 'Online' },
  away:    { dot: 'bg-amber-400',   label: 'Away' },
  offline: { dot: 'bg-white/20',    label: 'Offline' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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

function KpiCard({ label, value, sub, color = '#C9A84C', icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs">{label}</p>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Widget Settings
// ─────────────────────────────────────────────────────────────────────────────
function WidgetTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [cfg,     setCfg]     = useState<Partial<SmartsuppConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch('/api/admin/smartsupp/config', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.config) setCfg(d.config); })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof SmartsuppConfig>(k: K, v: SmartsuppConfig[K]) {
    setCfg(p => ({ ...p, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const r = await fetch('/api/admin/smartsupp/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(cfg),
    });
    setSaving(false);
    showToast(r.ok ? 'Widget settings saved' : 'Save failed', r.ok);
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-white/20" /></div>;

  const color = cfg.widgetColor ?? '#C9A84C';

  return (
    <div className="space-y-5 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: form */}
        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <div>
              <p className="text-white text-sm font-medium">Enable Chat Widget</p>
              <p className="text-white/30 text-xs">Show Smartsupp widget on all public pages</p>
            </div>
            <button onClick={() => set('widgetEnabled', !cfg.widgetEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${cfg.widgetEnabled ? 'bg-primary' : 'bg-white/10'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${cfg.widgetEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {[
            { k: 'widgetName',    label: 'Widget Display Name',  ph: 'CGC Support' },
            { k: 'widgetGreeting',label: 'Greeting Message',     ph: 'Hello! How can we help?' },
            { k: 'autoMessage',   label: 'Auto-Message',         ph: 'Hi! Can I help you today?' },
          ].map(({ k, label, ph }) => (
            <div key={k}>
              <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
              <input value={String(cfg[k as keyof SmartsuppConfig] ?? '')}
                onChange={e => set(k as keyof SmartsuppConfig, e.target.value as never)}
                placeholder={ph}
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
            </div>
          ))}

          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Auto-Message Delay (seconds)</label>
            <input type="number" min={5} max={300} value={cfg.autoMessageDelay ?? 30}
              onChange={e => set('autoMessageDelay', parseInt(e.target.value, 10))}
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
          </div>

          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Offline Message</label>
            <textarea rows={2} value={cfg.offlineMessage ?? ''}
              onChange={e => set('offlineMessage', e.target.value)}
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 resize-none" />
          </div>

          {/* Position */}
          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Widget Position</label>
            <div className="flex gap-2">
              {(['bottom-right', 'bottom-left'] as const).map(pos => (
                <button key={pos} onClick={() => set('widgetPosition', pos)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    cfg.widgetPosition === pos ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/8 text-white/40 hover:text-white'
                  }`}>
                  {pos === 'bottom-right' ? '↘ Bottom Right' : '↙ Bottom Left'}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Widget Accent Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={e => set('widgetColor', e.target.value)}
                className="w-10 h-10 rounded-xl border border-white/8 bg-transparent cursor-pointer" />
              <input value={color} onChange={e => set('widgetColor', e.target.value)}
                className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
            </div>
          </div>

          {/* Toggles */}
          {[
            { k: 'soundEnabled',  label: 'Sound Notifications',  desc: 'Play sound on new message' },
            { k: 'ratingEnabled', label: 'Conversation Rating',   desc: 'Ask visitors to rate the chat' },
          ].map(({ k, label, desc }) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <p className="text-white/70 text-sm">{label}</p>
                <p className="text-white/30 text-xs">{desc}</p>
              </div>
              <button onClick={() => set(k as keyof SmartsuppConfig, !cfg[k as keyof SmartsuppConfig] as never)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${cfg[k as keyof SmartsuppConfig] ? 'bg-primary' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cfg[k as keyof SmartsuppConfig] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Right: live preview */}
        <div className="space-y-4">
          <p className="text-white/25 text-[10px] uppercase tracking-widest">Live Preview</p>
          <div className="relative rounded-2xl border border-white/8 overflow-hidden" style={{ background: '#0d0d0d', minHeight: 320 }}>
            {/* Mock browser bar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
              <div className="flex-1 mx-3 h-4 rounded bg-white/5 text-[9px] text-white/20 flex items-center px-2">citygate.capital</div>
            </div>
            {/* Page content placeholder */}
            <div className="p-4 space-y-2">
              {[80, 60, 70, 50].map((w, i) => (
                <div key={i} className="h-2 rounded-full bg-white/5" style={{ width: `${w}%` }} />
              ))}
            </div>
            {/* Widget bubble */}
            <div className={`absolute bottom-4 ${cfg.widgetPosition === 'bottom-left' ? 'left-4' : 'right-4'} flex flex-col items-end gap-2`}>
              {cfg.widgetGreeting && (
                <div className="px-3 py-2 rounded-2xl rounded-br-sm text-[11px] text-white max-w-[160px] shadow-lg"
                  style={{ background: color }}>
                  {cfg.widgetGreeting}
                </div>
              )}
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl"
                style={{ background: color }}>
                <MessageSquare size={18} className="text-black" />
              </div>
            </div>
          </div>

          {/* Smartsupp embed snippet */}
          {cfg.chatId && (
            <div className="rounded-xl border border-white/8 p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <p className="text-white/25 text-[10px] uppercase tracking-wide mb-2">Embed Snippet</p>
              <pre className="text-[10px] text-emerald-400/70 font-mono overflow-x-auto whitespace-pre-wrap break-all">{`<script>
  var _smartsupp = _smartsupp || {};
  _smartsupp.key = '${cfg.chatId}';
  window.smartsupp||(function(d) {
    var s,c,o=smartsupp=function(){
      o._.push(arguments)};o._=[];
    s=d.getElementsByTagName('script')[0];
    c=d.createElement('script');
    c.type='text/javascript';
    c.charset='utf-8';c.async=!0;
    c.src='https://www.smartsuppchat.com/loader.js?';
    s.parentNode.insertBefore(c,s);
  })(document);
</script>`}</pre>
            </div>
          )}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        Save Widget Settings
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Live Chats
// ─────────────────────────────────────────────────────────────────────────────
function LiveTab({ showToast, agents }: { showToast: (m: string, ok?: boolean) => void; agents: Agent[] }) {
  const [convs,    setConvs]    = useState<Conversation[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [reply,    setReply]    = useState('');
  const [sending,  setSending]  = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/smartsupp/conversations?status=open&limit=50', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setConvs(d.data ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function action(convId: string, act: string, extra: Record<string, unknown> = {}) {
    const r = await fetch('/api/admin/smartsupp/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: act, id: convId, ...extra }),
    });
    const d = await r.json();
    if (r.ok) { showToast(act === 'resolve' ? 'Conversation resolved' : act === 'takeover' ? 'Taken over' : 'Done'); load(); if (selected?.id === convId) setSelected(d.conversation); }
    else showToast(d.error ?? 'Action failed', false);
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    await action(selected.id, 'add_message', { role: 'agent', message: reply.trim(), agentId: 'admin' });
    setReply('');
    setSending(false);
  }

  const DeviceIcon = ({ d }: { d: string }) =>
    d === 'mobile' ? <Smartphone size={10} className="text-white/30" /> : <Monitor size={10} className="text-white/30" />;

  return (
    <div className="pt-4 flex gap-4" style={{ minHeight: 480 }}>
      {/* Conversation list */}
      <div className="w-72 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/40 text-xs font-medium">{convs.length} open</p>
          <button onClick={load} className="text-white/25 hover:text-white/60 transition-colors"><RefreshCw size={12} /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-white/20" /></div>
        ) : convs.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-white/20">
            <MessageSquare size={20} />
            <p className="text-xs">No open chats</p>
          </div>
        ) : convs.map(c => (
          <button key={c.id} onClick={() => setSelected(c)}
            className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${
              selected?.id === c.id ? 'border-primary/30 bg-primary/5' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/80 text-xs font-medium truncate">{c.visitorName || 'Anonymous'}</p>
              <div className="flex items-center gap-1">
                <DeviceIcon d={c.device} />
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_CONV[c.status]?.bg}`}>{STATUS_CONV[c.status]?.label}</span>
              </div>
            </div>
            <p className="text-white/30 text-[10px] truncate">{c.messages[c.messages.length - 1]?.text ?? 'No messages'}</p>
            <p className="text-white/20 text-[9px] mt-1">{c.visitorCountry} · {c.messages.length} msgs</p>
          </button>
        ))}
      </div>

      {/* Chat thread */}
      <div className="flex-1 rounded-2xl border border-white/5 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.015)' }}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/20">
            <MessageSquare size={28} />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div>
                <p className="text-white font-semibold text-sm">{selected.visitorName || 'Anonymous'}</p>
                <p className="text-white/30 text-[10px]">{selected.visitorEmail} · {selected.pageUrl}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => action(selected.id, 'takeover', { agentId: 'admin' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20">
                  <PhoneCall size={10} /> Take Over
                </button>
                {agents.length > 0 && (
                  <select onChange={e => e.target.value && action(selected.id, 'assign', { agentId: e.target.value })}
                    className="bg-white/[0.04] border border-white/8 rounded-xl px-2 py-1.5 text-white/50 text-xs focus:outline-none">
                    <option value="">Assign to…</option>
                    {agents.map(a => <option key={a.id} value={a.id} className="bg-[#0A0A0A]">{a.name}</option>)}
                  </select>
                )}
                <button onClick={() => action(selected.id, 'resolve')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20">
                  <CheckCircle size={10} /> Resolve
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-4">No messages yet</p>
              ) : selected.messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'visitor' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-xs ${
                    m.role === 'visitor' ? 'bg-white/8 text-white/80 rounded-tl-sm' :
                    m.role === 'agent'   ? 'text-black rounded-tr-sm' : 'bg-white/5 text-white/40 rounded-tr-sm'
                  }`} style={m.role === 'agent' ? { background: 'linear-gradient(135deg,#C9A84C,#F0D080)' } : {}}>
                    <p>{m.text}</p>
                    <p className={`text-[9px] mt-1 ${m.role === 'agent' ? 'text-black/40' : 'text-white/25'}`}>
                      {new Date(m.ts).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div className="flex gap-2 p-3 border-t border-white/5">
              <input value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                placeholder="Type a reply…"
                className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                {sending ? <Loader2 size={14} className="animate-spin text-black" /> : <Send size={14} className="text-black" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Conversation History
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab() {
  const [convs,    setConvs]    = useState<Conversation[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) p.set('search', search);
    if (status) p.set('status', status);
    const r = await fetch(`/api/admin/smartsupp/conversations?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setConvs(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search visitor, email, message…"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="" className="bg-[#0A0A0A]">All Statuses</option>
          {Object.entries(STATUS_CONV).map(([k, v]) => <option key={k} value={k} className="bg-[#0A0A0A]">{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      ) : convs.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2 text-white/20"><Clock size={24} /><p className="text-sm">No conversations found</p></div>
      ) : (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Visitor', 'Status', 'Messages', 'Rating', 'Started', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {convs.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-white/80 text-xs font-medium">{c.visitorName || 'Anonymous'}</p>
                    <p className="text-white/30 text-[10px]">{c.visitorEmail || c.visitorCountry}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CONV[c.status]?.bg}`}>{STATUS_CONV[c.status]?.label}</span>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs font-mono">{c.messages.length}</td>
                  <td className="px-4 py-3">
                    {c.rating ? (
                      <div className="flex items-center gap-1">
                        <Star size={10} className="text-amber-400 fill-amber-400" />
                        <span className="text-white/60 text-xs">{c.rating}</span>
                      </div>
                    ) : <span className="text-white/20 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-white/30 text-[10px] whitespace-nowrap">{new Date(c.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(c)}
                      className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                      <Eye size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-white/25 text-xs">{Math.min((page-1)*LIMIT+1,total)}–{Math.min(page*LIMIT,total)} of {total}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.04]">Prev</button>
            <span className="flex items-center px-3 text-white/30 text-xs">{page}/{pages}</span>
            <button onClick={() => setPage(p => Math.min(pages,p+1))} disabled={page>=pages} className="px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.04]">Next</button>
          </div>
        </div>
      )}

      {/* Thread modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden"
              style={{ background: '#111', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <p className="text-white font-semibold">{selected.visitorName || 'Anonymous'}</p>
                  <p className="text-white/30 text-xs">{selected.visitorEmail} · {selected.visitorCountry}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'visitor' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs ${
                      m.role === 'visitor' ? 'bg-white/8 text-white/80 rounded-tl-sm' : 'text-black rounded-tr-sm'
                    }`} style={m.role !== 'visitor' ? { background: 'linear-gradient(135deg,#C9A84C,#F0D080)' } : {}}>
                      <p>{m.text}</p>
                      <p className={`text-[9px] mt-1 ${m.role !== 'visitor' ? 'text-black/40' : 'text-white/25'}`}>{new Date(m.ts).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                {selected.messages.length === 0 && <p className="text-white/20 text-xs text-center py-4">No messages</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Agents
// ─────────────────────────────────────────────────────────────────────────────
function AgentsTab({ showToast, onAgentsChange }: { showToast: (m: string, ok?: boolean) => void; onAgentsChange: (a: Agent[]) => void }) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState<Partial<Agent> | null>(null);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/smartsupp/agents', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setAgents(d.agents ?? []); onAgentsChange(d.agents ?? []); }
    setLoading(false);
  }, [onAgentsChange]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    const r = await fetch('/api/admin/smartsupp/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { showToast(form.id ? 'Agent updated' : 'Agent added'); setForm(null); load(); }
    else showToast('Save failed', false);
  }

  async function del(id: string) {
    const r = await fetch('/api/admin/smartsupp/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (r.ok) { showToast('Agent removed'); load(); }
    else showToast('Delete failed', false);
  }

  async function setStatus(id: string, status: Agent['status']) {
    await fetch('/api/admin/smartsupp/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  return (
    <div className="pt-4 space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setForm({ name: '', email: '', role: 'agent', status: 'offline' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
          <UserPlus size={13} /> Add Agent
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map(a => (
            <div key={a.id} className="rounded-2xl border border-white/5 p-4 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0A0A0A] ${AGENT_STATUS[a.status]?.dot}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium text-sm">{a.name}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    a.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-white/8 text-white/40'
                  }`}>{a.role}</span>
                </div>
                <p className="text-white/30 text-[10px] truncate">{a.email}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30">
                  <span>{a.assignedCount} assigned</span>
                  <span>{a.resolvedCount} resolved</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {(['online', 'away', 'offline'] as const).map(s => (
                    <button key={s} onClick={() => setStatus(a.id, s)}
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-medium transition-colors ${
                        a.status === s ? `${AGENT_STATUS[s].dot.replace('bg-', 'bg-').replace('-400', '-500/20')} text-white/70` : 'bg-white/5 text-white/25 hover:bg-white/10'
                      }`}>
                      {AGENT_STATUS[s].label}
                    </button>
                  ))}
                  <button onClick={() => setForm(a)} className="ml-auto w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10">
                    <Edit2 size={10} />
                  </button>
                  <button onClick={() => del(a.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <AnimatePresence>
        {form && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setForm(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/10 p-6 space-y-4"
              style={{ background: '#111' }}>
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">{form.id ? 'Edit Agent' : 'Add Agent'}</p>
                <button onClick={() => setForm(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              {[
                { k: 'name',  label: 'Full Name',  ph: 'John Smith' },
                { k: 'email', label: 'Email',       ph: 'agent@citygate.capital' },
              ].map(({ k, label, ph }) => (
                <div key={k}>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
                  <input value={String(form[k as keyof Agent] ?? '')}
                    onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                    placeholder={ph}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                </div>
              ))}
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Role</label>
                <select value={form.role ?? 'agent'} onChange={e => setForm(p => ({ ...p, role: e.target.value as Agent['role'] }))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
                  <option value="agent" className="bg-[#0A0A0A]">Agent</option>
                  <option value="admin" className="bg-[#0A0A0A]">Admin</option>
                </select>
              </div>
              <button onClick={save} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {form.id ? 'Update' : 'Add Agent'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: FAQ
// ─────────────────────────────────────────────────────────────────────────────
function FaqTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [faq,     setFaq]     = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<FaqEntry> | null>(null);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/smartsupp/faq', { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setFaq(d.faq ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const r = await fetch('/api/admin/smartsupp/faq', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (r.ok) { showToast(editing.id ? 'FAQ updated' : 'FAQ added'); setEditing(null); load(); }
    else showToast('Save failed', false);
  }

  async function del(id: string) {
    const r = await fetch('/api/admin/smartsupp/faq', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (r.ok) { showToast('FAQ removed'); load(); }
    else showToast('Delete failed', false);
  }

  async function toggle(entry: FaqEntry) {
    await fetch('/api/admin/smartsupp/faq', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id: entry.id, enabled: !entry.enabled }),
    });
    load();
  }

  const categories = [...new Set(faq.map(f => f.category))];

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs">{faq.length} entries · {faq.filter(f => f.enabled).length} active</p>
        <button onClick={() => setEditing({ question: '', answer: '', category: 'General', enabled: true, triggerKeywords: [] })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
          <Plus size={13} /> Add FAQ
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      ) : (
        <div className="space-y-2">
          {faq.map(f => (
            <div key={f.id} className={`rounded-2xl border p-4 transition-all ${f.enabled ? 'border-white/5' : 'border-white/[0.03] opacity-50'}`}
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary/70 font-medium">{f.category}</span>
                    <span className="text-white/20 text-[9px]">{f.viewCount} views · {f.helpfulCount} helpful</span>
                  </div>
                  <p className="text-white/80 text-sm font-medium">{f.question}</p>
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">{f.answer}</p>
                  {f.triggerKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {f.triggerKeywords.map(kw => (
                        <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded-lg bg-white/5 text-white/30 font-mono">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggle(f)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${f.enabled ? 'bg-primary' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => setEditing(f)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10">
                    <Edit2 size={10} />
                  </button>
                  <button onClick={() => del(f.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/20">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4"
              style={{ background: '#111' }}>
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">{editing.id ? 'Edit FAQ' : 'Add FAQ'}</p>
                <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Question</label>
                <input value={editing.question ?? ''} onChange={e => setEditing(p => ({ ...p, question: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Answer</label>
                <textarea rows={4} value={editing.answer ?? ''} onChange={e => setEditing(p => ({ ...p, answer: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Category</label>
                  <input value={editing.category ?? ''} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
                    list="faq-cats"
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  <datalist id="faq-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Trigger Keywords</label>
                  <input value={(editing.triggerKeywords ?? []).join(', ')}
                    onChange={e => setEditing(p => ({ ...p, triggerKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                    placeholder="transfer, wire, send"
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                </div>
              </div>
              <button onClick={save} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {editing.id ? 'Update FAQ' : 'Add FAQ'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Analytics
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [data,    setData]    = useState<{ snapshots: AnalyticsSnapshot[]; summary: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/smartsupp/analytics', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-white/20" /></div>;
  if (!data) return <div className="py-8 text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={14} /> Failed to load analytics</div>;

  const s = data.summary;
  const snaps = data.snapshots;
  const maxConvs = Math.max(...snaps.map(s => s.totalConversations), 1);

  return (
    <div className="pt-4 space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Conversations" value={s.totalConversations ?? 0} icon={MessageSquare} color="#C9A84C" />
        <KpiCard label="Resolved" value={s.resolvedConversations ?? 0} sub={`${s.totalConversations ? Math.round((s.resolvedConversations/s.totalConversations)*100) : 0}% resolution rate`} icon={CheckCircle} color="#10B981" />
        <KpiCard label="Missed" value={s.missedConversations ?? 0} icon={XCircle} color="#EF4444" />
        <KpiCard label="Avg Rating" value={s.avgRating ? s.avgRating.toFixed(1) : '—'} sub="out of 5.0" icon={Star} color="#F59E0B" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Open Now" value={s.openConversations ?? 0} icon={Zap} color="#06B6D4" />
        <KpiCard label="Assigned" value={s.assignedConversations ?? 0} icon={UserCheck} color="#8B5CF6" />
        <KpiCard label="Total Tickets" value={s.totalTickets ?? 0} icon={Ticket} color="#F97316" />
        <KpiCard label="Urgent Tickets" value={s.urgentTickets ?? 0} icon={AlertTriangle} color="#EF4444" />
      </div>

      {/* 14-day chart */}
      <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-white font-semibold text-sm mb-4">14-Day Conversation Volume</p>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {snaps.map((snap, i) => {
            const h = maxConvs > 0 ? Math.max(4, Math.round((snap.totalConversations / maxConvs) * 80)) : 4;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-white/10 text-white/70 text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {snap.totalConversations} chats
                </div>
                <div className="w-full rounded-t-sm transition-all" style={{ height: h, background: 'linear-gradient(180deg,#C9A84C,#C9A84C80)' }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          <p className="text-white/20 text-[9px]">{snaps[0]?.date}</p>
          <p className="text-white/20 text-[9px]">{snaps[snaps.length - 1]?.date}</p>
        </div>
      </div>

      {/* Daily breakdown table */}
      <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-white font-semibold text-sm">Daily Breakdown</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Date', 'Total', 'Resolved', 'Missed', 'Messages', 'Visitors'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-white/25 text-[10px] uppercase tracking-wide font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {[...snaps].reverse().slice(0, 7).map(snap => (
              <tr key={snap.date} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-white/50 text-xs font-mono">{snap.date}</td>
                <td className="px-4 py-2.5 text-white/70 text-xs font-mono">{snap.totalConversations}</td>
                <td className="px-4 py-2.5 text-emerald-400 text-xs font-mono">{snap.resolvedConversations}</td>
                <td className="px-4 py-2.5 text-red-400 text-xs font-mono">{snap.missedConversations}</td>
                <td className="px-4 py-2.5 text-white/50 text-xs font-mono">{snap.totalMessages}</td>
                <td className="px-4 py-2.5 text-white/50 text-xs font-mono">{snap.uniqueVisitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Tickets
// ─────────────────────────────────────────────────────────────────────────────
function TicketsTab({ showToast, agents }: { showToast: (m: string, ok?: boolean) => void; agents: Agent[] }) {
  const [tickets,  setTickets]  = useState<SupportTicket[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [status,   setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [creating, setCreating] = useState(false);
  const [form,     setForm]     = useState<Partial<SupportTicket>>({});
  const [saving,   setSaving]   = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (status)   p.set('status',   status);
    if (priority) p.set('priority', priority);
    if (search)   p.set('search',   search);
    const r = await fetch(`/api/admin/smartsupp/tickets?${p}`, { headers: authHeaders() });
    if (r.ok) { const d = await r.json(); setTickets(d.data ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [page, status, priority, search]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setSaving(true);
    const r = await fetch('/api/admin/smartsupp/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { showToast('Ticket created'); setCreating(false); setForm({}); load(); }
    else showToast('Create failed', false);
  }

  async function updateStatus(id: string, newStatus: SupportTicket['status']) {
    const r = await fetch('/api/admin/smartsupp/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'update', id, status: newStatus }),
    });
    if (r.ok) { showToast('Ticket updated'); load(); }
    else showToast('Update failed', false);
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="pt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tickets…"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="" className="bg-[#0A0A0A]">All Statuses</option>
          {['open','in_progress','resolved','closed'].map(s => <option key={s} value={s} className="bg-[#0A0A0A]">{s.replace('_',' ')}</option>)}
        </select>
        <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
          <option value="" className="bg-[#0A0A0A]">All Priorities</option>
          {['low','medium','high','urgent'].map(p => <option key={p} value={p} className="bg-[#0A0A0A]">{p}</option>)}
        </select>
        <button onClick={() => { setCreating(true); setForm({ priority: 'medium', status: 'open' }); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-black"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
          <Plus size={13} /> New Ticket
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-white/20" /></div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2 text-white/20"><Ticket size={24} /><p className="text-sm">No tickets found</p></div>
      ) : (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['ID', 'Subject', 'Visitor', 'Priority', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-white/25 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/40 text-[10px] font-mono">{t.id}</td>
                  <td className="px-4 py-3 text-white/70 text-xs max-w-[180px] truncate">{t.subject}</td>
                  <td className="px-4 py-3">
                    <p className="text-white/60 text-xs">{t.visitorName}</p>
                    <p className="text-white/25 text-[10px]">{t.visitorEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${PRIORITY_TICKET[t.priority]}`}>{t.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={t.status}
                      onChange={e => updateStatus(t.id, e.target.value as SupportTicket['status'])}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer ${STATUS_TICKET[t.status]}`}
                      style={{ background: 'transparent' }}>
                      {['open','in_progress','resolved','closed'].map(s => <option key={s} value={s} className="bg-[#0A0A0A] text-white">{s.replace('_',' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-white/30 text-[10px] whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => updateStatus(t.id, 'resolved')} disabled={t.status === 'resolved'}
                      className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-20">
                      <CheckCircle size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-white/25 text-xs">{Math.min((page-1)*LIMIT+1,total)}–{Math.min(page*LIMIT,total)} of {total}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.04]">Prev</button>
            <span className="flex items-center px-3 text-white/30 text-xs">{page}/{pages}</span>
            <button onClick={() => setPage(p => Math.min(pages,p+1))} disabled={page>=pages} className="px-3 py-1.5 rounded-xl border border-white/8 text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.04]">Next</button>
          </div>
        </div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setCreating(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4"
              style={{ background: '#111' }}>
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">Create Support Ticket</p>
                <button onClick={() => setCreating(false)} className="text-white/30 hover:text-white"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'visitorName',  label: 'Customer Name',  ph: 'John Smith' },
                  { k: 'visitorEmail', label: 'Customer Email', ph: 'john@example.com' },
                ].map(({ k, label, ph }) => (
                  <div key={k}>
                    <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
                    <input value={String(form[k as keyof SupportTicket] ?? '')}
                      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={ph}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Subject</label>
                <input value={form.subject ?? ''} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Brief description of the issue"
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40" />
              </div>
              <div>
                <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea rows={3} value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Priority</label>
                  <select value={form.priority ?? 'medium'} onChange={e => setForm(p => ({ ...p, priority: e.target.value as SupportTicket['priority'] }))}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    {['low','medium','high','urgent'].map(p => <option key={p} value={p} className="bg-[#0A0A0A] capitalize">{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Assign To</label>
                  <select value={form.assignedAgentId ?? ''} onChange={e => setForm(p => ({ ...p, assignedAgentId: e.target.value || null }))}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    <option value="" className="bg-[#0A0A0A]">Unassigned</option>
                    {agents.map(a => <option key={a.id} value={a.id} className="bg-[#0A0A0A]">{a.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={create} disabled={saving || !form.subject}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Ticket size={13} />}
                Create Ticket
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Settings (API Key, Chat ID)
// ─────────────────────────────────────────────────────────────────────────────
function SettingsTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [cfg,     setCfg]     = useState<Partial<SmartsuppConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [show,    setShow]    = useState(false);

  useEffect(() => {
    fetch('/api/admin/smartsupp/config', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.config) setCfg(d.config); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const r = await fetch('/api/admin/smartsupp/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(cfg),
    });
    setSaving(false);
    showToast(r.ok ? 'Settings saved' : 'Save failed', r.ok);
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-white/20" /></div>;

  return (
    <div className="pt-4 space-y-5 max-w-lg">
      <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-amber-400 text-xs font-semibold mb-1">Smartsupp Integration</p>
          <p className="text-white/40 text-xs leading-relaxed">
            Enter your Smartsupp Chat ID and API Key from your Smartsupp dashboard.
            The Chat ID is used for the embed widget; the API Key enables server-side conversation management.
          </p>
        </div>
      </div>

      <div>
        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Chat ID (Widget Key)</label>
        <input value={cfg.chatId ?? ''} onChange={e => setCfg(p => ({ ...p, chatId: e.target.value }))}
          placeholder="e.g. abc123def456"
          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
        <p className="text-white/25 text-[10px] mt-1">Found in Smartsupp Dashboard → Settings → Chat box → Chat ID</p>
      </div>

      <div>
        <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">API Key</label>
        <div className="relative">
          <input type={show ? 'text' : 'password'} value={cfg.apiKey ?? ''}
            onChange={e => setCfg(p => ({ ...p, apiKey: e.target.value }))}
            placeholder="Your Smartsupp API key"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 pr-10 py-2.5 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-primary/40" />
          <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-white/25 text-[10px] mt-1">Found in Smartsupp Dashboard → Settings → API</p>
      </div>

      <div className="p-4 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-white/40 text-xs font-medium mb-2">Quick Links</p>
        <div className="space-y-1.5">
          {[
            ['Smartsupp Dashboard', 'https://app.smartsupp.com'],
            ['API Documentation', 'https://docs.smartsupp.com/rest-api/'],
            ['Widget Customization', 'https://docs.smartsupp.com/chat-box/'],
          ].map(([label, url]) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group">
              <span className="text-white/50 text-xs group-hover:text-white/80">{label}</span>
              <ArrowRight size={10} className="text-white/20 group-hover:text-white/50" />
            </a>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-black text-sm disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#C9A84C,#F0D080)' }}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        Save Settings
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminChatbot() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab,    setTab]    = useState<TabId>('widget');
  const [toast,  setToast]  = useState<{ msg: string; ok: boolean } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  return (
    <>
      <Helmet>
        <title>Chatbot Center — CGC Admin</title>
        <meta name="description" content="Smartsupp live chat management, FAQ, agents, tickets, and analytics." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://citygate.capital/admin/chatbot" />
      </Helmet>
      <AdminLayout title="Chatbot Center">

        <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Chatbot Center</h1>
            <p className="text-white/30 text-sm">Smartsupp live chat · agents · FAQ · tickets · analytics</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/40 text-xs">Smartsupp</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 mb-6 p-1 rounded-2xl border border-white/5 w-fit" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === t.id ? 'bg-primary/15 text-primary border border-primary/20' : 'text-white/40 hover:text-white/70'
              }`}>
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {tab === 'widget'    && <WidgetTab    showToast={showToast} />}
            {tab === 'live'      && <LiveTab      showToast={showToast} agents={agents} />}
            {tab === 'history'   && <HistoryTab />}
            {tab === 'agents'    && <AgentsTab    showToast={showToast} onAgentsChange={setAgents} />}
            {tab === 'faq'       && <FaqTab       showToast={showToast} />}
            {tab === 'analytics' && <AnalyticsTab />}
            {tab === 'tickets'   && <TicketsTab   showToast={showToast} agents={agents} />}
            {tab === 'settings'  && <SettingsTab  showToast={showToast} />}
          </motion.div>
        </AnimatePresence>

      </AdminLayout>
    </>
  );
}
