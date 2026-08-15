import { Helmet } from '@dr.pogodin/react-helmet';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Globe2,
  Landmark,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolveBusinessLocation } from '@/lib/businessLocation';

const storyLocation = resolveBusinessLocation(null);

const capabilities = [
  {
    icon: WalletCards,
    title: 'Digital account experience',
    text: 'A central environment for managing profiles, supported accounts, balances, transaction activity, statements, and financial information.',
  },
  {
    icon: BarChart3,
    title: 'Financial dashboard',
    text: 'A consolidated view of account activity, income and spending, supported currencies, notifications, and privacy controls.',
  },
  {
    icon: Globe2,
    title: 'Multi-currency vision',
    text: 'Platform architecture designed for increasingly international needs, with individual services activated only where the required infrastructure is in place.',
  },
  {
    icon: Landmark,
    title: 'Payments and transfers',
    text: 'Clear payment journeys designed to help customers understand, initiate, and monitor eligible transactions throughout their lifecycle.',
  },
  {
    icon: Sparkles,
    title: 'Markets and financial insight',
    text: 'Market information, analytics, and portfolio-oriented tools intended to help customers understand financial markets and their own financial position.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure account management',
    text: 'Authentication, verification controls, session monitoring, security notifications, access management, and attributable administrative actions.',
  },
];

const principles = [
  ['Trust', 'Design systems and operations around security, accountability, and responsible practices.'],
  ['Clarity', 'Present financial information through understandable experiences and straightforward communication.'],
  ['Innovation', 'Explore new capabilities while evaluating their practical value, security, and regulatory implications.'],
  ['Accessibility', 'Design financial technology around real people, real businesses, and real-world needs.'],
  ['Responsibility', 'Develop technology, risk management, compliance, and customer protection together.'],
  ['Connection', 'Make the links between people, businesses, markets, and technology simpler.'],
];

const Reveal = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.12 }}
    className={className}
  >
    {children}
  </motion.div>
);

export default function OurStoryPage() {
  const title = 'About City Gate Capital | Our Story';
  const description =
    'Discover the City Gate Capital vision for connected, secure, and responsible digital financial experiences for individuals and businesses.';

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://citygate.capital/about" />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content="https://citygate.capital/about" />
        <meta property="og:image" content="https://citygate.capital/assets/brand/city-gate-capital-seal.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'AboutPage',
              name: title,
              description,
              url: 'https://citygate.capital/about',
              mainEntity: {
                '@type': 'Organization',
                name: 'City Gate Capital',
                url: 'https://citygate.capital',
                logo: 'https://citygate.capital/assets/brand/city-gate-capital-seal.png',
              },
            }),
          }}
        />
      </Helmet>

      <main className="overflow-hidden">
        <section className="relative min-h-[760px] flex items-center overflow-hidden pt-32 pb-24 border-b border-primary/10">
          <video
            className="absolute inset-0 h-full w-full object-cover object-center motion-reduce:hidden"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src="/assets/media/city-gate-team-story.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/55" />
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(218,174,70,0.34),transparent_48%)]" />
          <div className="container mx-auto px-4 md:px-6 relative z-10 max-w-6xl">
            <Reveal className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary mb-6">The City Gate Capital story</p>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
                The future of financial services is <span className="text-gold-gradient">connected.</span>
              </h1>
              <p className="text-xl md:text-2xl text-foreground/65 leading-relaxed mt-8 max-w-3xl">
                Modern financial technology, thoughtfully designed around clarity, confidence, and the ambitions of people and businesses.
              </p>
              <p className="mt-8 text-lg font-semibold text-foreground">
                Your money. Your world. One gateway.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/accounts" className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-primary text-black font-semibold">
                  Explore banking <ArrowRight size={18} />
                </Link>
                <Link to="/contact" className="inline-flex items-center gap-2 px-7 py-4 rounded-xl border border-primary/25 font-semibold hover:border-primary/60 transition-colors">
                  Contact our team
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl grid lg:grid-cols-[0.8fr_1.2fr] gap-14 items-start">
            <Reveal>
              <p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Who we are</p>
              <h2 className="text-4xl md:text-5xl font-bold leading-tight">A modern approach to financial services.</h2>
            </Reveal>
            <Reveal className="space-y-6 text-foreground/65 leading-8 text-lg">
              <p>Financial expectations are changing. People increasingly expect immediate information, stronger digital security, intuitive technology, and services capable of working across traditional boundaries.</p>
              <p>City Gate Capital was created with that future in mind. We are developing a technology-driven financial platform for individuals and businesses, with security, responsible operations, and customer experience at its centre.</p>
              <p>Our long-term strategy is a connected ecosystem where customers can understand and manage more of their financial lives from one secure environment.</p>
              <p className="text-primary font-semibold">One relationship. One connected experience. More possibilities.</p>
            </Reveal>
          </div>
        </section>

        <section className="py-24 bg-[#060606] border-y border-primary/10">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <Reveal className="max-w-3xl mb-14">
              <p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Our purpose</p>
              <h2 className="text-4xl md:text-5xl font-bold mb-7">Helping financial ambition become progress.</h2>
              <p className="text-lg text-foreground/60 leading-8">Behind every financial decision is a purpose: creating security, supporting a family, developing an idea, growing a business, or reaching an opportunity somewhere else.</p>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                ['People and families', 'Tools designed to bring clarity to everyday finances and future planning.', Users],
                ['Entrepreneurs', 'Connected financial experiences that can develop alongside new ideas and growing ambitions.', Sparkles],
                ['Businesses', 'Technology designed to support increasingly complex and international financial operations.', Building2],
              ].map(([heading, text, Icon]) => {
                const CardIcon = Icon as typeof Users;
                return (
                  <Reveal key={heading as string} className="glass-card rounded-2xl p-7 border border-primary/10">
                    <CardIcon className="text-primary mb-6" />
                    <h3 className="font-semibold text-xl mb-3">{heading as string}</h3>
                    <p className="text-sm text-foreground/55 leading-7">{text as string}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <Reveal className="text-center max-w-3xl mx-auto mb-14">
              <p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">What we are building</p>
              <h2 className="text-4xl md:text-5xl font-bold mb-5">One connected financial experience.</h2>
              <p className="text-foreground/55 leading-7">Sophisticated infrastructure presented through a clear, intuitive, and premium customer experience.</p>
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {capabilities.map(({ icon: Icon, title: capabilityTitle, text }) => (
                <Reveal key={capabilityTitle} className="rounded-2xl border border-primary/15 bg-primary/[0.025] p-7">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6"><Icon className="text-primary" size={23} /></div>
                  <h3 className="font-semibold text-lg mb-3">{capabilityTitle}</h3>
                  <p className="text-sm text-foreground/55 leading-7">{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-[#060606] border-y border-primary/10">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl grid lg:grid-cols-2 gap-16">
            <Reveal>
              <ShieldCheck className="text-primary w-12 h-12 mb-7" />
              <p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Security at every level</p>
              <h2 className="text-4xl md:text-5xl font-bold mb-7">Protecting trust.</h2>
              <div className="space-y-5 text-foreground/60 leading-8">
                <p>Security is fundamental to every financial relationship. Our technology strategy emphasises multiple layers of protection across customer access, administration, and financial operations.</p>
                <p>Secure authentication, verification controls, session monitoring, access management, security notifications, and administrative audit trails form part of that foundation.</p>
                <p className="text-foreground font-semibold">Innovation only matters when people can trust the systems behind it.</p>
              </div>
            </Reveal>
            <Reveal>
              <Landmark className="text-primary w-12 h-12 mb-7" />
              <p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Responsible innovation</p>
              <h2 className="text-4xl md:text-5xl font-bold mb-7">Ambition with discipline.</h2>
              <div className="space-y-5 text-foreground/60 leading-8">
                <p>Banking, payments, investments, cards, and digital assets can each carry significant legal and operational responsibilities. Our approach is based on responsible, phased expansion.</p>
                <p>Services that require authorisation will be introduced only through the appropriate legal structure and, where applicable, appropriately licensed or regulated institutions.</p>
                <p className="text-foreground font-semibold">Sustainable financial innovation requires technological ambition and regulatory discipline.</p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <Reveal className="text-center max-w-3xl mx-auto mb-14">
              <p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Our principles</p>
              <h2 className="text-4xl md:text-5xl font-bold">The standards guiding our direction.</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {principles.map(([name, detail], index) => (
                <Reveal key={name} className="glass-card rounded-2xl p-6 border border-primary/10">
                  <div className="flex gap-4">
                    <span className="text-primary font-semibold">{String(index + 1).padStart(2, '0')}</span>
                    <div><h3 className="font-semibold mb-2">{name}</h3><p className="text-sm text-foreground/55 leading-6">{detail}</p></div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl text-center">
            <Reveal>
              <p className="text-primary text-xs uppercase tracking-[0.25em] mb-4">Our home</p>
              <h2 className="text-4xl md:text-5xl font-bold mb-5">City Gate Capital</h2>
              <p className="text-xl text-foreground/60 mb-3">Modern financial technology. Connected experiences. Built around your future.</p>
              <address className="mt-6 text-sm leading-7 text-foreground/55 not-italic">51 Mosley Street<br />Manchester M2 3HQ<br />United Kingdom</address>
              <div className="mt-8 overflow-hidden rounded-2xl border border-primary/20 bg-black/30 shadow-2xl">
                <iframe src={storyLocation.mapEmbedUrl} title="Google Map showing City Gate Capital at 51 Mosley Street, Manchester" className="h-72 md:h-96 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
              </div>
              <a href={storyLocation.directionsUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"><MapPin size={17} /> Open in Google Maps</a>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
