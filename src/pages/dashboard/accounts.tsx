import { Helmet } from "@dr.pogodin/react-helmet";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  PiggyBank,
  Shield,
  User,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/lib/customerAuth";

type Currency = {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
};
type Account = {
  id: string;
  label: string;
  accountType: "personal" | "savings" | "business";
  status: "pending" | "active" | "restricted" | "closed";
  primaryCurrency: string;
  availableMinor: string;
  ledgerMinor: string;
  pendingMinor: string;
  restrictions: string[];
  synthetic: true;
  createdAt: string;
};

function formatMinor(
  value: string,
  currency: Currency | undefined,
  hidden: boolean,
) {
  if (hidden) return "••••••";
  const decimals = currency?.decimals ?? 2;
  const amount = BigInt(value || "0");
  const factor = 10n ** BigInt(decimals);
  return `${currency?.symbol ?? ""}${(amount / factor).toLocaleString()}.${(amount % factor).toString().padStart(decimals, "0")}`;
}

const ICONS = { personal: User, savings: PiggyBank, business: Building2 };
const STATUS = {
  pending: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  active: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  restricted: "text-red-300 bg-red-500/10 border-red-500/20",
  closed: "text-white/35 bg-white/5 border-white/10",
};

export default function CustomerAccountsPage() {
  const { customer, loading: authLoading } = useCustomerAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(
    () => localStorage.getItem("cgc-privacy") === "1",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !customer) navigate("/login?reason=session_expired");
  }, [authLoading, customer, navigate]);
  useEffect(() => {
    fetch("/api/users/accounts", { credentials: "same-origin" })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok)
          throw new Error(body.error ?? "Unable to load accounts.");
        setAccounts(body.accounts ?? []);
        setCurrencies(body.currencies ?? []);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to load accounts.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const currencyMap = useMemo(
    () => new Map(currencies.map((item) => [item.code, item])),
    [currencies],
  );
  function togglePrivacy() {
    setHidden((value) => {
      localStorage.setItem("cgc-privacy", value ? "0" : "1");
      return !value;
    });
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Helmet>
        <title>My Accounts — City Gate Capital</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/45 hover:text-white"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">My Accounts</h1>
            <p className="text-[10px] text-white/30">
              Structured account overview
            </p>
          </div>
          <button
            onClick={togglePrivacy}
            aria-label={hidden ? "Show balances" : "Hide balances"}
            className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/45"
          >
            {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 mb-6 flex gap-3">
          <Shield size={18} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary">
              Application account workspace
            </p>
            <p className="text-xs text-white/40 mt-1">
              These accounts and balances are synthetic. Funding instructions,
              provider account numbers and live money movement are unavailable.
            </p>
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 p-4 mb-5 text-sm">
            <AlertCircle size={15} className="inline mr-2" />
            {error}
          </div>
        )}
        {loading || authLoading ? (
          <div className="py-24 text-center text-white/35">
            <Loader2 className="animate-spin mx-auto mb-3" />
            Loading your accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 py-24 text-center">
            <WalletCards size={28} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/55 font-semibold">
              No structured accounts provisioned
            </p>
            <p className="text-sm text-white/25 mt-2 max-w-md mx-auto">
              Your super-administrator can provision a Personal, Savings or
              Business application account from the account control panel.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {accounts.map((account) => {
              const currency = currencyMap.get(account.primaryCurrency);
              const Icon = ICONS[account.accountType];
              return (
                <article
                  key={account.id}
                  className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-6 overflow-hidden relative"
                >
                  <div className="absolute -right-16 -top-16 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
                  <div className="relative">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <Icon size={19} />
                        </div>
                        <div>
                          <p className="text-base font-bold">{account.label}</p>
                          <p className="text-xs text-white/35 capitalize">
                            {account.accountType} account
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-wide ${STATUS[account.status]}`}
                      >
                        {account.status}
                      </span>
                    </div>
                    <div className="mt-8">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                        Available balance
                      </p>
                      <p className="text-3xl font-bold mt-1">
                        {formatMinor(account.availableMinor, currency, hidden)}{" "}
                        <span className="text-sm text-white/35">
                          {account.primaryCurrency}
                        </span>
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[9px] uppercase text-white/25">
                          Ledger balance
                        </p>
                        <p className="text-sm mt-1">
                          {formatMinor(account.ledgerMinor, currency, hidden)}{" "}
                          {account.primaryCurrency}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-[9px] uppercase text-white/25">
                          Pending
                        </p>
                        <p className="text-sm mt-1">
                          {formatMinor(account.pendingMinor, currency, hidden)}{" "}
                          {account.primaryCurrency}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.06]">
                      <span className="text-xs text-white/35">
                        {currency?.flag}{" "}
                        {currency?.name ?? account.primaryCurrency}
                      </span>
                      <span className="text-[10px] font-mono text-white/20">
                        {account.id.slice(-12)}
                      </span>
                    </div>
                    {account.restrictions.length > 0 && (
                      <div className="mt-4 rounded-xl border border-red-500/15 bg-red-500/[0.06] p-3 flex gap-2">
                        <Lock size={13} className="text-red-300 shrink-0" />
                        <p className="text-[11px] text-red-200/60">
                          Restrictions:{" "}
                          {account.restrictions
                            .map((item) => item.replace(/_/g, " "))
                            .join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
