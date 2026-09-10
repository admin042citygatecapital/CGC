import { Helmet } from "@dr.pogodin/react-helmet";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Bitcoin,
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { authHeaders } from "@/lib/adminAuth";

type Account = {
  id: string;
  name: string;
  type: string;
  asset: string;
  balanceMinor: string;
  synthetic: true;
};
type JournalLine = {
  accountId: string;
  debitMinor: string;
  creditMinor: string;
  asset: string;
};
type Transaction = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  asset: string;
  amountMinor: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  reason: string;
  executionSource: "SIMULATION";
  createdAt: string;
  lines?: JournalLine[];
};
type Capability = {
  key: string;
  label: string;
  category: "transaction" | "control" | "market_data";
  status: "implemented" | "adapter_required";
  description: string;
  executionBoundary: "SIMULATION" | "READ_ONLY";
};
type RailInstruction = {
  id: string;
  reference: string;
  rail: string;
  direction: "inbound" | "outbound" | "internal";
  status: string;
  asset: string;
  amountMinor: string;
  sourceReference: string;
  destinationReference: string;
  memo: string;
  scheduledFor?: string;
  recurrence?: "daily" | "weekly" | "monthly";
  providerAdapterState: "DISCONNECTED";
  executionSource: "SIMULATION";
  createdAt: string;
};
type Overview = {
  accounts: number;
  transactions: number;
  pending: number;
  completed: number;
  reversed: number;
  cancelled: number;
  journalEntries: number;
  integrityBreaks: number;
};
type Payload = {
  mutationsEnabled?: boolean;
  accounts: Account[];
  data: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  overview: Overview;
  capabilities: Capability[];
  railInstructions: RailInstruction[];
};
const EMPTY_OVERVIEW: Overview = {
  accounts: 0,
  transactions: 0,
  pending: 0,
  completed: 0,
  reversed: 0,
  cancelled: 0,
  journalEntries: 0,
  integrityBreaks: 0,
};
const ASSETS = ["GBP", "EUR", "USD", "CAD", "AUD", "CHF", "BTC", "ETH", "USDT"];
const ACCOUNT_TYPES = [
  "personal",
  "savings",
  "business",
  "fiat_wallet",
  "crypto_wallet",
];
const RAILS = [
  "p2p",
  "ach",
  "wire",
  "rtp",
  "fednow",
  "mobile_check_deposit",
  "direct_deposit",
  "withdrawal",
  "scheduled_payment",
  "recurring_payment",
  "card",
  "bill_pay",
];
const RAIL_TRANSITIONS: Record<string, string[]> = {
  pending_approval: ["scheduled", "queued", "cancelled"],
  scheduled: ["queued", "cancelled"],
  queued: ["processing", "cancelled", "failed"],
  processing: ["settled", "returned", "failed"],
  settled: ["returned"],
};

function amount(minor: string, asset: string) {
  const decimals = ["BTC", "ETH", "USDT"].includes(asset) ? 8 : 2;
  const value = BigInt(minor);
  const factor = 10n ** BigInt(decimals);
  return `${(value / factor).toLocaleString()}.${(value % factor).toString().padStart(decimals, "0")} ${asset}`;
}
function key() {
  return `sandbox-${Date.now()}-${crypto.randomUUID()}`;
}

export default function AdminFinancialSandbox() {
  const [payload, setPayload] = useState<Payload>({
    accounts: [],
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    overview: EMPTY_OVERVIEW,
    capabilities: [],
    railInstructions: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [asset, setAsset] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: "",
    type: "personal",
    asset: "GBP",
  });
  const [operation, setOperation] = useState({
    action: "transfer",
    sourceAccountId: "",
    destinationAccountId: "",
    accountId: "",
    amount: "",
    direction: "credit",
    reason: "",
    reference: "",
    confirmed: false,
  });
  const [railForm, setRailForm] = useState({
    rail: "ach",
    direction: "outbound",
    asset: "USD",
    amount: "",
    sourceReference: "syn_customer_account",
    destinationReference: "syn_external_counterparty",
    memo: "",
    scheduledFor: "",
    recurrence: "",
  });
  const [railTransition, setRailTransition] = useState<
    Record<string, { toStatus: string; reason: string }>
  >({});

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          search,
          status,
          asset,
          page: String(page),
          pageSize: "20",
        });
        const response = await fetch(`/api/admin/financial-sandbox?${query}`, {
          headers: authHeaders(),
          credentials: "same-origin",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setPayload(body);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Unable to load simulation workspace.",
        );
      } finally {
        setLoading(false);
      }
    },
    [asset, search, status],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(body: Record<string, unknown>) {
    if (payload.mutationsEnabled !== true) {
      setError('Sandbox financial controls are disabled. Ask a super admin to enable Sandbox Financial Controls in Configuration > Feature Toggles. Existing records remain viewable.');
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/financial-sandbox", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
          "Idempotency-Key": key(),
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation action failed.");
    } finally {
      setBusy(false);
    }
  }
  async function createAccount() {
    if (!accountForm.name.trim()) return;
    await submit({ action: "create_account", ...accountForm });
    setAccountForm((value) => ({ ...value, name: "" }));
  }
  async function runOperation() {
    await submit({
      ...operation,
      confirmed:
        operation.action === "adjust" ? operation.confirmed : undefined,
    });
    setOperation((value) => ({
      ...value,
      amount: "",
      reason: "",
      reference: "",
      confirmed: false,
    }));
  }
  async function createRailInstruction() {
    await submit({ action: "create_rail_instruction", ...railForm });
    setRailForm((value) => ({
      ...value,
      amount: "",
      memo: "",
      scheduledFor: "",
    }));
  }
  async function transitionRailInstruction(instruction: RailInstruction) {
    const allowed = RAIL_TRANSITIONS[instruction.status] ?? [];
    const transition = railTransition[instruction.id] ?? {
      toStatus: allowed[0] ?? "",
      reason: "",
    };
    if (!transition.toStatus || transition.reason.trim().length < 3) return;
    await submit({
      action: "transition_rail_instruction",
      instructionId: instruction.id,
      ...transition,
    });
    setRailTransition((value) => ({
      ...value,
      [instruction.id]: { ...transition, reason: "" },
    }));
  }
  async function reverse(tx: Transaction) {
    const reason = window.prompt("Reason for controlled reversal?");
    if (!reason) return;
    await submit({ action: "reverse", transactionId: tx.id, reason });
    setSelected(null);
  }
  async function cancel(tx: Transaction) {
    const reason = window.prompt("Reason for controlled cancellation?");
    if (!reason) return;
    await submit({ action: "cancel", transactionId: tx.id, reason });
    setSelected(null);
  }
  async function inspect(tx: Transaction) {
    setSelected(tx);
    try {
      const response = await fetch(
        `/api/admin/financial-sandbox?transactionId=${encodeURIComponent(tx.id)}`,
        { headers: authHeaders(), credentials: "same-origin" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSelected(body.data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to inspect the journal.",
      );
    }
  }

  const accountOptions = useMemo(
    () =>
      payload.accounts.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} · {item.asset} · {amount(item.balanceMinor, item.asset)}
        </option>
      )),
    [payload.accounts],
  );
  return (
    <AdminLayout title="Financial Sandbox">
      <Helmet>
        <title>Financial Sandbox | City Gate Capital Admin</title>
      </Helmet>
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/[0.055] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#E8C96A] text-sm font-semibold">
                <Activity className="h-5 w-5" />
                SUPER ADMIN · SIMULATION
              </div>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Financial operations sandbox
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-white/45">
                Create synthetic accounts, rehearse internal and crypto
                transfers, and post controlled double-entry adjustments. No
                customer balance, provider, blockchain, private key or live
                market is accessed.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-xs text-emerald-200">
              <ShieldCheck className="mr-2 inline h-4 w-4" />
              Production locks preserved
            </div>
          </div>
          <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.055] p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/65">
              Every operation is marked <b>SIMULATION</b>, uses a{" "}
              <code>syn_</code> reference, and creates balanced journal lines
              plus an immutable administration audit event.
            </p>
          </div>
        </section>
        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Synthetic accounts",
              value: payload.overview.accounts,
              Icon: WalletCards,
              color: "#C9A84C",
            },
            {
              label: "Transactions",
              value: payload.overview.transactions,
              Icon: ArrowRightLeft,
              color: "#60A5FA",
            },
            {
              label: "Pending instructions",
              value: payload.overview.pending,
              Icon: Clock3,
              color: "#F59E0B",
            },
            {
              label: "Journal integrity breaks",
              value: payload.overview.integrityBreaks,
              Icon: ShieldCheck,
              color:
                payload.overview.integrityBreaks === 0 ? "#10B981" : "#EF4444",
            },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
            >
              <div className="flex items-center justify-between">
                <card.Icon className="h-4 w-4" style={{ color: card.color }} />
                <span className="text-2xl font-bold text-white">
                  {card.value}
                </span>
              </div>
              <p className="mt-3 text-xs text-white/40">{card.label}</p>
            </article>
          ))}
        </section>
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white">
                <BookOpen className="h-4 w-4 text-[#C9A84C]" />
                Banking skills map
              </h2>
              <p className="mt-1 text-xs text-white/35">
                All models are controlled from this super-administration panel.
                External datasets remain read-only until an application adapter
                is deliberately implemented.
              </p>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-white/25">
              {
                payload.capabilities.filter(
                  (item) => item.status === "implemented",
                ).length
              }{" "}
              IMPLEMENTED ·{" "}
              {
                payload.capabilities.filter(
                  (item) => item.status === "adapter_required",
                ).length
              }{" "}
              ADAPTERS REQUIRED
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {payload.capabilities.map((item) => (
              <article
                key={item.key}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background:
                        item.status === "implemented"
                          ? "rgba(16,185,129,.1)"
                          : "rgba(96,165,250,.1)",
                    }}
                  >
                    {item.status === "implemented" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <PlugZap className="h-4 w-4 text-sky-300" />
                    )}
                  </div>
                  <span className="rounded-full border border-white/[0.07] px-2 py-1 text-[9px] font-bold tracking-wider text-white/35">
                    {item.executionBoundary}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white/80">
                  {item.label}
                </h3>
                <p className="mt-1 text-[11px] leading-5 text-white/35">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white">
                <PlugZap className="h-4 w-4 text-[#C9A84C]" />
                Payment-rail instruction control
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-white/35">
                Rehearse ACH, wire, RTP/FedNow, deposit, withdrawal, scheduled,
                card and bill-pay lifecycles. These instructions never post a
                customer ledger or call a bank, network or payment provider.
              </p>
            </div>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-wider text-sky-300">
              PROVIDER ADAPTER DISCONNECTED
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={railForm.rail}
              onChange={(e) =>
                setRailForm({ ...railForm, rail: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            >
              {RAILS.map((rail) => (
                <option key={rail} value={rail}>
                  {rail.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              value={railForm.direction}
              onChange={(e) =>
                setRailForm({ ...railForm, direction: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            >
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
              <option value="internal">Internal</option>
            </select>
            <select
              value={railForm.asset}
              onChange={(e) =>
                setRailForm({ ...railForm, asset: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            >
              {ASSETS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <input
              value={railForm.amount}
              onChange={(e) =>
                setRailForm({ ...railForm, amount: e.target.value })
              }
              placeholder="Amount"
              inputMode="decimal"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            />
            <input
              value={railForm.sourceReference}
              onChange={(e) =>
                setRailForm({ ...railForm, sourceReference: e.target.value })
              }
              placeholder="syn_source_reference"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-white"
            />
            <input
              value={railForm.destinationReference}
              onChange={(e) =>
                setRailForm({
                  ...railForm,
                  destinationReference: e.target.value,
                })
              }
              placeholder="syn_destination_reference"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-white"
            />
            <input
              value={railForm.memo}
              onChange={(e) =>
                setRailForm({ ...railForm, memo: e.target.value })
              }
              placeholder="Instruction memo"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            />
            <input
              type="datetime-local"
              value={railForm.scheduledFor}
              onChange={(e) =>
                setRailForm({ ...railForm, scheduledFor: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            />
            {railForm.rail === "recurring_payment" && (
              <select
                value={railForm.recurrence}
                onChange={(e) =>
                  setRailForm({ ...railForm, recurrence: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              >
                <option value="">Recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>
          <button
            disabled={
              busy || !railForm.amount || railForm.memo.trim().length < 3
            }
            onClick={() => void createRailInstruction()}
            className="mt-3 rounded-lg bg-gradient-to-r from-[#C9A84C] to-[#F0D080] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Create simulated instruction
          </button>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="text-white/30">
                <tr>
                  <th className="p-3">Reference</th>
                  <th>Rail</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>Lifecycle control</th>
                </tr>
              </thead>
              <tbody>
                {payload.railInstructions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/25">
                      No simulated rail instructions yet.
                    </td>
                  </tr>
                ) : (
                  payload.railInstructions.map((instruction) => {
                    const allowed = RAIL_TRANSITIONS[instruction.status] ?? [];
                    const transition = railTransition[instruction.id] ?? {
                      toStatus: allowed[0] ?? "",
                      reason: "",
                    };
                    return (
                      <tr
                        key={instruction.id}
                        className="border-t border-white/[0.05] text-white/60"
                      >
                        <td className="p-3">
                          <p className="font-mono text-[#D8BC68]">
                            {instruction.reference}
                          </p>
                          <p className="mt-1 text-[9px] text-white/25">
                            {instruction.memo}
                          </p>
                        </td>
                        <td className="uppercase">
                          {instruction.rail.replaceAll("_", " ")}
                          <p className="mt-1 text-[9px] text-sky-300/60">
                            {instruction.providerAdapterState}
                          </p>
                        </td>
                        <td>
                          {amount(instruction.amountMinor, instruction.asset)}
                          <p className="mt-1 text-[9px] uppercase text-white/25">
                            {instruction.direction}
                          </p>
                        </td>
                        <td className="uppercase text-[10px]">
                          {instruction.status}
                        </td>
                        <td className="text-[10px]">
                          {instruction.scheduledFor
                            ? new Date(
                                instruction.scheduledFor,
                              ).toLocaleString()
                            : "Immediate review"}
                          {instruction.recurrence
                            ? ` · ${instruction.recurrence}`
                            : ""}
                        </td>
                        <td className="py-2">
                          {allowed.length > 0 ? (
                            <div className="grid min-w-[310px] grid-cols-[110px_1fr_auto] gap-2">
                              <select
                                value={transition.toStatus}
                                onChange={(e) =>
                                  setRailTransition((value) => ({
                                    ...value,
                                    [instruction.id]: {
                                      ...transition,
                                      toStatus: e.target.value,
                                    },
                                  }))
                                }
                                className="rounded-lg border border-white/10 bg-black/30 px-2 text-[10px] text-white"
                              >
                                {allowed.map((value) => (
                                  <option key={value}>{value}</option>
                                ))}
                              </select>
                              <input
                                value={transition.reason}
                                onChange={(e) =>
                                  setRailTransition((value) => ({
                                    ...value,
                                    [instruction.id]: {
                                      ...transition,
                                      reason: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Transition reason"
                                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white"
                              />
                              <button
                                disabled={
                                  busy || transition.reason.trim().length < 3
                                }
                                onClick={() =>
                                  void transitionRailInstruction(instruction)
                                }
                                className="rounded-lg border border-[#C9A84C]/25 px-2.5 text-[10px] font-bold text-[#E8C96A] disabled:opacity-30"
                              >
                                Apply
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-white/20">
                              Terminal state
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Plus className="h-4 w-4 text-[#C9A84C]" />
              Synthetic account
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                value={accountForm.name}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, name: e.target.value })
                }
                placeholder="Account label"
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"
              />
              <select
                value={accountForm.type}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, type: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              >
                {ACCOUNT_TYPES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <select
                value={accountForm.asset}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, asset: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              >
                {ASSETS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <button
              disabled={busy}
              onClick={() => void createAccount()}
              className="mt-3 rounded-lg bg-gradient-to-r from-[#C9A84C] to-[#F0D080] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              Create synthetic account
            </button>
          </section>
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <ArrowRightLeft className="h-4 w-4 text-[#C9A84C]" />
              Controlled operation
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                value={operation.action}
                onChange={(e) =>
                  setOperation({ ...operation, action: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              >
                <option value="transfer">Internal transfer</option>
                <option value="crypto_transfer">Crypto transfer</option>
                <option value="mock_transaction">
                  Pending mock transaction
                </option>
                <option value="adjust">Ledger adjustment</option>
              </select>
              {operation.action === "adjust" ? (
                <select
                  value={operation.direction}
                  onChange={(e) =>
                    setOperation({ ...operation, direction: e.target.value })
                  }
                  className="rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
                >
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
              ) : null}
              <select
                value={
                  operation.action === "adjust"
                    ? operation.accountId
                    : operation.sourceAccountId
                }
                onChange={(e) =>
                  setOperation(
                    operation.action === "adjust"
                      ? { ...operation, accountId: e.target.value }
                      : { ...operation, sourceAccountId: e.target.value },
                  )
                }
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              >
                <option value="">
                  {operation.action === "adjust"
                    ? "Select account"
                    : "Source account"}
                </option>
                {accountOptions}
              </select>
              {operation.action !== "adjust" && (
                <select
                  value={operation.destinationAccountId}
                  onChange={(e) =>
                    setOperation({
                      ...operation,
                      destinationAccountId: e.target.value,
                    })
                  }
                  className="rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
                >
                  <option value="">Destination account</option>
                  {accountOptions}
                </select>
              )}
              <input
                value={operation.amount}
                onChange={(e) =>
                  setOperation({ ...operation, amount: e.target.value })
                }
                placeholder="Amount"
                inputMode="decimal"
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              />
              <input
                value={operation.reason}
                onChange={(e) =>
                  setOperation({ ...operation, reason: e.target.value })
                }
                placeholder="Required reason"
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              />
              {operation.action === "adjust" && (
                <>
                  <input
                    value={operation.reference}
                    onChange={(e) =>
                      setOperation({ ...operation, reference: e.target.value })
                    }
                    placeholder="Adjustment reference"
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
                  />
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={operation.confirmed}
                      onChange={(e) =>
                        setOperation({
                          ...operation,
                          confirmed: e.target.checked,
                        })
                      }
                    />
                    I confirm this synthetic adjustment
                  </label>
                </>
              )}
            </div>
            <button
              disabled={busy}
              onClick={() => void runOperation()}
              className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : operation.action === "crypto_transfer" ? (
                <Bitcoin className="h-4 w-4" />
              ) : (
                <WalletCards className="h-4 w-4" />
              )}
              Run simulation
            </button>
          </section>
        </div>
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-white">Simulation journal</h2>
              <p className="mt-1 text-xs text-white/30">
                {payload.overview.journalEntries} immutable journal entries ·{" "}
                {payload.overview.completed} completed ·{" "}
                {payload.overview.reversed} reversed ·{" "}
                {payload.overview.cancelled} cancelled
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center rounded-lg border border-white/10 bg-black/25 px-2">
                <Search className="h-4 w-4 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Reference or reason"
                  className="w-44 bg-transparent px-2 py-2 text-xs text-white outline-none"
                />
              </div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white"
              >
                <option value="">All statuses</option>
                {[
                  "completed",
                  "reversed",
                  "cancelled",
                  "pending",
                  "processing",
                  "failed",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white"
              >
                <option value="">All assets</option>
                {ASSETS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <button
                onClick={() => void load()}
                className="rounded-lg border border-white/10 p-2 text-white/50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-white/30" />
            </div>
          ) : payload.data.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/30">
              No synthetic transactions yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-white/30">
                  <tr>
                    <th className="p-3">Reference</th>
                    <th>Operation</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.data.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => void inspect(tx)}
                      className="cursor-pointer border-t border-white/[0.05] text-white/65 hover:bg-white/[0.025]"
                    >
                      <td className="p-3 font-mono text-[#D8BC68]">
                        {tx.reference}
                      </td>
                      <td>{tx.kind.replaceAll("_", " ")}</td>
                      <td>{amount(tx.amountMinor, tx.asset)}</td>
                      <td>{tx.status}</td>
                      <td>{new Date(tx.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-white/35">
            <span>{payload.total} records</span>
            <div className="flex gap-2">
              <button
                disabled={payload.page <= 1}
                onClick={() => void load(payload.page - 1)}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={payload.page * payload.pageSize >= payload.total}
                onClick={() => void load(payload.page + 1)}
                className="rounded border border-white/10 px-2 py-1 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </section>
        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setSelected(null)}
          >
            <article
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#C9A84C]/20 bg-[#0A0A0A] p-6"
            >
              <p className="text-xs font-bold tracking-widest text-[#C9A84C]">
                SIMULATION DETAIL
              </p>
              <h3 className="mt-2 font-mono text-lg text-white">
                {selected.reference}
              </h3>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <dt className="text-white/35">Operation</dt>
                <dd className="text-white">{selected.kind}</dd>
                <dt className="text-white/35">Amount</dt>
                <dd className="text-white">
                  {amount(selected.amountMinor, selected.asset)}
                </dd>
                <dt className="text-white/35">Status</dt>
                <dd className="text-white">{selected.status}</dd>
                <dt className="text-white/35">Reason</dt>
                <dd className="text-white">{selected.reason}</dd>
              </dl>
              {selected.lines && selected.lines.length > 0 && (
                <section className="mt-6 rounded-xl border border-white/[0.07] bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-xs font-semibold text-white/75">
                      <Database className="h-4 w-4 text-[#C9A84C]" />
                      Double-entry journal
                    </h4>
                    <span className="text-[10px] font-bold text-emerald-300">
                      DEBITS = CREDITS
                    </span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-white/25">
                        <tr>
                          <th className="py-2">Account</th>
                          <th>Debit</th>
                          <th>Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.lines.map((line, index) => (
                          <tr
                            key={`${line.accountId}-${index}`}
                            className="border-t border-white/[0.05]"
                          >
                            <td className="py-2 pr-3 font-mono text-white/55">
                              {line.accountId}
                            </td>
                            <td className="text-white/70">
                              {BigInt(line.debitMinor) > 0n
                                ? amount(line.debitMinor, line.asset)
                                : "—"}
                            </td>
                            <td className="text-white/70">
                              {BigInt(line.creditMinor) > 0n
                                ? amount(line.creditMinor, line.asset)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {selected.status === "completed" && (
                  <button
                    disabled={busy}
                    onClick={() => void reverse(selected)}
                    className="flex items-center gap-2 rounded-lg border border-amber-400/20 px-3 py-2 text-xs text-amber-200"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Controlled reversal
                  </button>
                )}
                {["pending", "processing"].includes(selected.status) && (
                  <button
                    disabled={busy}
                    onClick={() => void cancel(selected)}
                    className="flex items-center gap-2 rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-200"
                  >
                    <Ban className="h-4 w-4" />
                    Cancel mock transaction
                  </button>
                )}
              </div>
            </article>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
