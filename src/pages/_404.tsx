import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Home, ArrowLeft, Search } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';

const quickLinks = [
  { label: 'Digital Banking', href: '/digital-banking' },
  { label: 'Crypto Wallet',   href: '/wallet'          },
  { label: 'Account Experiences', href: '/accounts'           },
  { label: 'Transfers',       href: '/transfers'       },
  { label: 'Support',         href: '/support'         },
  { label: 'Contact',         href: '/contact'         },
];

export default function NotFoundPage() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-[72px]">
      <Helmet>
        <title>Page Not Found — City Gate Capital</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] opacity-[0.04] blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #C9A84C, transparent)' }} />

      <div className="container mx-auto px-4 md:px-6 relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* 404 number */}
          <div className="relative inline-block mb-6">
            <p
              className="text-[160px] md:text-[220px] font-bold leading-none select-none"
              style={{
                background: 'linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: 'var(--font-heading)',
              }}
            >
              404
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Search size={28} className="text-primary" />
              </div>
            </div>
          </div>

          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 border border-primary/20 mb-5 tracking-widest uppercase">
            Page Not Found
          </span>

          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            This Page Doesn't <span className="text-gold-gradient">Exist</span>
          </h1>
          <p className="text-foreground/50 mb-10 max-w-md mx-auto leading-relaxed">
            The page you're looking for may have been moved, renamed, or never existed. Let's get you back on track.
          </p>

          {/* Primary actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-14">
            <Link to="/" className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-black overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080]" />
              <Home size={16} className="relative" />
              <span className="relative">Go Home</span>
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-medium text-foreground/70 glass border border-primary/20 hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
          </div>

          {/* Quick links */}
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-foreground/30 uppercase tracking-widest mb-5">Or explore these pages</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {quickLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                >
                  <Link
                    to={link.href}
                    className="flex items-center justify-between px-4 py-3 rounded-xl glass-card border border-primary/10 hover:border-primary/25 text-sm text-foreground/50 hover:text-primary transition-colors group"
                  >
                    <span>{link.label}</span>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
