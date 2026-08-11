import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { prefetchRoute } from '@/lib/prefetchRoute';
import CgcLogo from '@/components/CgcLogo';

const navLinks = [
  { label: 'Digital Banking', href: '/digital-banking' },
  { label: 'Accounts',        href: '/accounts'          },
  { label: 'About',           href: '/about'            },
  { label: 'Our Story',       href: '/our-story'        },
  { label: 'Contact',         href: '/contact'          },
  { label: 'Support',         href: '/support'          },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[rgba(10,10,10,0.85)] backdrop-blur-2xl border-b border-primary/10 shadow-[0_4px_32px_rgba(0,0,0,0.4)]'
            : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-[72px]">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <CgcLogo size={48} variant="horizontal" glow />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {navLinks.filter(l => l.href !== '/contact').map((link) => {
                const active = location.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onMouseEnter={() => prefetchRoute(link.href)}
                    className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                      active
                        ? 'text-primary'
                        : 'text-foreground/60 hover:text-foreground'
                    }`}
                  >
                    {link.label}
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* CTA group */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm text-foreground/65 hover:text-foreground transition-colors px-3 py-2"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="relative group px-5 py-2.5 rounded-xl text-sm font-bold overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#F0D080] transition-opacity duration-300" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
                />
                <span className="relative text-black font-bold">Open Account</span>
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg glass text-foreground"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Thin gold line at bottom when scrolled */}
        {scrolled && (
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        )}
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-[72px] left-0 right-0 z-40 bg-[rgba(10,10,10,0.97)] backdrop-blur-2xl border-b border-primary/10 md:hidden overflow-y-auto max-h-[calc(100vh-72px)]"
          >
            <div className="container mx-auto px-4 py-5 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onMouseEnter={() => prefetchRoute(link.href)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === link.href
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-foreground/60 hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 mt-1 border-t border-primary/10 flex flex-col gap-2">
                <Link
                  to="/register"
                  className="px-4 py-3.5 rounded-xl text-sm font-bold text-black text-center"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #F0D080)' }}
                >
                  Open Account
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
