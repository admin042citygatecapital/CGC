import { Helmet } from "@dr.pogodin/react-helmet";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";

interface SupportMessage {
  id: string;
  from: "customer" | "admin";
  text: string;
  ts: string;
  adminName?: string;
}

interface Conversation {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "pending" | "in_progress" | "resolved" | "closed";
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "Account Access",
  "Identity Verification",
  "Transfer Workspace",
  "Card Workspace",
  "Trading Workspace",
  "Technical Support",
  "General",
] as const;

const STATUS_STYLE: Record<Conversation["status"], string> = {
  open: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300",
  in_progress: "bg-blue-500/15 text-blue-300",
  resolved: "bg-white/10 text-white/50",
  closed: "bg-white/5 text-white/35",
};

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "The request could not be completed.";
  } catch {
    return "The request could not be completed.";
  }
}

export default function DashboardSupportPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("General");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [message, setMessage] = useState("");

  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? conversations.filter((item) =>
          `${item.subject} ${item.category} ${item.status}`
            .toLowerCase()
            .includes(query),
        )
      : conversations;
  }, [conversations, search]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/users/support", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = (await response.json()) as {
        conversations?: Conversation[];
      };
      setConversations(body.conversations ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Support tickets could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/users/support", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          message: message.trim(),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = (await response.json()) as { conversation: Conversation };
      setConversations((items) => [body.conversation, ...items]);
      setSelectedId(body.conversation.id);
      setShowNew(false);
      setSubject("");
      setMessage("");
      setCategory("General");
      setPriority("medium");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The ticket could not be created.",
      );
    } finally {
      setSending(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/users/support", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selected.id,
          message: reply.trim(),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = (await response.json()) as { conversation: Conversation };
      setConversations((items) =>
        items.map((item) =>
          item.id === body.conversation.id ? body.conversation : item,
        ),
      );
      setReply("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The reply could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Customer Support — City Gate Capital</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen bg-[#07090d] px-4 pb-16 pt-24 text-white md:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
          >
            <ArrowLeft size={15} /> Back to dashboard
          </Link>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary">
                Customer care
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Support centre</h1>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNew(true);
                setSelectedId(null);
                setError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-black hover:brightness-110"
            >
              <Plus size={16} /> New ticket
            </button>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[350px_1fr]">
            <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              <div className="border-b border-white/[0.06] p-3">
                <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3">
                  <Search size={14} className="text-white/30" />
                  <span className="sr-only">Search tickets</span>
                <input
                  name="ticketSearch"
                  autoComplete="off"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tickets"
                    className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-white/25"
                  />
                </label>
              </div>
              <div className="max-h-[620px] divide-y divide-white/[0.05] overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center p-10">
                    <Loader2 className="animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="p-8 text-center text-sm text-white/35">
                    No matching support tickets.
                  </p>
                ) : (
                  filtered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setShowNew(false);
                        setError("");
                      }}
                      className={`w-full px-4 py-4 text-left transition hover:bg-white/[0.035] ${selectedId === item.id ? "border-l-2 border-primary bg-white/[0.045]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium">
                          {item.subject}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLE[item.status]}`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-[11px] text-white/30">
                        <span>{item.category}</span>
                        <time>
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </time>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
            <section className="min-h-[430px] rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              {showNew ? (
                <form onSubmit={createTicket} className="space-y-4 p-5 md:p-7">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Open a support ticket</h2>
                    <button
                      type="button"
                      aria-label="Close new ticket form"
                      onClick={() => setShowNew(false)}
                      className="text-white/40 hover:text-white"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <label className="block text-xs text-white/50">
                    Subject
                    <input
                      name="subject"
                      required
                      maxLength={200}
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs text-white/50">
                      Category
                      <select
                        name="category"
                        value={category}
                        onChange={(event) =>
                          setCategory(event.target.value as typeof category)
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#0d1016] px-4 py-3 text-sm text-white outline-none"
                      >
                        {CATEGORIES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-white/50">
                      Priority
                      <select
                        name="priority"
                        value={priority}
                        onChange={(event) =>
                          setPriority(event.target.value as typeof priority)
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#0d1016] px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                  </div>
                  <label className="block text-xs text-white/50">
                    Message
                    <textarea
                      name="message"
                      required
                      maxLength={5000}
                      rows={8}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                    />
                  </label>
                  <button
                    disabled={sending || !subject.trim() || !message.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {sending && <Loader2 size={15} className="animate-spin" />}{" "}
                    Submit ticket
                  </button>
                </form>
              ) : selected ? (
                <div className="flex h-full min-h-[620px] flex-col">
                  <header className="border-b border-white/[0.06] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-semibold">{selected.subject}</h2>
                        <p className="mt-1 text-xs text-white/35">
                          {selected.category} · {selected.priority} priority
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] ${STATUS_STYLE[selected.status]}`}
                      >
                        {selected.status.replace("_", " ")}
                      </span>
                    </div>
                  </header>
                  <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {selected.messages.map((item) => (
                      <div
                        key={item.id}
                        className={`flex ${item.from === "customer" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${item.from === "customer" ? "rounded-br-sm bg-primary text-black" : "rounded-bl-sm bg-white/[0.07] text-white/85"}`}
                        >
                          {item.from === "admin" && (
                            <p className="mb-1 text-[10px] font-semibold opacity-60">
                              {item.adminName || "City Gate Support"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {item.text}
                          </p>
                          <time className="mt-1.5 block text-[10px] opacity-45">
                            {new Date(item.ts).toLocaleString()}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selected.status !== "closed" && (
                    <form
                      onSubmit={sendReply}
                      className="flex gap-2 border-t border-white/[0.06] p-4"
                    >
                      <label className="sr-only" htmlFor="support-reply">
                        Reply
                      </label>
                    <input
                      id="support-reply"
                      name="reply"
                        required
                        maxLength={5000}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Write a reply"
                        className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm outline-none focus:border-primary/50"
                      />
                      <button
                        aria-label="Send reply"
                        disabled={sending || !reply.trim()}
                        className="rounded-xl bg-primary px-4 text-black disabled:opacity-50"
                      >
                        {sending ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <Send size={17} />
                        )}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="flex min-h-[430px] items-center justify-center p-8 text-center">
                  <div>
                    <MessageCircle
                      size={38}
                      className="mx-auto mb-3 text-white/15"
                    />
                    <p className="text-sm text-white/35">
                      Select a ticket or open a new one.
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
