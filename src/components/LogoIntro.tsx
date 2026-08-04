import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function LogoIntro() {
  // Always start as false so SSR and initial client render match (avoids
  // React hydration mismatch #418). useEffect runs only on the client after
  // hydration and enables the intro if it hasn't been shown yet.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('cgc_intro_shown')) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('cgc_intro_shown', '1');
    }, 2400);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="logo-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: '#000000' }}
        >
          {/* Radial gold glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.25, scale: 1.8 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 65%)' }}
          />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="relative flex flex-col items-center gap-5"
          >
            <motion.img
              src="/assets/IMG-20260519-WA0000.jpg"
              alt="City Gate Capital"
              width={128}
              height={128}
              className="h-32 w-auto object-contain"
              style={{ filter: 'drop-shadow(0 0 24px rgba(212,175,55,0.7))' }}
              animate={{ filter: ['drop-shadow(0 0 16px rgba(212,175,55,0.5))', 'drop-shadow(0 0 32px rgba(212,175,55,0.9))', 'drop-shadow(0 0 16px rgba(212,175,55,0.5))'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-center"
            >
              <p className="text-white font-bold text-2xl tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                City Gate Capital
              </p>
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mt-1" style={{ color: '#D4AF37' }}>
                Premium Digital Banking
              </p>
            </motion.div>

            {/* Loading bar */}
            <motion.div className="w-48 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #C9A84C, #F0D080)' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.3 }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
