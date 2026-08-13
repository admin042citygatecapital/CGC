import { Helmet } from "@dr.pogodin/react-helmet";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { newIdempotencyKey } from "@/lib/idempotency";

type Account = {
  id: string;
  label: string;
  accountType: string;
  status: string;
  primaryCurrency: string;
  availableMinor: string;
  restrictions: string[];
};
type Currency = {
  code: string;
  symbol: string;
  flag: string;
  decimals: number;
};
type Transfer = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  currency: string;
  amountMinor: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  description: string;
  executionSource: "SIMULATION";
  createdAt: string;
};

function money(minor: string, currency?: Currency) {
  const decimals = currency?.decimals ?? 2;
  const factor = 10n ** BigInt(decimals);
  const value = BigInt(minor || "0");
  return `${currency?.symbol ?? ""}${(value / factor).toLocaleString()}.${(value % factor).toString().padStart(decimals, "0")} ${currency?.code ?? ""}`;
}

export default function CustomerTransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [form, setForm] = useState({
    sourceAccountId: "",
    destinationAccountId: "",
    amount: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountResponse, transferResponse] = await Promise.all([
        fetch("/api/users/accounts", { credentials: "same-origin" }),
        fetch("/api/users/transfers", { credentials: "same-origin" }),
      ]);
      const accountBody = await accountResponse.json();
      const transferBody = await transferResponse.json();
      if (!accountResponse.ok)
        throw new Error(accountBody.error ?? "Unable to load accounts.");
      if (!transferResponse.ok)
        throw new Error(transferBody.error ?? "Unable to load transfers.");
      setAccounts(accountBody.accounts ?? []);
      setCurrencies(accountBody.currencies ?? []);
      setTransfers(transferBody.transfers ?? []);
      setForm((value) => ({
        ...value,
        sourceAccountId:
          value.sourceAccountId || accountBody.accounts?.[0]?.id || "",
      }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load transfers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currencyMap = useMemo(
    () => new Map(currencies.map((item) => [item.code, item])),
    [currencies],
  );
  const source = accounts.find((item) => item.id === form.sourceAccountId);
  const destinations = accounts.filter(
    (item) =>
      item.id !== source?.id &&
      item.status === "active" &&
      item.primaryCurrency === source?.primaryCurrency &&
      !item.restrictions.includes("credits_disabled") &&
      !item.restrictions.includes("transfers_disabled"),
  );
  const canSend =
    source?.status === "active" &&
    destinations.some((item) => item.id === form.destinationAccountId) &&
    Number(form.amount) > 0 &&
    form.description.trim().length >= 3 &&
    !source.restrictions.includes("debits_disabled") &&
    !source.restrictions.includes("transfers_disabled");

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const csrfResponse = await fetch("/api/csrf", {
        credentials: "same-origin",
      });
      const { csrfToken } = await csrfResponse.json();
      const response = await fetch("/api/users/transfers", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          "Idempotency-Key": newIdempotencyKey(),
        },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to post transfer.");
      setMessage(`Balanced internal transfer posted: ${body.reference}`);
      setForm((value) => ({ ...value, amount: "", description: "" }));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to post transfer.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Helmet>
        <title>Internal Transfers — City Gate Capital</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/45"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1">
            <p className="text-sm font-bold">Internal Transfers</p>
            <p className="text-[10px] text-white/30">
              Customer-owned simulation ledger
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="w-9 h-9 rounded-xl border border-white/10 text-white/45"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin mx-auto" : "mx-auto"}
            />
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 mb-6 flex gap-3">
          <Shield className="text-primary shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold">Balanced simulation only</p>
            <p className="text-xs text-white/40 mt-1">
              Transfers move synthetic value between your own active accounts.
              No bank, payment provider, custody system or external recipient is
              contacted.
            </p>
          </div>
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {message}
          </div>
        )}
        <div className="grid lg:grid-cols-[380px_1fr] gap-6">
          <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 h-fit">
            <h1 className="font-bold mb-1">New internal transfer</h1>
            <p className="text-xs text-white/35 mb-5">
              Every successful transfer creates one balanced journal entry.
            </p>
            <label className="text-[10px] uppercase text-white/35">
              From account
            </label>
            <select
              value={form.sourceAccountId}
              onChange={(event) =>
                setForm({
                  ...form,
                  sourceAccountId: event.target.value,
                  destinationAccountId: "",
                })
              }
              className="mt-1 mb-4 w-full bg-[#0b0b0b] border border-white/10 rounded-xl px-3 py-3 text-sm"
            >
              <option value="">Select source</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} · {account.primaryCurrency}
                </option>
              ))}
            </select>
            {source && (
              <div className="mb-4 rounded-xl bg-black/30 p-3 text-xs flex justify-between">
                <span className="text-white/35">Available</span>
                <span>
                  {money(
                    source.availableMinor,
                    currencyMap.get(source.primaryCurrency),
                  )}
                </span>
              </div>
            )}
            <label className="text-[10px] uppercase text-white/35">
              To account
            </label>
            <select
              value={form.destinationAccountId}
              onChange={(event) =>
                setForm({ ...form, destinationAccountId: event.target.value })
              }
              className="mt-1 mb-4 w-full bg-[#0b0b0b] border border-white/10 rounded-xl px-3 py-3 text-sm"
            >
              <option value="">Select destination</option>
              {destinations.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} · {account.primaryCurrency}
                </option>
              ))}
            </select>
            <label className="text-[10px] uppercase text-white/35">
              Amount
            </label>
            <input
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 mb-4 w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm"
            />
            <label className="text-[10px] uppercase text-white/35">
              Description
            </label>
            <input
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Reason for transfer"
              className="mt-1 mb-4 w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm"
            />
            <button
              onClick={() => void submit()}
              disabled={!canSend || busy}
              className="w-full rounded-xl bg-primary py-3 font-bold text-black disabled:opacity-30"
            >
              {busy ? (
                <Loader2 className="animate-spin mx-auto" size={18} />
              ) : (
                <>
                  <Send size={15} className="inline mr-2" />
                  Post internal transfer
                </>
              )}
            </button>
          </section>
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold">Transaction history</h2>
                <p className="text-xs text-white/30">
                  {transfers.length} synthetic journal transactions
                </p>
              </div>
              <Link to="/dashboard/accounts" className="text-xs text-primary">
                View accounts <ArrowRight size={12} className="inline" />
              </Link>
            </div>
            {loading ? (
              <div className="py-20 text-center text-white/30">
                <Loader2 className="animate-spin mx-auto" />
              </div>
            ) : transfers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center text-white/30">
                <WalletCards className="mx-auto mb-3" />
                <p>No internal transfers yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.map((transfer) => (
                  <article
                    key={transfer.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Send size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {transfer.description}
                      </p>
                      <p className="text-[10px] text-white/30 font-mono">
                        {transfer.reference} ·{" "}
                        {new Date(transfer.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {money(
                          transfer.amountMinor,
                          currencyMap.get(transfer.currency),
                        )}
                      </p>
                      <p className="text-[9px] uppercase text-emerald-400">
                        {transfer.status} · simulation
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
