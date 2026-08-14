import { AnimatePresence, motion } from 'motion/react';
import { BarChart3, CreditCard, FileText, Gift, HelpCircle, Home, Landmark, Menu, MessageCircle, ReceiptText, Search, Send, Settings, Shield, Target, TrendingUp, User, Users, WalletCards, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const primary = [
  { label: 'Home', href: '/dashboard', icon: Home, exact: true },
  { label: 'Accounts', href: '/dashboard/accounts', icon: Landmark },
  { label: 'Transfer', href: '/dashboard/transfers', icon: Send },
  { label: 'Cards', href: '/dashboard/cards', icon: CreditCard },
];
const more = [
  { label: 'Search', href: '/dashboard/search', icon: Search },
  { label: 'Wallets', href: '/dashboard/wallets', icon: WalletCards },
  { label: 'Investments', href: '/dashboard/trading', icon: TrendingUp },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Goals', href: '/dashboard/goals', icon: Target },
  { label: 'Bills & Payments', href: '/dashboard/bills', icon: ReceiptText },
  { label: 'Beneficiaries', href: '/dashboard/beneficiaries', icon: Users },
  { label: 'Statements', href: '/dashboard/statements', icon: FileText },
  { label: 'Rewards', href: '/dashboard/rewards', icon: Gift },
  { label: 'Security Center', href: '/dashboard/security', icon: Shield },
  { label: 'Support', href: '/dashboard/support', icon: MessageCircle },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function CustomerMobileNav() {
  const location = useLocation(); const [open, setOpen] = useState(false);
  if (!location.pathname.startsWith('/dashboard')) return null;
  const isMoreActive = more.some(item => location.pathname.startsWith(item.href));
  return <>
    <nav aria-label="Customer navigation" className="fixed inset-x-0 bottom-0 z-[80] border-t border-white/8 bg-[rgba(6,6,6,.94)] pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
      <div className="grid h-16 grid-cols-5">{primary.map(item => <NavLink key={item.href} to={item.href} end={item.exact} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-foreground/35'}`}><item.icon size={18} /><span>{item.label}</span></NavLink>)}<button aria-expanded={open} aria-controls="customer-more-menu" onClick={() => setOpen(true)} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${isMoreActive ? 'text-primary' : 'text-foreground/35'}`}><Menu size={18} /><span>More</span></button></div>
    </nav>
    <AnimatePresence>{open && <><motion.button aria-label="Close navigation menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-[88] bg-black/70 backdrop-blur-sm md:hidden" /><motion.aside id="customer-more-menu" role="dialog" aria-modal="true" aria-label="More customer services" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 280 }} className="fixed inset-x-0 bottom-0 z-[90] max-h-[78vh] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0a0a09] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:hidden"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-bold">More services</p><p className="mt-1 text-[10px] text-foreground/30">Your complete financial workspace</p></div><button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-white/5" aria-label="Close"><X size={15} /></button></div><div className="grid grid-cols-2 gap-2">{more.map(item => <NavLink key={item.href} to={item.href} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-2xl border p-3 text-xs font-semibold ${isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/7 bg-white/[.025] text-foreground/60'}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"><item.icon size={15} /></span>{item.label}</NavLink>)}</div><div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[.015] p-3"><HelpCircle size={13} className="mt-0.5 text-primary" /><p className="text-[10px] leading-5 text-foreground/30">Need assistance? Open Support to create a case or contact the City Gate Capital team.</p></div></motion.aside></>}</AnimatePresence>
  </>;
}
