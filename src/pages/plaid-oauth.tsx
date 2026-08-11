import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCustomerAuth } from '@/lib/customerAuth';

export default function PlaidOAuthPage() {
  const { token, customer, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    if (loading) return;
    if (!customer || !token) { navigate('/login?reason=session_expired', { replace: true }); return; }
    const linkToken = sessionStorage.getItem('cgc_plaid_link_token');
    if (!linkToken) { setError('This bank-linking session has expired. Return to Accounts and try again.'); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'; script.async = true;
    script.onload = () => {
      const handler = window.Plaid?.create({ token: linkToken, receivedRedirectUri: window.location.href,
        onSuccess: async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string }; accounts?: unknown[] }) => {
          const response = await fetch('/api/users/plaid/exchange', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ publicToken, metadata }) });
          if (response.ok) { sessionStorage.removeItem('cgc_plaid_link_token'); navigate('/dashboard/accounts?plaid=connected', { replace: true }); }
          else setError('The institution connected, but account setup could not be completed.');
        }, onExit: () => navigate('/dashboard/accounts', { replace: true }) });
      handler?.open();
    };
    script.onerror = () => setError('Plaid Link could not be loaded.');
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [customer, loading, navigate, token]);
  return <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6 text-center text-white"><div>{error ? <><p className="text-sm text-red-300">{error}</p><button className="mt-4 text-sm text-[#C9A84C]" onClick={() => navigate('/dashboard/accounts')}>Return to Accounts</button></> : <><Loader2 className="mx-auto h-8 w-8 animate-spin text-[#C9A84C]" /><p className="mt-3 text-sm text-white/60">Returning securely to Plaid…</p></>}</div></main>;
}
