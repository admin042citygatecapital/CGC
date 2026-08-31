import AdminLayout from '@/layouts/AdminLayout';
import { authHeaders } from '@/lib/adminAuth';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface TawkIntegration {
  id: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'partial' | 'unknown';
  config: Record<string, string>;
  lastTestedAt: string | null;
}

export default function AdminChatbot() {
  const [integration, setIntegration] = useState<TawkIntegration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/integrations?id=tawk', { headers: authHeaders() })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load tawk.to configuration');
        return response.json() as Promise<{ integration: TawkIntegration }>;
      })
      .then(payload => {
        if (!cancelled) setIntegration(payload.integration);
      })
      .catch(() => {
        if (!cancelled) setIntegration(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const connected = integration?.status === 'connected';

  return (
    <AdminLayout>
      <Helmet>
        <title>tawk.to Support — CGC Admin</title>
        <meta name="description" content="Manage the City Gate Capital tawk.to customer-support integration." />
      </Helmet>

      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C9A84C]">Customer support</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">tawk.to Support Center</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
            City Gate Capital uses tawk.to for customer-facing live support. The branded launcher loads the third-party
            widget only after a visitor asks for help and sends no account, balance, KYC, card, or authentication data.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/10">
                <MessageSquare className="h-5 w-5 text-[#C9A84C]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-white">tawk.to live chat</h2>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                  ) : connected && integration?.enabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      Needs attention
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  Public embed identifiers are managed in the Integrations Center. Conversation operations remain in tawk.to.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/integrations"
                className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/10 px-4 py-2 text-xs font-semibold text-[#E6C76A] hover:bg-[#C9A84C]/15"
              >
                <Settings2 className="h-4 w-4" /> Configure
              </Link>
              <a
                href="https://dashboard.tawk.to/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
              >
                Open tawk.to <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/[0.04] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A84C]" />
            <div>
              <h2 className="text-sm font-semibold text-white">Privacy boundary</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                The website supplies only coarse journey labels such as guest or authenticated and the current support
                section. Customers are reminded never to share passwords, authentication codes, card details, or recovery keys.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
