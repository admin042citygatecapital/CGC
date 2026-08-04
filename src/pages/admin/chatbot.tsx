import { Helmet } from '@dr.pogodin/react-helmet';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  MessageSquare, Save, CheckCircle, Bot, Zap,
  Phone, Users, AlertCircle,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useAdminAuth, authHeaders } from '@/lib/adminAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatbotConfig {
  // Widget
  widgetEnabled: boolean;
  widgetPosition: 'bottom-right' | 'bottom-left';
  widgetColor: string;
  widgetGreeting: string;
  widgetName: string;
  widgetAvatar: string;

  // Provider
  provider: 'none' | 'intercom' | 'crisp' | 'tawk' | 'custom' | 'ai';
  providerKey: string;
  providerWorkspaceId: string;

  // AI assistant
  aiEnabled: boolean;
  aiModel: string;
  aiSystemPrompt: string;
  aiEscalationKeywords: string;

  // Live support
  liveSupportEnabled: boolean;
  liveSupportHours: string;
  liveSupportEmail: string;

  // Channels
  whatsappEnabled: boolean;
  whatsappNumber: string;
  telegramEnabled: boolean;
  telegramUsername: string;

  // Escalation
  escalationEnabled: boolean;
  escalationEmail: string;
  escalationThreshold: string;
}

const DEFAULT: ChatbotConfig = {
  widgetEnabled: true,
  widgetPosition: 'bottom-right',
  widgetColor: '#C9A84C',
  widgetGreeting: 'Hello! How can we help you today?',
  widgetName: 'CGC Support',
  widgetAvatar: '',

  provider: 'none',
  providerKey: '',
  providerWorkspaceId: '',

  aiEnabled: false,
  aiModel: 'claude-sonnet-4-6',
  aiSystemPrompt: 'You are a helpful banking assistant for City Gate Capital. Answer questions about accounts, transfers, and services. For sensitive account issues, escalate to a human agent.',
  aiEscalationKeywords: 'fraud, stolen, hacked, urgent, emergency, complaint',

  liveSupportEnabled: false,
  liveSupportHours: 'Mon–Fri 9am–6pm GMT',
  liveSupportEmail: 'support@citygate.capital',

  whatsappEnabled: false,
  whatsappNumber: '+447888382458',
  telegramEnabled: false,
  telegramUsername: '@citygatecapital',

  escalationEnabled: true,
  escalationEmail: 'support@citygate.capital',
  escalationThreshold: '3',
};

const TABS = [
  { id: 'widget',    label: 'Widget',       icon: MessageSquare },
  { id: 'provider',  label: 'Provider',     icon: Zap },
  { id: 'ai',        label: 'AI Assistant', icon: Bot },
  { id: 'channels',  label: 'Channels',     icon: Phone },
  { id: 'escalation',label: 'Escalation',   icon: AlertCircle },
];

const PROVIDERS = [
  { id: 'none',      label: 'None (disabled)',       desc: 'No third-party chat provider' },
  { id: 'intercom',  label: 'Intercom',              desc: 'Enterprise live chat & CRM' },
  { id: 'crisp',     label: 'Crisp',                 desc: 'Modern live chat for startups' },
  { id: 'tawk',      label: 'Tawk.to',               desc: 'Free live chat software' },
  { id: 'ai',        label: 'Built-in AI (CGC)',      desc: 'Use the platform AI assistant' },
  { id: 'custom',    label: 'Custom / Embed Code',   desc: 'Paste your own embed script' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminChatbot() {
  const { admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab]     = useState('widget');
  const [cfg, setCfg]     = useState<ChatbotConfig>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!authLoading && !admin) navigate('/admin/login'); }, [admin, authLoading, navigate]);

  useEffect(() => {
    fetch('/api/admin/chatbot', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.config) setCfg(prev => ({ ...prev, ...d.config })); })
      .catch(() => {});
  }, []);

  function set<K extends keyof ChatbotConfig>(key: K, value: ChatbotConfig[K]) {
    setCfg(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/admin/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ config: cfg }),
      });
    } catch { /* non-critical */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const Field = ({ k, label, type = 'text', placeholder = '' }: { k: keyof ChatbotConfig; label: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <input type={type} value={String(cfg[k])} onChange={e => set(k, e.target.value as ChatbotConfig[typeof k])}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors" />
    </div>
  );

  const TextArea = ({ k, label, rows = 4, placeholder = '' }: { k: keyof ChatbotConfig; label: string; rows?: number; placeholder?: string }) => (
    <div>
      <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">{label}</label>
      <textarea rows={rows} value={String(cfg[k])} onChange={e => set(k, e.target.value as ChatbotConfig[typeof k])}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors resize-none" />
    </div>
  );

  const Toggle = ({ k, label, desc }: { k: keyof ChatbotConfig; label: string; desc?: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        {desc && <p className="text-white/30 text-xs">{desc}</p>}
      </div>
      <button type="button" onClick={() => set(k, !cfg[k] as ChatbotConfig[typeof k])}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${cfg[k] ? 'bg-primary' : 'bg-white/10'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${cfg[k] ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  return (
    <>
      <Helmet><title>Chatbot — CGC Admin</title><meta name="robots" content="noindex" /></Helmet>
      <AdminLayout title="Chatbot">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-xl font-bold">Chatbot Integration Center</h1>
            <p className="text-white/30 text-sm">Configure live support, AI assistant, and messaging channels</p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle size={14} /> Saved
              </motion.div>
            )}
            <button onClick={handleSave} disabled={saving}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-black text-sm overflow-hidden disabled:opacity-60">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <span className="relative flex items-center gap-2">
                {saving ? <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
                Save Config
              </span>
            </button>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Widget',       active: cfg.widgetEnabled,      icon: MessageSquare, color: '#C9A84C' },
            { label: 'AI Assistant', active: cfg.aiEnabled,          icon: Bot,           color: '#627EEA' },
            { label: 'Live Support', active: cfg.liveSupportEnabled, icon: Users,         color: '#10B981' },
            { label: 'Escalation',   active: cfg.escalationEnabled,  icon: AlertCircle,   color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-white/5 p-4 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${s.color}15` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-white/40 text-xs">{s.label}</p>
                <p className={`text-sm font-bold ${s.active ? 'text-emerald-400' : 'text-white/25'}`}>
                  {s.active ? 'Active' : 'Off'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-44 shrink-0 space-y-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  tab === t.id ? 'text-black' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
                style={tab === t.id ? { background: 'linear-gradient(135deg, #C9A84C, #F0D080)' } : {}}>
                <t.icon size={14} className={tab === t.id ? 'text-black' : 'text-white/30'} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)' }}>

            {/* Widget tab */}
            {tab === 'widget' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><MessageSquare size={14} className="text-primary" /> Chat Widget</h3>
                <Toggle k="widgetEnabled" label="Enable Chat Widget" desc="Show floating chat button on all public pages" />
                <Field k="widgetName" label="Widget Display Name" placeholder="CGC Support" />
                <Field k="widgetGreeting" label="Greeting Message" placeholder="Hello! How can we help you today?" />
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Widget Position</label>
                  <div className="flex gap-3">
                    {(['bottom-right', 'bottom-left'] as const).map(pos => (
                      <button key={pos} type="button" onClick={() => set('widgetPosition', pos)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                          cfg.widgetPosition === pos
                            ? 'border-primary/40 text-primary bg-primary/10'
                            : 'border-white/8 text-white/40 hover:text-white/70'
                        }`}>
                        {pos === 'bottom-right' ? '↘ Bottom Right' : '↙ Bottom Left'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">Widget Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={cfg.widgetColor} onChange={e => set('widgetColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-white/8 bg-transparent cursor-pointer" />
                    <input value={cfg.widgetColor} onChange={e => set('widgetColor', e.target.value)}
                      className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors" />
                  </div>
                </div>
                {/* Live preview */}
                <div className="p-4 rounded-xl border border-white/8 relative" style={{ background: 'rgba(0,0,0,0.3)', minHeight: 120 }}>
                  <p className="text-white/25 text-xs mb-3">Widget Preview</p>
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <div className="px-3 py-2 rounded-2xl rounded-br-sm text-xs text-white max-w-[160px]"
                      style={{ background: cfg.widgetColor }}>
                      {cfg.widgetGreeting || 'Hello!'}
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                      style={{ background: cfg.widgetColor }}>
                      <MessageSquare size={16} className="text-black" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Provider tab */}
            {tab === 'provider' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Zap size={14} className="text-primary" /> Chat Provider</h3>
                <div className="space-y-2">
                  {PROVIDERS.map(p => (
                    <button key={p.id} type="button" onClick={() => set('provider', p.id as ChatbotConfig['provider'])}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors ${
                        cfg.provider === p.id
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                        cfg.provider === p.id ? 'border-primary' : 'border-white/20'
                      }`}>
                        {cfg.provider === p.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{p.label}</p>
                        <p className="text-white/30 text-xs">{p.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {cfg.provider !== 'none' && cfg.provider !== 'ai' && (
                  <div className="space-y-4 pt-2">
                    <Field k="providerKey" label="API Key / App ID" placeholder="Enter your provider key" />
                    <Field k="providerWorkspaceId" label="Workspace / Site ID" placeholder="Enter workspace ID" />
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <p className="text-white/40 text-xs">
                        {cfg.provider === 'intercom' && 'Get your App ID from Intercom Settings → Installation → Web.'}
                        {cfg.provider === 'crisp' && 'Get your Website ID from Crisp Dashboard → Settings → Integrations.'}
                        {cfg.provider === 'tawk' && 'Get your Property ID from Tawk.to Dashboard → Administration → Channels.'}
                        {cfg.provider === 'custom' && 'Paste your custom embed script key or identifier above.'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* AI tab */}
            {tab === 'ai' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Bot size={14} className="text-primary" /> AI Assistant</h3>
                <Toggle k="aiEnabled" label="Enable AI Assistant" desc="Automatically respond to common banking questions" />
                <div>
                  <label className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5 block">AI Model</label>
                  <select value={cfg.aiModel} onChange={e => set('aiModel', e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/40 transition-colors">
                    {[
                      ['claude-sonnet-4-6', 'Claude Sonnet 4.6 (Recommended)'],
                      ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (Fast)'],
                      ['gpt-5', 'GPT-5'],
                      ['gpt-5-mini', 'GPT-5 Mini (Cost-efficient)'],
                      ['gemini-2.5-flash', 'Gemini 2.5 Flash'],
                    ].map(([v, l]) => <option key={v} value={v} className="bg-[#0A0A0A]">{l}</option>)}
                  </select>
                </div>
                <TextArea k="aiSystemPrompt" label="System Prompt" rows={5}
                  placeholder="You are a helpful banking assistant for City Gate Capital..." />
                <Field k="aiEscalationKeywords" label="Escalation Keywords (comma-separated)"
                  placeholder="fraud, stolen, urgent, complaint" />
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <p className="text-white/40 text-xs">When the AI detects escalation keywords, it will automatically offer to connect the user with a live agent or send an email to the support team.</p>
                </div>
              </>
            )}

            {/* Channels tab */}
            {tab === 'channels' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Phone size={14} className="text-primary" /> Messaging Channels</h3>
                <Toggle k="liveSupportEnabled" label="Live Chat Support" desc="Enable real-time agent chat" />
                <Field k="liveSupportHours" label="Support Hours" placeholder="Mon–Fri 9am–6pm GMT" />
                <Field k="liveSupportEmail" label="Support Email" placeholder="support@citygate.capital" />
                <div className="pt-2 border-t border-white/5">
                  <Toggle k="whatsappEnabled" label="WhatsApp Support" desc="Connect via WhatsApp Business" />
                  {cfg.whatsappEnabled && <Field k="whatsappNumber" label="WhatsApp Number" placeholder="+447888382458" />}
                </div>
                <div className="border-t border-white/5 pt-2">
                  <Toggle k="telegramEnabled" label="Telegram Support" desc="Connect via Telegram bot or channel" />
                  {cfg.telegramEnabled && <Field k="telegramUsername" label="Telegram Username / Bot" placeholder="@citygatecapital" />}
                </div>
              </>
            )}

            {/* Escalation tab */}
            {tab === 'escalation' && (
              <>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2"><AlertCircle size={14} className="text-primary" /> Escalation Rules</h3>
                <Toggle k="escalationEnabled" label="Auto-Escalation" desc="Escalate to human agent after threshold" />
                <Field k="escalationEmail" label="Escalation Email" placeholder="support@citygate.capital" />
                <Field k="escalationThreshold" label="Unanswered Messages Before Escalation" type="number" placeholder="3" />
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-amber-400 text-xs font-semibold mb-1">Escalation Flow</p>
                      <p className="text-white/40 text-xs leading-relaxed">
                        When a user triggers escalation keywords or the AI cannot answer after {cfg.escalationThreshold} messages,
                        an alert is sent to <span className="text-white/60">{cfg.escalationEmail}</span> and the user is offered
                        live support options.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
