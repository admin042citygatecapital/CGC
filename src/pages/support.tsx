import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MessageCircle, Mail, Phone, ChevronDown, ChevronUp, Search, ArrowRight, Clock, Zap, Shield, BookOpen, CreditCard, Globe, Lock, Star, Send, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

const categories = [
  { label: 'Getting Started', count: 12, icon: BookOpen,    color: '#C9A84C' },
  { label: 'Account & KYC',   count: 8,  icon: Shield,      color: '#627EEA' },
  { label: 'Cards & Payments',count: 15, icon: CreditCard,  color: '#10B981' },
  { label: 'Transfers',       count: 10, icon: Globe,       color: '#9945FF' },
  { label: 'Crypto & Wallet', count: 14, icon: Lock,        color: '#EC4899' },
  { label: 'Security',        count: 9,  icon: Shield,      color: '#F7931A' },
];

const faqs = [
  {
    category: 'Getting Started',
    q: 'How do I open an account?',
    a: 'Click "Open Account" to create a preview profile and explore the demonstration. Identity verification is not live; a contracted KYC provider and legal approval are required before launch.',
  },
  {
    category: 'Account & KYC',
    q: 'Is my money safe with City Gate Capital?',
    a: 'This preview does not accept or protect customer funds. Demonstration balances are not deposits and are not insured. The application uses security controls for preview access, but live financial operation requires approved providers and independent review.',
  },
  {
    category: 'Transfers',
    q: 'What are the transfer fees?',
    a: 'Transfer screens use demonstration values only. Live fees, exchange rates, availability, and settlement terms will be published only after payment providers and target jurisdictions are approved.',
  },
  {
    category: 'Transfers',
    q: 'How long do international transfers take?',
    a: 'No live transfers are processed in this preview. Future settlement estimates will depend on the contracted payment rail, currency, recipient bank, compliance review, and jurisdiction.',
  },
  {
    category: 'Crypto & Wallet',
    q: 'What cryptocurrencies do you support?',
    a: 'The interface demonstrates several digital assets using market or sample data. City Gate Capital does not provide live trading or custody in this environment.',
  },
  {
    category: 'Cards & Payments',
    q: 'How do I freeze my card?',
    a: 'Open the app, go to Cards, select your card, and tap "Freeze". Your card is frozen instantly. You can unfreeze it just as quickly whenever you\'re ready.',
  },
  {
    category: 'Account & KYC',
    q: 'What is the daily transfer limit?',
    a: 'Preview limits are illustrative and do not authorize financial transactions. Live limits will be defined by risk policy, provider contracts, verification level, and applicable law.',
  },
  {
    category: 'Getting Started',
    q: 'How do I contact support?',
    a: 'You can reach us via live chat in the app (fastest), email at support@citygate.capital, or phone at +44 7888 382458. Premium and Elite customers have priority support with dedicated lines.',
  },
  {
    category: 'Security',
    q: 'What security features protect my account?',
    a: 'Your account is protected by biometric authentication (Face ID / Touch ID), 256-bit AES encryption, 2-factor authentication, real-time fraud detection, and automatic session timeouts. We also offer hardware security key support.',
  },
  {
    category: 'Cards & Payments',
    q: 'Can I use my card internationally?',
    a: 'Cards in this environment are demonstrations and cannot be used for purchases. Issuing coverage, fees, exchange rates, and card controls require an approved issuing partner before launch.',
  },
];

function FaqItem({ q, a, category }: { q: string; a: string; category: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/20 transition-colors">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-5 text-left group">
        <div className="flex-1 pr-4">
          <span className="text-[10px] text-primary/60 uppercase tracking-widest font-medium block mb-1">{category}</span>
          <span className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{q}</span>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${open ? 'bg-primary text-black' : 'bg-primary/10 text-primary'}`}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-6 pb-5">
          <p className="text-sm text-foreground/50 leading-relaxed">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

const supportStats = [
  { value: 'Web',      label: 'Preview Support',      icon: Zap,           color: '#C9A84C' },
  { value: 'Email',    label: 'Contact Channel',      icon: Clock,         color: '#627EEA' },
  { value: 'Tracked',  label: 'Support Requests',     icon: MessageCircle, color: '#10B981' },
  { value: 'Clear',    label: 'Launch Disclosures',   icon: Star,          color: '#9945FF' },
];

interface SupportConversation {
  id: string; subject: string; status: string;
  messages: { id: string; from: string; text: string; ts: string; adminName?: string }[];
  createdAt: string; updatedAt: string;
}

export default function SupportPage() {
  const { customer, token } = useCustomerAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Support chat state
  const [chatOpen, setChatOpen]       = useState(false);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConv, setSelectedConv]   = useState<SupportConversation | null>(null);
  const [newSubject, setNewSubject]   = useState('');
  const [newCategory] = useState('general');
  const [newMessage, setNewMessage]   = useState('');
  const [replyText, setReplyText]     = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError]     = useState('');
  const [chatSuccess, setChatSuccess] = useState('');

  useEffect(() => {
    if (!token || !chatOpen) return;
    fetch('/api/users/support', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.conversations) setConversations(d.conversations); })
      .catch(() => {});
  }, [token, chatOpen]);

  async function sendNewMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !newSubject.trim() || !newMessage.trim()) return;
    setChatLoading(true); setChatError('');
    try {
      const res = await fetch('/api/users/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: newSubject, category: newCategory, message: newMessage }),
      });
      const data = await res.json();
      if (!res.ok) { setChatError(data.error ?? 'Failed to send.'); return; }
      setConversations(prev => [data.conversation, ...prev]);
      setSelectedConv(data.conversation);
      setNewSubject(''); setNewMessage('');
      setChatSuccess('Message sent! Our team will reply shortly.');
      setTimeout(() => setChatSuccess(''), 4000);
    } catch { setChatError('Network error.'); }
    finally { setChatLoading(false); }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedConv || !replyText.trim()) return;
    setChatLoading(true); setChatError('');
    try {
      const res = await fetch('/api/users/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: selectedConv.id, message: replyText }),
      });
      const data = await res.json();
      if (!res.ok) { setChatError(data.error ?? 'Failed to send.'); return; }
      setSelectedConv(data.conversation);
      setConversations(prev => prev.map(c => c.id === data.conversation.id ? data.conversation : c));
      setReplyText('');
    } catch { setChatError('Network error.'); }
    finally { setChatLoading(false); }
  }

  const filtered = faqs.filter(f => {
    const matchSearch = f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || f.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <>
      <Helmet>
        <title>Customer Support — 24/7 Help & FAQ | City Gate Capital</title>
        <meta name="description" content="Get help with your City Gate Capital account. 24/7 live chat with under 2-minute response, email support, phone support, and a comprehensive FAQ covering accounts, transfers, crypto, and cards." />
        <link rel="canonical" href="https://citygate.capital/support" />
        <meta property="og:title" content="Customer Support — 24/7 Help & FAQ" />
        <meta property="og:description" content="24/7 live chat, email and phone support. Average response under 2 minutes. Comprehensive FAQ for all your banking questions." />
        <meta property="og:url" content="https://citygate.capital/support" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Customer Support — 24/7 Help & FAQ" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Customer Support — City Gate Capital" />
        <meta name="twitter:description" content="24/7 live chat, email and phone support. Average response under 2 minutes." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          '@id': 'https://citygate.capital/support#webpage',
          name: 'City Gate Capital Support FAQ',
          url: 'https://citygate.capital/support',
          isPartOf: { '@id': 'https://citygate.capital/#website' },
          about: { '@id': 'https://citygate.capital/#organization' },
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Support', item: 'https://citygate.capital/support' },
          ],
        }) }} />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="container mx-auto px-4 md:px-6 relative text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
              Support Centre
            </span>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
              How Can We <span className="text-gold-shimmer">Help?</span>
            </h1>
            <p className="text-xl text-foreground/50 mb-10 max-w-lg mx-auto">
              World-class support available 24/7. Find answers instantly or reach our team directly.
            </p>
            {/* Search */}
            <div className="relative max-w-xl mx-auto">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" />
              <input
                type="text"
                placeholder="Search for answers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full glass-card border border-primary/20 rounded-2xl pl-12 pr-4 py-4 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Support stats */}
      <section className="py-12 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {supportStats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-5 gradient-border text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: `${s.color}15` }}>
                  <s.icon size={18} style={{ color: s.color }} />
                </div>
                <p className="text-xl font-bold text-gold-gradient mb-0.5">{s.value}</p>
                <p className="text-xs text-foreground/55">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact channels */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Reach Us <span className="text-gold-gradient">Directly</span>
              </h2>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: MessageCircle,
                title: 'Live Chat',
                desc: 'Chat with our team in real time. Average response under 2 minutes. Available 24/7.',
                action: 'Start Chat',
                badge: '< 2 min',
                color: '#10B981',
              },
              {
                icon: Mail,
                title: 'Email Support',
                desc: 'Send us a detailed message at support@citygate.capital. We respond within 2 business hours with a full resolution.',
                action: 'Send Email',
                badge: '< 2 hrs',
                color: '#C9A84C',
              },
              {
                icon: Phone,
                title: 'Phone Support',
                desc: 'Speak directly with a specialist at +44 7888 382458. Available Mon–Fri 9am–6pm GMT. Priority for Premium & Elite.',
                action: 'Call Now',
                badge: 'Mon–Fri',
                color: '#627EEA',
              },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-7 gradient-border hover:border-primary/25 transition-colors group"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: `${c.color}15` }}>
                    <c.icon size={24} style={{ color: c.color }} />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${c.color}15`, color: c.color }}>{c.badge}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{c.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed mb-5">{c.desc}</p>
                <Link to="/contact" className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                  style={{ color: c.color }}>
                  {c.action} <ArrowRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl font-bold text-foreground mb-8 tracking-tight">Browse by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map((cat, i) => (
              <motion.button
                key={cat.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setActiveCategory(activeCategory === cat.label ? 'All' : cat.label)}
                className={`glass-card rounded-xl p-4 text-left transition-colors group ${activeCategory === cat.label ? 'border border-primary/40' : 'gradient-border hover:border-primary/30'}`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{ background: `${cat.color}15` }}>
                  <cat.icon size={14} style={{ color: cat.color }} />
                </div>
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors mb-1">{cat.label}</p>
                <p className="text-[10px] text-foreground/50">{cat.count} articles</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Frequently Asked <span className="text-gold-gradient">Questions</span>
            </h2>
            {activeCategory !== 'All' && (
              <button onClick={() => setActiveCategory('All')} className="text-xs text-foreground/40 hover:text-foreground transition-colors">
                Clear filter
              </button>
            )}
          </div>
          <div className="space-y-3 max-w-3xl">
            {filtered.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
              >
                <FaqItem q={faq.q} a={faq.a} category={faq.category} />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-foreground/55">
                <Search size={32} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">No results found for "{search}"</p>
                <button onClick={() => { setSearch(''); setActiveCategory('All'); }} className="mt-3 text-xs text-primary hover:underline">
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Response time badges */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Zap,     label: 'Live Chat',       time: '< 2 min',  desc: 'Average response time' },
              { icon: Clock,   label: 'Email',           time: '< 2 hrs',  desc: 'Business hours response' },
              { icon: Shield,  label: 'Security Issues', time: '< 15 min', desc: 'Priority escalation' },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-5 gradient-border flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-foreground/55 uppercase tracking-wide">{item.label}</p>
                  <p className="text-lg font-bold text-gold-gradient">{item.time}</p>
                  <p className="text-xs text-foreground/55">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight">
              Still Need <span className="text-gold-gradient">Help?</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-sm mx-auto">Our team is standing by 24/7. We'll get you sorted.</p>
            {customer ? (
              <button onClick={() => setChatOpen(true)}
                className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Open Support Chat</span>
                <MessageCircle size={18} className="relative transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <Link to="/contact" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">Contact Support</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Support Chat Modal */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
              className="fixed inset-x-4 bottom-4 top-16 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[420px] sm:h-[600px] z-50 flex flex-col bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0A0A0A]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#C9A84C]/15 flex items-center justify-center">
                    <MessageCircle size={15} className="text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Support Chat</p>
                    <p className="text-[10px] text-emerald-400">Online · Avg reply &lt; 2 min</p>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedConv ? (
                  <>
                    <button onClick={() => setSelectedConv(null)} className="text-xs text-[#C9A84C] hover:underline mb-2">← Back to conversations</button>
                    <p className="text-sm font-medium text-white mb-3">{selectedConv.subject}</p>
                    {selectedConv.messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                          msg.from === 'customer'
                            ? 'bg-[#C9A84C] text-black rounded-br-sm'
                            : 'bg-white/10 text-white rounded-bl-sm'
                        }`}>
                          {msg.from === 'admin' && <p className="text-[10px] text-white/50 mb-1">{msg.adminName ?? 'Support Team'}</p>}
                          <p>{msg.text}</p>
                          <p className={`text-[10px] mt-1 ${msg.from === 'customer' ? 'text-black/50' : 'text-white/30'}`}>
                            {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                ) : conversations.length > 0 ? (
                  <>
                    <p className="text-xs text-white/40 mb-2">Your conversations</p>
                    {conversations.map(c => (
                      <button key={c.id} onClick={() => setSelectedConv(c)}
                        className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#C9A84C]/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-white truncate">{c.subject}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            c.status === 'open' ? 'bg-emerald-500/15 text-emerald-400' :
                            c.status === 'in_progress' ? 'bg-blue-500/15 text-blue-400' :
                            'bg-white/10 text-white/30'
                          }`}>{c.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-xs text-white/40">{c.messages.length} message{c.messages.length !== 1 ? 's' : ''}</p>
                      </button>
                    ))}
                    <button onClick={() => setSelectedConv(null)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-white/40 text-sm hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors">
                      + New conversation
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <MessageCircle size={32} className="text-white/20 mx-auto mb-3" />
                    <p className="text-sm text-white/50">No conversations yet.</p>
                    <p className="text-xs text-white/30 mt-1">Send us a message below.</p>
                  </div>
                )}
              </div>

              {/* Input area */}
              <div className="border-t border-white/10 p-4 bg-[#0A0A0A]">
                {chatError && (
                  <div className="mb-3 flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={12} /> {chatError}
                  </div>
                )}
                {chatSuccess && (
                  <div className="mb-3 flex items-center gap-2 text-emerald-400 text-xs">
                    <CheckCircle size={12} /> {chatSuccess}
                  </div>
                )}
                {selectedConv ? (
                  <form onSubmit={sendReply} className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type a reply…"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                    />
                    <button type="submit" disabled={chatLoading || !replyText.trim()}
                      className="px-3 py-2.5 rounded-xl bg-[#C9A84C] text-black disabled:opacity-50 hover:bg-[#E8C97A] transition-colors">
                      {chatLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </form>
                ) : !customer ? (
                  <p className="text-xs text-white/40 text-center">
                    <Link to="/login" className="text-[#C9A84C] hover:underline">Log in</Link> to send a support message.
                  </p>
                ) : (
                  <form onSubmit={sendNewMessage} className="space-y-2">
                    <input
                      type="text"
                      value={newSubject}
                      onChange={e => setNewSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                    />
                    <div className="flex gap-2">
                      <textarea
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Describe your issue…"
                        rows={2}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-colors resize-none"
                      />
                      <button type="submit" disabled={chatLoading || !newSubject.trim() || !newMessage.trim()}
                        className="px-3 rounded-xl bg-[#C9A84C] text-black disabled:opacity-50 hover:bg-[#E8C97A] transition-colors self-end py-2">
                        {chatLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
