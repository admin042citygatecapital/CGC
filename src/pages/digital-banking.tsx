import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  CreditCard, Zap, Bell, RefreshCw, Shield, ArrowRight, CheckCircle,
  PieChart, BarChart2, Smartphone, Lock, Globe, TrendingUp, Star, Sparkles,
  Loader2, Plus, AlertCircle,
} from 'lucide-react';
import PremiumCard from '@/components/PremiumCard';
import { useCustomerAuth } from '@/lib/customerAuth';

interface VirtualCard {
  id:             string;
  cardholderName: string;
  numberMasked:   string;
  // numberFull and cvv intentionally absent — never returned by the API (PCI-DSS)
  expiry:         string;
  network:        string;
  status:         string;
  createdAt:      string;
}

/** CMS-editable fields for this page (admin: /admin/cms → Digital Banking tab) */
interface DbCms {
  // Hero
  dbHeroTitle:        string;
  dbHeroSubtitle:     string;
  dbHeroCTA:          string;
  dbHeroSecondaryCTA: string;
  // Bottom CTA
  dbCtaTitle:         string;
  dbCtaSubtitle:      string;
  dbCtaPrimary:       string;
  dbCtaSecondary:     string;
  // Feature cards (9 cards)
  dbFeature1Title: string; dbFeature1Desc: string;
  dbFeature2Title: string; dbFeature2Desc: string;
  dbFeature3Title: string; dbFeature3Desc: string;
  dbFeature4Title: string; dbFeature4Desc: string;
  dbFeature5Title: string; dbFeature5Desc: string;
  dbFeature6Title: string; dbFeature6Desc: string;
  dbFeature7Title: string; dbFeature7Desc: string;
  dbFeature8Title: string; dbFeature8Desc: string;
  dbFeature9Title: string; dbFeature9Desc: string;
  // Stats strip (4 stats)
  dbStat1Value: string; dbStat1Label: string;
  dbStat2Value: string; dbStat2Label: string;
  dbStat3Value: string; dbStat3Label: string;
  dbStat4Value: string; dbStat4Label: string;
}

const DB_CMS_DEFAULTS: DbCms = {
  dbHeroTitle:        'Digital Finance, Designed Around You',
  dbHeroSubtitle:     'Explore card controls, analytics, payment journeys and automated insights in one premium platform experience.',
  dbHeroCTA:          'Create Platform Profile',
  dbHeroSecondaryCTA: 'Talk to Our Team',
  dbCtaTitle:         'Explore the Platform',
  dbCtaSubtitle:      'Create a platform profile to explore the experience. Card issuance and payment execution require approved providers.',
  dbCtaPrimary:       'Create Platform Profile',
  dbCtaSecondary:     'Talk to Our Team',
  // Feature card defaults (match hardcoded cardFeatures order)
  dbFeature1Title: 'Virtual Cards',     dbFeature1Desc: 'Review virtual-card controls and configurable sample spend limits.',
  dbFeature2Title: 'Freeze & Unfreeze', dbFeature2Desc: 'Explore proposed card-status controls. No payment instrument is issued or connected to a card network.',
  dbFeature3Title: 'Instant Alerts',    dbFeature3Desc: 'Review notification behaviour for sample transaction activity.',
  dbFeature4Title: 'Funding Controls',  dbFeature4Desc: 'Explore proposed funding rules without linking a bank or moving funds.',
  dbFeature5Title: 'Spend Analytics',   dbFeature5Desc: 'Explore illustrative purchase categorisation and charts.',
  dbFeature6Title: 'Contactless Pay',   dbFeature6Desc: 'Proposed wallet integrations shown for design purposes; no cards are issued.',
  dbFeature7Title: 'Foreign Exchange',         dbFeature7Desc: 'Explore currency-conversion screens with indicative rates and fees.',
  dbFeature8Title: 'Payment Security Design', dbFeature8Desc: 'Provider authentication and fraud controls must be validated before launch.',
  dbFeature9Title: 'Smart Insights',      dbFeature9Desc: 'Explore proposed insights generated from sample activity.',
  // Stats defaults
  dbStat1Value: '1',      dbStat1Label: 'Unified Platform',
  dbStat2Value: '$0',     dbStat2Label: 'Live Funds Processed',
  dbStat3Value: '50+',    dbStat3Label: 'Prototype Currencies',
  dbStat4Value: '2FA',    dbStat4Label: 'Account Protection',
};

const CARD_FEATURE_ICONS = [CreditCard, Shield, Bell, RefreshCw, PieChart, Zap, Globe, Lock, Sparkles];
const CARD_FEATURE_COLORS = ['#C9A84C', '#10B981', '#627EEA', '#9945FF', '#EC4899', '#F7931A', '#14B8A6', '#F0D080', '#A78BFA'];

function buildCardFeatures(cms: DbCms) {
  return [
    { icon: CARD_FEATURE_ICONS[0], color: CARD_FEATURE_COLORS[0], title: cms.dbFeature1Title, desc: cms.dbFeature1Desc },
    { icon: CARD_FEATURE_ICONS[1], color: CARD_FEATURE_COLORS[1], title: cms.dbFeature2Title, desc: cms.dbFeature2Desc },
    { icon: CARD_FEATURE_ICONS[2], color: CARD_FEATURE_COLORS[2], title: cms.dbFeature3Title, desc: cms.dbFeature3Desc },
    { icon: CARD_FEATURE_ICONS[3], color: CARD_FEATURE_COLORS[3], title: cms.dbFeature4Title, desc: cms.dbFeature4Desc },
    { icon: CARD_FEATURE_ICONS[4], color: CARD_FEATURE_COLORS[4], title: cms.dbFeature5Title, desc: cms.dbFeature5Desc },
    { icon: CARD_FEATURE_ICONS[5], color: CARD_FEATURE_COLORS[5], title: cms.dbFeature6Title, desc: cms.dbFeature6Desc },
    { icon: CARD_FEATURE_ICONS[6], color: CARD_FEATURE_COLORS[6], title: cms.dbFeature7Title, desc: cms.dbFeature7Desc },
    { icon: CARD_FEATURE_ICONS[7], color: CARD_FEATURE_COLORS[7], title: cms.dbFeature8Title, desc: cms.dbFeature8Desc },
    { icon: CARD_FEATURE_ICONS[8], color: CARD_FEATURE_COLORS[8], title: cms.dbFeature9Title, desc: cms.dbFeature9Desc },
  ];
}

const analyticsData = [
  { month: 'Jan', spend: 2100, income: 5200 },
  { month: 'Feb', spend: 1800, income: 5200 },
  { month: 'Mar', spend: 2400, income: 5500 },
  { month: 'Apr', spend: 1950, income: 5200 },
  { month: 'May', spend: 2800, income: 6100 },
  { month: 'Jun', spend: 2200, income: 5200 },
];

const spendCategories = [
  { label: 'Dining',      pct: 32, color: '#C9A84C', amount: '$892' },
  { label: 'Travel',      pct: 24, color: '#627EEA', amount: '$672' },
  { label: 'Shopping',    pct: 20, color: '#10B981', amount: '$560' },
  { label: 'Utilities',   pct: 14, color: '#9945FF', amount: '$392' },
  { label: 'Other',       pct: 10, color: '#EC4899', amount: '$280' },
];

const plans = [
  {
    name: 'Standard',
    price: 'Platform access',
    period: '',
    tagline: 'Illustrative product concept',
    features: [
      { text: '1 virtual card',            included: true },
      { text: 'Basic spend analytics',     included: true },
      { text: 'Standard transfers',        included: true },
      { text: 'Mobile app access',         included: true },
      { text: 'Metal physical card',       included: false },
      { text: 'Priority support',          included: false },
      { text: 'Cashback rewards',          included: false },
    ],
  },
  {
    name: 'Premium',
    price: 'Platform access',
    period: '',
    tagline: 'Illustrative product concept',
    highlight: true,
    features: [
      { text: '5 virtual cards',           included: true },
      { text: 'Advanced analytics',        included: true },
      { text: 'Priority transfers',        included: true },
      { text: 'Mobile app access',         included: true },
      { text: '1 metal physical card',     included: true },
      { text: 'Priority support',          included: true },
      { text: '1% cashback on all spend',  included: true },
    ],
  },
  {
    name: 'Elite',
    price: 'Platform access',
    period: '',
    tagline: 'Illustrative product concept',
    features: [
      { text: 'Unlimited virtual cards',   included: true },
      { text: 'AI financial advisor',      included: true },
      { text: 'Instant transfers',         included: true },
      { text: 'Mobile app access',         included: true },
      { text: 'Concierge metal card',      included: true },
      { text: 'Dedicated account manager', included: true },
      { text: '2% cashback on all spend',  included: true },
    ],
  },
];

const testimonials = [
  { name: 'Illustrative scenario', role: 'Subscription controls', text: 'A future user could organise sample cards by subscription and review proposed card controls in one place.', rating: 5 },
  { name: 'Illustrative scenario', role: 'Travel planning', text: 'A future user could compare clearly disclosed foreign-exchange options once licensed providers and commercial terms are approved.', rating: 5 },
  { name: 'Illustrative scenario', role: 'Spending insights', text: 'A future user could use categorisation and charts to understand activity supplied by a contracted account provider.', rating: 5 },
];

export default function DigitalBankingPage() {
  const { customer, token } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState<'spend' | 'income'>('spend');

  // CMS content — fetched once, falls back to hardcoded defaults
  const [cms, setCms] = useState<DbCms>(DB_CMS_DEFAULTS);
  const cmsFetched = useRef(false);
  useEffect(() => {
    if (cmsFetched.current) return;
    cmsFetched.current = true;
    fetch('/api/cms/content')
      .then(r => r.ok ? r.json() : null)
      .then((d: { data?: Record<string, unknown> } | null) => {
        if (d?.data && typeof d.data === 'object') {
          const patch = Object.fromEntries(
            Object.entries(d.data).filter(([k]) => k in DB_CMS_DEFAULTS)
          ) as Partial<DbCms>;
          if (Object.keys(patch).length) setCms(prev => ({ ...prev, ...patch }));
        }
      })
      .catch(() => {});
  }, []);

  // Virtual cards state
  const [cards, setCards]           = useState<VirtualCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError]   = useState('');
  const [generating, setGenerating]   = useState(false);
  const [freezingId, setFreezingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setCardsLoading(true);
    fetch('/api/users/cards', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.cards) setCards(d.cards); })
      .catch(() => {})
      .finally(() => setCardsLoading(false));
  }, [token]);

  async function generateCard() {
    if (!token) return;
    setGenerating(true);
    setCardsError('');
    try {
      const res = await fetch('/api/users/cards/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setCardsError(data.error ?? 'Failed to generate card.'); return; }
      setCards(prev => [data.card, ...prev]);
    } catch { setCardsError('Network error.'); }
    finally { setGenerating(false); }
  }

  async function freezeCard(cardId: string) {
    if (!token) return;
    setFreezingId(cardId);
    try {
      const res = await fetch('/api/users/cards/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (res.ok) setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: data.status } : c));
    } catch {
      // The card keeps its current state; the user can retry the action.
    }
    finally { setFreezingId(null); }
  }

  async function deleteCard(cardId: string) {
    if (!token || !confirm('Delete this virtual card? This cannot be undone.')) return;
    setDeletingId(cardId);
    try {
      const res = await fetch('/api/users/cards/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardId }),
      });
      if (res.ok) setCards(prev => prev.filter(c => c.id !== cardId));
    } catch {
      // The card remains visible; the user can retry the deletion.
    }
    finally { setDeletingId(null); }
  }

  return (
    <>
      <Helmet>
        <title>Digital Banking Platform | City Gate Capital</title>
        <meta name="description" content="Explore City Gate Capital's digital account, payment, savings, analytics, and security platform. Product availability remains subject to onboarding and provider approval." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://citygate.capital/digital-banking" />
        <meta property="og:title" content="Digital Banking Platform | City Gate Capital" />
        <meta property="og:description" content="Explore City Gate Capital's digital account, payment, savings, analytics, and security platform." />
        <meta property="og:url" content="https://citygate.capital/digital-banking" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="City Gate Capital digital banking platform" />
        <meta property="og:site_name" content="City Gate Capital" />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CityGateCapital" />
        <meta name="twitter:creator" content="@CityGateCapital" />
        <meta name="twitter:title" content="Digital Banking — City Gate Capital" />
        <meta name="twitter:description" content="Explore City Gate Capital card controls, analytics and payment workflows. Provider activation is required for live financial services." />
        <meta name="twitter:image" content="https://citygate.capital/assets/media/pages-home-hero-e6ece0b6.jpg" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': 'https://citygate.capital/digital-banking#webpage',
          name: 'Digital Banking — City Gate Capital',
          url: 'https://citygate.capital/digital-banking',
          description: 'A published platform experience for card controls, analytics and proposed payment workflows.',
          isPartOf: { '@id': 'https://citygate.capital/#website' },
          about: { '@id': 'https://citygate.capital/#organization' },
          mainEntity: {
            '@type': 'WebApplication',
            name: 'City Gate Capital Digital Finance',
            description: 'A digital-finance interface; card issuance and money movement require approved providers.',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
          },
        }) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://citygate.capital/' },
            { '@type': 'ListItem', position: 2, name: 'Digital Banking', item: 'https://citygate.capital/digital-banking' },
          ],
        }) }} />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-40 pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full opacity-5 blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #C9A84C, transparent)' }} />
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-6 tracking-widest uppercase">
                Digital Banking
              </span>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight tracking-tight">
                {cms.dbHeroTitle.split(' ').slice(0, -2).join(' ')}<br />
                <span className="text-gold-shimmer">{cms.dbHeroTitle.split(' ').slice(-2).join(' ')}</span>
              </h1>
              <p className="text-xl text-foreground/50 mb-8 leading-relaxed">
                {cms.dbHeroSubtitle}
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                {['Indicative FX', 'Card controls', 'Spending analytics', 'Card design', 'Rewards concept'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/20">{tag}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                  <span className="relative">{cms.dbHeroCTA}</span>
                  <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/contact" className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                  {cms.dbHeroSecondaryCTA}
                </Link>
              </div>
            </motion.div>

            {/* Card visual — Premium 3D Red Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="flex justify-center py-10"
            >
              <PremiumCard variant="hero" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Virtual Cards Section — shown when logged in */}
      {customer && (
        <section className="py-16 bg-[#0A0A0A]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">My Virtual Cards</h2>
                <p className="text-white/50 text-sm mt-1">Create and manage sample card records. Card issuance requires an approved provider.</p>
              </div>
              <button
                onClick={generateCard}
                disabled={generating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#E8C97A] transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {generating ? 'Creating…' : 'New Sample Card'}
              </button>
            </div>

            {cardsError && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={14} /> {cardsError}
              </div>
            )}

            {cardsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-[#C9A84C]" />
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-16 bg-white/3 border border-white/8 rounded-2xl">
                <CreditCard size={40} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/50 text-sm mb-4">No virtual cards yet.</p>
                <button onClick={generateCard} disabled={generating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#E8C97A] transition-colors">
                  <Plus size={15} /> Create Your First Sample Card
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {cards.map(card => (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      layout
                    >
                      <PremiumCard
                        variant="grid"
                        numberMasked={card.numberMasked}
                        cardholderName={card.cardholderName}
                        expiry={card.expiry}
                        status={card.status}
                        onFreeze={() => freezeCard(card.id)}
                        onDelete={() => deleteCard(card.id)}
                        freezing={freezingId === card.id}
                        deleting={deletingId === card.id}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Analytics experience */}
      <section className="py-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Chart */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="glass-card rounded-3xl p-7 gradient-border" style={{ boxShadow: 'var(--gold-glow)' }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Spending Overview</p>
                    <p className="text-xs text-foreground/40">Last 6 months</p>
                  </div>
                  <div className="flex gap-1 p-1 glass rounded-xl">
                    {(['spend', 'income'] as const).map(t => (
                      <button key={t} onClick={() => setActiveTab(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${activeTab === t ? 'bg-primary text-black' : 'text-foreground/40 hover:text-foreground'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Bar chart — 112px chart area + 16px label row = 128px total */}
                <div className="flex gap-2 mb-4" style={{ height: '128px' }}>
                  {(() => {
                    const CHART_H = 112; // px reserved for bars
                    const maxForTab = Math.max(...analyticsData.map(x => activeTab === 'spend' ? x.spend : x.income));
                    return analyticsData.map((d, i) => {
                      const val = activeTab === 'spend' ? d.spend : d.income;
                      const barH = maxForTab > 0 ? Math.round((val / maxForTab) * CHART_H) : 0;
                      return (
                        <div key={d.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                          {/* Bar column — fixed chart height, bar grows from bottom */}
                          <div className="w-full flex items-end" style={{ height: `${CHART_H}px` }}>
                            <motion.div
                              key={`${activeTab}-${d.month}`}
                              initial={{ height: 0 }}
                              animate={{ height: barH }}
                              transition={{ delay: i * 0.07, duration: 0.5, ease: 'easeOut' }}
                              className="w-full rounded-t-lg"
                              style={{
                                background: activeTab === 'spend'
                                  ? 'linear-gradient(to top, #C9A84C, #F0D080)'
                                  : 'linear-gradient(to top, #10B981, #34D399)',
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-foreground/30 leading-none">{d.month}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                {/* Spend categories */}
                <div className="space-y-2 pt-4 border-t border-primary/10">
                  {spendCategories.map(c => (
                    <div key={c.label} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground/50">{c.label}</span>
                          <span className="text-foreground/70">{c.amount}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${c.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ background: c.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                AI Analytics
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight">
                Know Your Money<br />
                <span className="text-gold-gradient">Inside Out</span>
              </h2>
              <p className="text-foreground/50 leading-relaxed mb-8">
                Our AI engine analyses every transaction and surfaces insights you'd never find on your own — helping you spend smarter and save more.
              </p>
              <div className="space-y-4">
                {[
                  { icon: BarChart2,  title: 'Monthly Trends',       desc: 'Track income vs. spending across 12 months with interactive charts.' },
                  { icon: PieChart,   title: 'Category Breakdown',   desc: 'See exactly how much you spend on dining, travel, shopping, and more.' },
                  { icon: TrendingUp, title: 'Savings Projections',  desc: 'AI predicts how much you could save with personalised recommendations.' },
                  { icon: Smartphone, title: 'Mobile Notifications', desc: 'Weekly summaries and real-time alerts keep you on top of your finances.' },
                ].map((item, i) => (
                  <motion.div key={item.title} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-4 p-4 glass rounded-xl border border-primary/10 hover:border-primary/20 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                      <p className="text-xs text-foreground/45 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Features
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Everything You Need to<br />
                <span className="text-gold-gradient">Bank Smarter</span>
              </h2>
              <p className="text-foreground/50 max-w-md mx-auto">Built for people who demand the best from their banking experience.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {buildCardFeatures(cms).map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="glass-card rounded-2xl p-7 gradient-border hover:border-primary/25 transition-all hover:-translate-y-1 group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: `${f.color}15` }}>
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-foreground/50 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {([
              { value: cms.dbStat1Value, label: cms.dbStat1Label },
              { value: cms.dbStat2Value, label: cms.dbStat2Label },
              { value: cms.dbStat3Value, label: cms.dbStat3Label },
              { value: cms.dbStat4Value, label: cms.dbStat4Label },
            ] as const).map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-gold-gradient mb-1">{s.value}</p>
                <p className="text-xs text-foreground/55 uppercase tracking-widest">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials strip */}
      <section className="py-16 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 gradient-border">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={12} className="text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-sm text-foreground/60 leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-foreground/35">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-28">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
                Proposed Plans
              </span>
              <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                Explore <span className="text-gold-gradient">Plan Concepts</span>
              </h2>
              <p className="text-foreground/50 max-w-lg mx-auto">These concepts are not offers and cannot be purchased. Features, prices, eligibility, and providers require approval before launch.</p>
            </motion.div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-3xl p-7 ${plan.highlight
                  ? 'bg-gradient-to-b from-primary/15 to-primary/5 border border-primary/40'
                  : 'glass-card gradient-border'}`}
                style={plan.highlight ? { boxShadow: 'var(--gold-glow)' } : {}}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-black"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}>
                    Featured Concept
                  </div>
                )}
                <p className="text-xs text-foreground/40 uppercase tracking-widest mb-1">{plan.name}</p>
                <p className="text-xs text-foreground/30 mb-3">{plan.tagline}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-sm text-foreground/40 mb-1">{plan.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f.text} className={`flex items-center gap-2.5 text-sm ${f.included ? 'text-foreground/60' : 'text-foreground/25 line-through'}`}>
                      <CheckCircle size={13} className={f.included ? 'text-primary shrink-0' : 'text-foreground/20 shrink-0'} />
                      {f.text}
                    </li>
                  ))}
                </ul>
                <Link to="/accounts" className={`block text-center py-3 rounded-xl text-sm font-bold transition-all ${plan.highlight
                  ? 'bg-gradient-to-r from-primary to-[#F0D080] text-black'
                  : 'glass border border-primary/20 text-foreground hover:border-primary/40'}`}>
                  Explore the Platform
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#060606]">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass-card rounded-3xl p-12 md:p-16 gradient-border text-center overflow-hidden"
            style={{ boxShadow: 'var(--gold-glow)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <h2 className="text-4xl font-bold text-foreground mb-5 tracking-tight relative">
              {cms.dbCtaTitle.split(' ').slice(0, -2).join(' ')} <span className="text-gold-gradient">{cms.dbCtaTitle.split(' ').slice(-2).join(' ')}</span>
            </h2>
            <p className="text-foreground/50 mb-8 max-w-md mx-auto relative">{cms.dbCtaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-4 relative">
              <Link to="/accounts" className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-black overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
                <span className="relative">{cms.dbCtaPrimary}</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors">
                {cms.dbCtaSecondary}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
