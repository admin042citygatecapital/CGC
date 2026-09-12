/**
 * AriaChatPanel — customer-facing UI for the Aria support assistant.
 *
 * Talks to POST /api/chat, which streams raw text (plain ReadableStream, no
 * protocol). Conversation history is held client-side and resent each turn;
 * the server enforces its own budgets (24 messages, 4,000 chars each, 1,000
 * output tokens, 60s stream timeout).
 *
 * Mounted once from App.tsx inside ClientOnly, mirroring TawkWidget — it
 * survives navigation and is positioned bottom-left so it never overlaps the
 * Tawk launcher in the bottom-right corner.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGE_LENGTH = 4_000; // keep in sync with the server's budget
const WELCOME_MESSAGE =
  "Hi, I'm Aria — the City Gate Capital platform assistant. Ask me about the dashboard, security, or what's available on the platform.";

type PanelState = 'closed' | 'open';

export default function AriaChatPanel() {
  const [panel, setPanel] = useState<PanelState>('closed');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (panel === 'open') inputRef.current?.focus();
  }, [panel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(`Messages are limited to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`);
      return;
    }

    setError(null);
    setDraft('');
    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages([...history, { role: 'assistant' as const, content: '' }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let reason = 'The assistant is unavailable right now. Please try again later.';
        try {
          const body = (await response.json()) as { error?: unknown };
          if (typeof body?.error === 'string' && body.error) reason = body.error;
        } catch {
          // non-JSON error body — keep the generic message
        }
        throw new Error(reason);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamed = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        streamed += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: streamed }]);
      }

      // Server validated the history — adopt it as the conversation state.
      setMessages(streamed
        ? [...history, { role: 'assistant', content: streamed }]
        : history);
    } catch (err) {
      if (controller.signal.aborted) {
        // User closed the panel or aborted — drop the partial turn quietly.
        setMessages(history);
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setMessages(history);
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [draft, messages, streaming]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setPanel('closed');
    setError(null);
  }, []);

  if (panel === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setPanel('open')}
        aria-label="Ask Aria, the platform assistant"
        className="fixed bottom-5 left-4 z-[9998] flex items-center gap-3 rounded-full border-2 border-[#E6C76A]/55 bg-[#050505] py-3 pl-3 pr-5 shadow-[0_18px_55px_rgba(0,0,0,0.65),0_0_34px_rgba(201,168,76,0.30)] transition duration-300 hover:-translate-y-1 hover:border-[#F0D080] hover:shadow-[0_22px_65px_rgba(0,0,0,0.72),0_0_42px_rgba(201,168,76,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0D080] focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:bottom-7 sm:left-7"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1B160B] to-black text-lg text-[#E6C76A]"
        >
          ✦
        </span>
        <span className="text-left">
          <span className="block text-sm font-semibold text-white">Ask Aria</span>
          <span className="block text-xs text-[#E6C76A]/80">Platform assistant</span>
        </span>
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-label="Aria, the City Gate Capital platform assistant"
      className="fixed bottom-5 left-4 z-[9998] flex h-[30rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[#E6C76A]/35 bg-[#050505] shadow-[0_24px_70px_rgba(0,0,0,0.75)] sm:bottom-7 sm:left-7"
    >
      <header className="flex items-center justify-between border-b border-[#E6C76A]/20 bg-gradient-to-r from-[#0B0904] to-[#050505] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Aria <span aria-hidden="true" className="text-[#E6C76A]">✦</span>
          </p>
          <p className="text-xs text-[#E6C76A]/80">City Gate Capital platform assistant</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close assistant"
          className="rounded-md px-2 py-1 text-[#E6C76A]/70 transition hover:bg-[#E6C76A]/10 hover:text-[#E6C76A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0D080]"
        >
          ✕
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="rounded-lg bg-[#E6C76A]/5 px-3 py-2 text-sm text-[#E9DFC7]">
            {WELCOME_MESSAGE}
          </p>
        )}
        {messages.map((message, index) => (
          <p
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#E6C76A] px-3 py-2 text-sm text-black'
                : 'mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[#161310] px-3 py-2 text-sm text-[#EDE6D6]'
            }
          >
            {message.content || (streaming ? '…' : '')}
          </p>
        ))}
        {error && (
          <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-[#E6C76A]/20 px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Ask about the platform…"
          aria-label="Message the platform assistant"
          className="max-h-24 flex-1 resize-none rounded-xl border border-[#E6C76A]/25 bg-[#0B0904] px-3 py-2 text-sm text-white placeholder:text-[#8B8474] focus:border-[#E6C76A]/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={streaming || draft.trim().length === 0}
          className="rounded-xl bg-[#E6C76A] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#F0D080] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {streaming ? '…' : 'Send'}
        </button>
      </form>

      <p className="px-4 pb-2 text-[11px] leading-tight text-[#8B8477]">
        Never share passwords, authentication codes, card details, or recovery keys.
      </p>
    </aside>
  );
}