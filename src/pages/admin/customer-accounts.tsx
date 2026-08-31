import { Helmet } from "@dr.pogodin/react-helmet";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/layouts/AdminLayout";
import { authHeaders } from "@/lib/adminAuth";

type Currency = {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
};
type Account = {
  id: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  label: string;
  accountType: "personal" | "savings" | "business";
  status: "pending" | "active" | "restricted" | "closed";
  primaryCurrency: string;
  availableMinor: string;
  ledgerMinor: string;
  pendingMinor: string;
  restrictions: string[];
  synthetic: true;
  updatedAt: string;
};
type Customer = { id: string; name: string; email: string; status: string };
type LedgerTransaction = {
  id: string;
  ownerUserId: string;
  reference: string;
  kind: "opening_adjustment" | "internal_transfer" | "controlled_adjustment" | "reversal";
  status: "completed" | "reversed";
  currency: string;
  amountMinor: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  description: string;
  executionSource: "SIMULATION";
  synthetic: true;
  lines: Array<{ debitMinor: string; creditMinor: string }>;
  createdAt: string;
};
type Payload = {
  accounts: Account[];
  currencies: Currency[];
  recentTransactions: LedgerTransaction[];
  syntheticOnly: true;
  balanceMutationsAllowed: false;
};

const RESTRICTIONS = [
  ["debits_disabled", "Debits"],
  ["credits_disabled", "Credits"],
  ["transfers_disabled", "Transfers"],
  ["cards_disabled", "Cards"],
  ["withdrawals_disabled", "Withdrawals"],
] as const;

function amount(minor: string, currency: Currency | undefined) {
  const decimals = currency?.decimals ?? 2;
  const factor = 10n ** BigInt(decimals);
  const value = BigInt(minor || "0");
  return `${currency?.symbol ?? ""}${(value / factor).toLocaleString()}.${(value % factor).toString().padStart(decimals, "0")} ${currency?.code ?? ""}`;
}

export default function AdminCustomerAccounts() {
  const [payload, setPayload] = useState<Payload>({
    accounts: [],
    currencies: [],
    recentTransactions: [],
    syntheticOnly: true,
    balanceMutationsAllowed: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    userId: "",
    label: "",
    accountType: "personal",
    primaryCurrency: "GBP",
    status: "pending",
  });
  const [control, setControl] = useState<
    Record<
      string,
      { status: Account["status"]; restrictions: string[]; reason: string }
    >
  >({});
  const [adjustment, setAdjustment] = useState<
    Record<
      string,
      {
        direction: "credit" | "debit";
        amount: string;
        reference: string;
        reason: string;
        opening: boolean;
      }
    >
  >({});
  const [reversalReason, setReversalReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      const response = await fetch(`/api/admin/customer-accounts?${query}`, {
        headers: authHeaders(),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to load accounts.");
      setPayload(body);
      setControl(
        Object.fromEntries(
          body.accounts.map((account: Account) => [
            account.id,
            {
              status: account.status,
              restrictions: account.restrictions,
              reason: "",
            },
          ]),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function findCustomers() {
    if (customerQuery.trim().length < 2) return;
    const response = await fetch(
      `/api/admin/users?search=${encodeURIComponent(customerQuery.trim())}&limit=10`,
      { headers: authHeaders() },
    );
    const body = await response.json();
    setCustomers(response.ok ? (body.users ?? body.data ?? []) : []);
  }

  async function createAccount() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/customer-accounts", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
          "Idempotency-Key": `customer-account-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ action: "create", ...form }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to create account.");
      setMessage("Synthetic customer account created with zero balances.");
      setForm((value) => ({ ...value, label: "" }));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create account.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveControls(account: Account) {
    const next = control[account.id];
    if (!next) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/customer-accounts", {
        method: "POST",
        credentials: "same-origin",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_controls",
          accountId: account.id,
          ...next,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to update controls.");
      setMessage(`Controls updated for ${account.label}.`);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update controls.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function postAdjustment(account: Account) {
    const next = adjustment[account.id];
    if (!next) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/customer-accounts", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
          "Idempotency-Key": `customer-adjustment-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          action: "adjust",
          accountId: account.id,
          ...next,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to post adjustment.");
      setMessage(
        `Balanced ${next.direction} journal posted for ${account.label}.`,
      );
      setAdjustment((value) => ({
        ...value,
        [account.id]: {
          ...next,
          amount: "",
          reference: "",
          reason: "",
          opening: false,
        },
      }));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to post adjustment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reverseTransaction(transaction: LedgerTransaction) {
    const reason = reversalReason[transaction.id]?.trim() ?? "";
    if (reason.length < 3) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/customer-accounts", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
          "Idempotency-Key": `customer-reversal-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          action: "reverse",
          transactionId: transaction.id,
          reason,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to reverse transaction.");
      setMessage(`Balanced reversal posted for ${transaction.reference}.`);
      setReversalReason((value) => ({ ...value, [transaction.id]: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reverse transaction.");
    } finally {
      setBusy(false);
    }
  }

  const currencyMap = useMemo(
    () => new Map(payload.currencies.map((item) => [item.code, item])),
    [payload.currencies],
  );

  return (
    <AdminLayout title="Customer Accounts">
      <Helmet>
        <title>Customer Accounts — CGC Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] text-primary mb-2">
            SUPER ADMIN · SYNTHETIC REGISTRY
          </p>
          <h1 className="text-2xl font-bold text-white">
            Customer account control
          </h1>
          <p className="text-sm text-white/35 mt-1 max-w-3xl">
            Provision Personal, Savings and Business application accounts,
            select configured currencies, and enforce restrictions. Balances
            start at zero and cannot be edited directly.
          </p>
        </div>
        <Link
          to="/admin/transactions"
          className="px-4 py-2.5 rounded-xl border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/10"
        >
          Review transaction register
        </Link>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 mb-5 flex gap-3">
        <Shield size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">
            Account boundary enforced
          </p>
          <p className="text-xs text-white/40 mt-1">
            No IBAN, routing number, provider account, custody address, deposit
            instruction or live financial balance is created by this registry.
          </p>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`rounded-xl border p-3 mb-5 text-sm ${error ? "border-red-500/25 bg-red-500/10 text-red-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"}`}
        >
          {error || message}
        </div>
      )}

      <div className="grid xl:grid-cols-[360px_1fr] gap-5">
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 h-fit">
          <h2 className="text-sm font-bold text-white mb-4">
            Provision account
          </h2>
          <label className="text-[10px] uppercase tracking-wide text-white/35">
            Find customer
          </label>
          <div className="flex gap-2 mt-1.5 mb-2">
            <input
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && void findCustomers()
              }
              placeholder="Name or email"
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={() => void findCustomers()}
              className="w-10 rounded-xl border border-white/10 text-white/50"
            >
              <Search size={14} className="mx-auto" />
            </button>
          </div>
          {customers.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => {
                    setForm((value) => ({ ...value, userId: customer.id }));
                    setCustomers([]);
                    setCustomerQuery(`${customer.name} · ${customer.email}`);
                  }}
                  className="w-full text-left rounded-lg border border-white/5 p-2 hover:border-primary/25"
                >
                  <p className="text-xs text-white/75">{customer.name}</p>
                  <p className="text-[10px] text-white/30">{customer.email}</p>
                </button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            <input
              value={form.label}
              onChange={(event) =>
                setForm({ ...form, label: event.target.value })
              }
              placeholder="Account label"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/40"
            />
            <select
              value={form.accountType}
              onChange={(event) =>
                setForm({ ...form, accountType: event.target.value })
              }
              className="w-full bg-[#0b0b0b] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
            >
              <option value="personal">Personal</option>
              <option value="savings">Savings</option>
              <option value="business">Business</option>
            </select>
            <select
              value={form.primaryCurrency}
              onChange={(event) =>
                setForm({ ...form, primaryCurrency: event.target.value })
              }
              className="w-full bg-[#0b0b0b] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
            >
              {payload.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.flag} {currency.code} · {currency.name}
                </option>
              ))}
            </select>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
              className="w-full bg-[#0b0b0b] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="restricted">Restricted</option>
            </select>
            <button
              onClick={() => void createAccount()}
              disabled={busy || !form.userId || !form.label.trim()}
              className="w-full rounded-xl bg-primary text-black py-2.5 text-sm font-bold disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin mx-auto" />
              ) : (
                "Create synthetic account"
              )}
            </button>
          </div>
        </section>

        <section>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search accounts or customers"
                className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <button
              onClick={() => void load()}
              className="w-11 rounded-xl border border-white/8 text-white/40"
            >
              <RefreshCw
                size={14}
                className={`mx-auto ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {loading ? (
            <div className="py-20 text-center text-white/30">
              <Loader2 className="animate-spin mx-auto mb-3" />
              Loading accounts…
            </div>
          ) : payload.accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center">
              <Database size={24} className="mx-auto text-white/20 mb-3" />
              <p className="text-sm text-white/40">
                No structured customer accounts yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payload.accounts.map((account) => {
                const current = control[account.id] ?? {
                  status: account.status,
                  restrictions: account.restrictions,
                  reason: "",
                };
                const currency = currencyMap.get(account.primaryCurrency);
                const journal = adjustment[account.id] ?? {
                  direction: "credit" as const,
                  amount: "",
                  reference: "",
                  reason: "",
                  opening: false,
                };
                return (
                  <article
                    key={account.id}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-3 mb-4">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <WalletCards size={17} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {account.label}
                          </p>
                          <p className="text-xs text-white/35">
                            {account.customerName} · {account.customerEmail}
                          </p>
                          <p className="text-[10px] font-mono text-white/20 mt-1">
                            {account.id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">
                          {currency?.flag} {account.primaryCurrency}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-emerald-400">
                          Synthetic
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        ["Available", account.availableMinor],
                        ["Ledger", account.ledgerMinor],
                        ["Pending", account.pendingMinor],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-black/25 p-3">
                          <p className="text-[9px] uppercase text-white/25">
                            {label}
                          </p>
                          <p className="text-xs text-white/70 mt-1">
                            {amount(value, currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="grid md:grid-cols-[150px_1fr] gap-3">
                      <select
                        value={current.status}
                        disabled={account.status === "closed"}
                        onChange={(event) =>
                          setControl({
                            ...control,
                            [account.id]: {
                              ...current,
                              status: event.target.value as Account["status"],
                            },
                          })
                        }
                        className="bg-[#0b0b0b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="restricted">Restricted</option>
                        <option value="closed">Closed</option>
                      </select>
                      <input
                        value={current.reason}
                        onChange={(event) =>
                          setControl({
                            ...control,
                            [account.id]: {
                              ...current,
                              reason: event.target.value,
                            },
                          })
                        }
                        placeholder="Required control reason (10+ characters)"
                        className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {RESTRICTIONS.map(([value, label]) => (
                        <label
                          key={value}
                          className="flex items-center gap-1.5 rounded-lg border border-white/8 px-2.5 py-1.5 text-[10px] text-white/45"
                        >
                          <input
                            type="checkbox"
                            checked={current.restrictions.includes(value)}
                            onChange={(event) =>
                              setControl({
                                ...control,
                                [account.id]: {
                                  ...current,
                                  restrictions: event.target.checked
                                    ? [...current.restrictions, value]
                                    : current.restrictions.filter(
                                        (item) => item !== value,
                                      ),
                                },
                              })
                            }
                          />
                          {label}
                        </label>
                      ))}
                      <button
                        onClick={() => void saveControls(account)}
                        disabled={busy || current.reason.trim().length < 10}
                        className="ml-auto rounded-lg border border-primary/25 px-3 py-1.5 text-[10px] font-bold text-primary disabled:opacity-30"
                      >
                        <CheckCircle2 size={11} className="inline mr-1" />
                        Save controls
                      </button>
                    </div>
                    <div className="mt-4 border-t border-white/6 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                        Controlled ledger adjustment
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
                        <select
                          value={journal.direction}
                          onChange={(event) =>
                            setAdjustment({
                              ...adjustment,
                              [account.id]: {
                                ...journal,
                                direction: event.target.value as
                                  | "credit"
                                  | "debit",
                              },
                            })
                          }
                          className="bg-[#0b0b0b] border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                        >
                          <option value="credit">Credit</option>
                          <option value="debit">Debit</option>
                        </select>
                        <input
                          value={journal.amount}
                          onChange={(event) =>
                            setAdjustment({
                              ...adjustment,
                              [account.id]: {
                                ...journal,
                                amount: event.target.value,
                              },
                            })
                          }
                          placeholder="Amount"
                          inputMode="decimal"
                          className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                        />
                        <input
                          value={journal.reference}
                          onChange={(event) =>
                            setAdjustment({
                              ...adjustment,
                              [account.id]: {
                                ...journal,
                                reference: event.target.value,
                              },
                            })
                          }
                          placeholder="Reference"
                          className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                        />
                        <input
                          value={journal.reason}
                          onChange={(event) =>
                            setAdjustment({
                              ...adjustment,
                              [account.id]: {
                                ...journal,
                                reason: event.target.value,
                              },
                            })
                          }
                          placeholder="Reason"
                          className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                        />
                        <button
                          onClick={() => void postAdjustment(account)}
                          disabled={
                            busy ||
                            !journal.amount ||
                            journal.reference.trim().length < 3 ||
                            journal.reason.trim().length < 3
                          }
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-black disabled:opacity-30"
                        >
                          Post journal
                        </button>
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-[10px] text-white/35">
                        <input
                          type="checkbox"
                          checked={journal.opening}
                          onChange={(event) =>
                            setAdjustment({
                              ...adjustment,
                              [account.id]: {
                                ...journal,
                                opening: event.target.checked,
                              },
                            })
                          }
                        />{" "}
                        Mark as opening adjustment
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex gap-2 text-[11px] text-amber-200/50">
            <AlertTriangle size={13} className="shrink-0" />
            Balance changes are permitted only through the balanced simulation
            journal above. They never unlock live financial operations.
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Immutable customer journal
            </p>
            <h2 className="text-base font-bold text-white mt-1">Recent simulation activity</h2>
          </div>
          <p className="text-[10px] text-white/30">Balanced entries only · newest first</p>
        </div>
        {payload.recentTransactions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">
            No customer journal activity has been posted.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="text-[9px] uppercase tracking-wider text-white/25">
                <tr className="border-b border-white/8">
                  <th className="pb-2 font-medium">Reference</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Journal</th>
                  <th className="pb-2 font-medium">Posted</th>
                  <th className="pb-2 font-medium">Controlled action</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {payload.recentTransactions.map((transaction) => {
                  const currency = currencyMap.get(transaction.currency);
                  const debits = transaction.lines.reduce((sum, line) => sum + BigInt(line.debitMinor), 0n);
                  const credits = transaction.lines.reduce((sum, line) => sum + BigInt(line.creditMinor), 0n);
                  return (
                    <tr key={transaction.id} className="border-b border-white/[0.05] text-white/55">
                      <td className="py-3">
                        <p className="font-mono text-white/75">{transaction.reference}</p>
                        <p className="text-[9px] text-white/20 mt-1">{transaction.description}</p>
                      </td>
                      <td className="py-3 capitalize">{transaction.kind.replaceAll("_", " ")}</td>
                      <td className="py-3 text-white/75">{amount(transaction.amountMinor, currency)}</td>
                      <td className="py-3 uppercase text-[10px] text-emerald-400">{transaction.status}</td>
                      <td className="py-3 font-mono text-[10px]">
                        D {debits.toString()} / C {credits.toString()}
                        {debits === credits ? " · balanced" : " · invalid"}
                      </td>
                      <td className="py-3 text-[10px]">{new Date(transaction.createdAt).toLocaleString()}</td>
                      <td className="py-3">
                        {transaction.status === "completed" && transaction.kind !== "reversal" ? (
                          <div className="flex min-w-[220px] gap-2">
                            <input
                              value={reversalReason[transaction.id] ?? ""}
                              onChange={(event) => setReversalReason((value) => ({
                                ...value,
                                [transaction.id]: event.target.value,
                              }))}
                              placeholder="Reversal reason"
                              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white"
                            />
                            <button
                              disabled={busy || (reversalReason[transaction.id]?.trim().length ?? 0) < 3}
                              onClick={() => void reverseTransaction(transaction)}
                              className="rounded-lg border border-amber-400/25 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 disabled:opacity-30"
                            >
                              Reverse
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/20">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
