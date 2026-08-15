/** Product-suite section for the public homepage. */
import { motion } from 'motion/react';
import {
  ArrowRight, BarChart3, Bitcoin, BriefcaseBusiness, Building2, FileText,
  Globe2, PiggyBank, Users, Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ProductSlug } from '@/lib/productCatalogue';

interface ProductCardItem {
  icon: typeof Wallet;
  slug: ProductSlug;
  label: string;
  desc: string;
  color: string;
  status: string;
}

const accountProducts: ProductCardItem[] = [
  {
    icon: Wallet,
    slug: 'personal-account',
    label: 'Personal Account',
    desc: 'Everyday account experience with balances, statements, beneficiary management, and security controls.',
    color: '#C9A84C',
    status: 'Core experience',
  },
  {
    icon: PiggyBank,
    slug: 'savings-account',
    label: 'Savings Account',
    desc: 'Goal-led savings organisation, scheduled contributions, statements, and configurable account restrictions.',
    color: '#10B981',
    status: 'Core experience',
  },
  {
    icon: Building2,
    slug: 'business-account',
    label: 'Business Account',
    desc: 'Business profiles, authorised users, approval workflows, expense visibility, and operational reporting.',
    color: '#627EEA',
    status: 'Business services',
  },
  {
    icon: Globe2,
    slug: 'multi-currency-wallet',
    label: 'Multi-Currency Service Wallet',
    desc: 'A unified view for configured GBP, EUR, USD, CAD, AUD, and CHF balances and conversion instructions.',
    color: '#00B4D8',
    status: 'Multi-currency',
  },
];

const wealthServices: ProductCardItem[] = [
  {
    icon: Bitcoin,
    slug: 'digital-asset-wallet',
    label: 'Digital-Asset Wallet',
    desc: 'Portfolio and transaction views for configured assets, with custody and withdrawals dependent on an approved custodian.',
    color: '#F7931A',
    status: 'Digital assets',
  },
  {
    icon: BarChart3,
    slug: 'markets-investments',
    label: 'Markets & Investments',
    desc: 'Market data, watchlists, holdings, orders, and performance reporting with market data separated from execution.',
    color: '#9945FF',
    status: 'Market access',
  },
  {
    icon: Users,
    slug: 'retirement-beneficiaries',
    label: 'Retirement & Beneficiaries',
    desc: 'Beneficiary designations and retirement-account servicing designed for jurisdiction-specific pension or 401(k) providers.',
    color: '#EC4899',
    status: 'Jurisdictional',
  },
  {
    icon: FileText,
    slug: 'tax-document-centre',
    label: 'Tax Document Centre',
    desc: 'Secure delivery of provider-issued statements and applicable tax documents; City Gate Capital does not provide tax advice.',
    color: '#F0D080',
    status: 'Provider-issued',
  },
];

function ProductCard({ product, index }: { product: ProductCardItem; index: number }) {
  return (
    <Link to={`/register?product=${product.slug}`} aria-label={`Register for ${product.label}`} className="block h-full">
      <motion.article initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06, duration: 0.45 }} whileHover={{ y: -3 }} className="group glass-card rounded-2xl p-5 gradient-border relative overflow-hidden h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style={{ background: `${product.color}16` }}>
          <product.icon size={20} style={{ color: product.color }} />
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border border-white/10 text-foreground/45">{product.status}</span>
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{product.label}</h3>
      <p className="text-xs text-foreground/45 leading-relaxed">{product.desc}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">Register interest <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5"/></span>
      </motion.article>
    </Link>
  );
}

export function InvestmentsSection() {
  return (
    <section className="py-16 md:py-28 bg-[#060606] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full opacity-[0.04] blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, #C9A84C 0%, transparent 70%)' }} />
      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="text-center mb-12 md:mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-4 md:mb-5 uppercase tracking-widest">Accounts, Wallets & Wealth</span>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 md:mb-5 tracking-tight">A complete financial view,<br /><span className="text-gold-gradient">structured around you</span></h2>
            <p className="text-sm md:text-base text-foreground/50 max-w-2xl mx-auto leading-relaxed">One secure experience for personal and business accounts, currencies, digital assets, investments, beneficiaries, and provider-issued financial records.</p>
          </motion.div>
        </div>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5"><Wallet size={17} className="text-primary"/><h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Banking and wallet services</h3></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{accountProducts.map((product, i) => <ProductCard key={product.label} product={product} index={i} />)}</div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-5"><BriefcaseBusiness size={17} className="text-primary"/><h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Investment and planning services</h3></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{wealthServices.map((product, i) => <ProductCard key={product.label} product={product} index={i + accountProducts.length} />)}</div>
        </div>

      </div>
    </section>
  );
}
