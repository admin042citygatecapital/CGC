import { Helmet } from "@dr.pogodin/react-helmet";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileWarning,
  Loader2,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";

interface Transaction {
  id: string;
  reference: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}
interface TimelineItem {
  action: string;
  status: string;
  createdAt: string;
}
interface CustomerDispute {
  id: string;
  reference: string;
  category: string;
  status: string;
  priority: string;
  transactionId?: string;
  summary: string;
  customerClaim: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  timeline: TimelineItem[];
  notifications: Array<{
    id: string;
    subject: string;
    message: string;
    createdAt: string;
  }>;
}

const CATEGORIES = [
  { value: "duplicate", label: "Duplicate transaction" },
  { value: "cash_not_received", label: "Cash or funds not received" },
  { value: "incorrect_amount", label: "Incorrect amount" },
  { value: "unauthorised", label: "I do not recognise this transaction" },
  { value: "service_not_received", label: "Service or purchase not received" },
  { value: "other", label: "Another transaction problem" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  open: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  investigating: "border-blue-400/20 bg-blue-400/10 text-blue-200",
  escalated: "border-orange-400/20 bg-orange-400/10 text-orange-200",
  remediation_pending: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  resolved: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  rejected: "border-red-400/20 bg-red-400/10 text-red-200",
  closed: "border-white/10 bg-white/5 text-white/45",
};
const readable = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const money = (tx: Transaction) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: tx.currency,
    maximumFractionDigits:
      tx.currency === "BTC" || tx.currency === "ETH" ? 6 : 2,
  }).format(tx.amount);
const newKey = () => `dispute:${crypto.randomUUID()}`;

async function errorMessage(response: Response) {
  try {
    return (
      ((await response.json()) as { error?: string }).error ??
      "The request could not be completed."
    );
  } catch {
    return "The request could not be completed.";
  }
}

export default function CustomerDisputesPage() {
  const [cases, setCases] = useState<CustomerDispute[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [category, setCategory] = useState("duplicate");
  const [claim, setClaim] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const selected = cases.find((item) => item.id === selectedId) ?? null;
  const transactionMap = useMemo(
    () => new Map(transactions.map((item) => [item.id, item])),
    [transactions],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [casesResponse, transactionsResponse] = await Promise.all([
        fetch("/api/users/disputes", { credentials: "same-origin" }),
        fetch("/api/users/transactions?limit=100", {
          credentials: "same-origin",
        }),
      ]);
      if (!casesResponse.ok) throw new Error(await errorMessage(casesResponse));
      if (!transactionsResponse.ok)
        throw new Error(await errorMessage(transactionsResponse));
      const casesBody = (await casesResponse.json()) as {
        cases?: CustomerDispute[];
      };
      const txBody = (await transactionsResponse.json()) as {
        transactions?: Transaction[];
      };
      setCases(casesBody.cases ?? []);
      setTransactions(txBody.transactions ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your dispute workspace could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function openForm() {
    setShowForm(true);
    setSelectedId(null);
    setConfirmation("");
    setError("");
    if (!transactionId && transactions[0]) setTransactionId(transactions[0].id);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setConfirmation("");
    try {
      const response = await fetch("/api/users/disputes", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ transactionId, category, claim: claim.trim() }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const body = (await response.json()) as { case: CustomerDispute };
      setCases((items) => [
        body.case,
        ...items.filter((item) => item.id !== body.case.id),
      ]);
      setSelectedId(body.case.id);
      setShowForm(false);
      setClaim("");
      setIdempotencyKey(newKey());
      setConfirmation(
        `Your dispute has been submitted. Reference: ${body.case.reference}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your dispute could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Transaction disputes — City Gate Capital</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <main className="min-h-screen bg-[#07090d] px-4 pb-16 pt-24 text-white md:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
          >
            <ArrowLeft size={15} /> Back to dashboard
          </Link>
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary">
                Account protection
              </p>
              <h1 className="mt-1 text-2xl font-semibold">
                Transaction disputes
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                Report a problem with one of your transactions and follow the
                investigation from submission to decision.
              </p>
            </div>
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-black hover:brightness-110"
            >
              <Plus size={16} /> Report a transaction
            </button>
          </header>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <ShieldCheck className="mb-3 text-primary" size={20} />
              <p className="text-sm font-medium">Secure ownership checks</p>
              <p className="mt-1 text-xs leading-5 text-white/35">
                Only transactions belonging to your signed-in profile can be
                selected.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <Clock3 className="mb-3 text-blue-300" size={20} />
              <p className="text-sm font-medium">Track every stage</p>
              <p className="mt-1 text-xs leading-5 text-white/35">
                Your reference and status timeline remain available here.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <FileWarning className="mb-3 text-amber-300" size={20} />
              <p className="text-sm font-medium">Controlled resolution</p>
              <p className="mt-1 text-xs leading-5 text-white/35">
                Any financial correction requires investigation and independent
                approval.
              </p>
            </div>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </div>
          )}
          {confirmation && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
            >
              <CheckCircle2 size={17} />
              {confirmation}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              <div className="border-b border-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/35">
                Your cases
              </div>
              <div className="max-h-[650px] divide-y divide-white/[0.05] overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center p-10">
                    <Loader2 className="animate-spin text-primary" />
                  </div>
                ) : cases.length === 0 ? (
                  <div className="p-9 text-center">
                    <FileWarning className="mx-auto mb-3 text-white/15" />
                    <p className="text-sm text-white/40">
                      You have not submitted a dispute.
                    </p>
                  </div>
                ) : (
                  cases.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setShowForm(false);
                        setError("");
                      }}
                      className={`w-full px-4 py-4 text-left transition hover:bg-white/[0.035] ${selectedId === item.id ? "border-l-2 border-primary bg-white/[0.045]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-mono text-sm font-semibold text-white/85">
                          {item.reference}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLE[item.status] ?? STATUS_STYLE.closed}`}
                        >
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-white/45">
                        {CATEGORIES.find(
                          (category) => category.value === item.category,
                        )?.label ?? item.category}
                      </p>
                      <time className="mt-2 block text-[10px] text-white/25">
                        Updated {readable(item.updatedAt)}
                      </time>
                    </button>
                  ))
                )}
              </div>
            </section>
            <section className="min-h-[500px] rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              {showForm ? (
                <form onSubmit={submit} className="space-y-5 p-5 md:p-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Report a transaction</h2>
                      <p className="mt-1 text-xs text-white/35">
                        Give us enough detail to begin an investigation.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close form"
                      onClick={() => setShowForm(false)}
                      className="text-white/35 hover:text-white"
                    >
                      <X size={19} />
                    </button>
                  </div>
                  {transactions.length === 0 ? (
                    <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-sm text-amber-100/75">
                      There are no eligible transactions on this profile.
                    </div>
                  ) : (
                    <>
                      <label className="block text-xs text-white/50">
                        Transaction
                  <select
                    name="transactionId"
                    required
                          value={transactionId}
                          onChange={(event) =>
                            setTransactionId(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#0d1016] px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                        >
                          <option value="">Select a transaction</option>
                          {transactions.map((tx) => (
                            <option key={tx.id} value={tx.id}>
                              {tx.reference} · {money(tx)} ·{" "}
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs text-white/50">
                        What went wrong?
                  <select
                    name="category"
                    required
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#0d1016] px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                        >
                          {CATEGORIES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs text-white/50">
                        Tell us what happened
                  <textarea
                    name="claim"
                    required
                          minLength={20}
                          maxLength={2000}
                          rows={8}
                          value={claim}
                          onChange={(event) => setClaim(event.target.value)}
                          placeholder="Include relevant dates and explain why you believe the transaction is incorrect."
                          className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/20 focus:border-primary/50"
                        />
                        <span className="mt-1 block text-right text-[10px] text-white/25">
                          {claim.length}/2000
                        </span>
                      </label>
                      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-xs leading-5 text-white/40">
                        <AlertTriangle
                          className="mb-2 text-amber-300"
                          size={16}
                        />
                        Submitting a dispute does not automatically reverse a
                        transaction. The operations team will investigate and
                        record any approved correction through the controlled
                        ledger workflow.
                      </div>
                      <button
                        disabled={
                          submitting ||
                          !transactionId ||
                          claim.trim().length < 20
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                      >
                        {submitting && (
                          <Loader2 size={15} className="animate-spin" />
                        )}{" "}
                        Submit dispute
                      </button>
                    </>
                  )}
                </form>
              ) : selected ? (
                <div className="p-5 md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
                    <div>
                      <p className="font-mono text-lg font-semibold">
                        {selected.reference}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        Submitted {readable(selected.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${STATUS_STYLE[selected.status] ?? STATUS_STYLE.closed}`}
                    >
                      {selected.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {selected.transactionId &&
                    transactionMap.get(selected.transactionId) && (
                      <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-white/30">
                          Transaction
                        </p>
                        <div className="mt-2 flex flex-wrap justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm">
                              {
                                transactionMap.get(selected.transactionId)!
                                  .reference
                              }
                            </p>
                            <p className="mt-1 text-xs text-white/35">
                              {
                                transactionMap.get(selected.transactionId)!
                                  .description
                              }
                            </p>
                          </div>
                          <p className="font-semibold text-primary">
                            {money(transactionMap.get(selected.transactionId)!)}
                          </p>
                        </div>
                      </div>
                    )}
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
                      Your report
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
                      {selected.customerClaim}
                    </p>
                  </div>
                  <div className="mt-7">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
                      Case timeline
                    </p>
                    <div className="mt-4 space-y-0">
                      {selected.timeline.map((item, index) => (
                        <div
                          key={`${item.action}-${item.createdAt}`}
                          className="relative flex gap-3 pb-6 last:pb-0"
                        >
                          <div className="relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 border-[#07090d] bg-primary ring-1 ring-primary/50" />
                          {index < selected.timeline.length - 1 && (
                            <div className="absolute left-[5px] top-3 h-full w-px bg-white/10" />
                          )}
                          <div>
                            <p className="text-sm capitalize text-white/70">
                              {item.action.replaceAll("_", " ")}
                            </p>
                            <p className="mt-1 text-[11px] text-white/30">
                              {readable(item.createdAt)} ·{" "}
                              {item.status.replaceAll("_", " ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selected.notifications.map((note) => (
                    <div
                      key={note.id}
                      className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-4"
                    >
                      <p className="text-sm font-medium text-primary">
                        {note.subject}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/45">
                        {note.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[500px] items-center justify-center p-8 text-center">
                  <div>
                    <FileWarning
                      size={40}
                      className="mx-auto mb-3 text-white/15"
                    />
                    <p className="text-sm text-white/35">
                      Select a case or report a transaction.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
