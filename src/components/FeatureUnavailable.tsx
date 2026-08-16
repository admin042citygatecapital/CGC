import { ArrowLeft, Headphones, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FeatureUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070706] px-5 text-white">
      <section className="w-full max-w-xl rounded-[28px] border border-[#d8b04c]/20 bg-[#0d0d0b] p-8 text-center shadow-2xl shadow-black/50 sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#d8b04c]/25 bg-[#d8b04c]/10 text-[#e8c45f]">
          <ShieldCheck size={24} />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.24em] text-[#d8b04c]">
          Service availability
        </p>
        <h1 className="mt-3 text-3xl font-bold">This service is currently unavailable</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/50">
          Your account remains secure. You can return to your dashboard or contact support for
          assistance.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d8b04c] px-5 py-3 text-sm font-bold text-black"
          >
            <ArrowLeft size={15} /> Return to dashboard
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70"
          >
            <Headphones size={15} /> Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}
