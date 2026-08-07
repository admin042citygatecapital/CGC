/**
 * AriaChatWidget — Floating AI Banking Assistant
 * Available on all public pages and the customer dashboard.
 * Streams responses from POST /api/chat.
 */
import {
Bot,
Loader2,
Maximize2,
MessageCircle,
Minimize2,
RefreshCw,
Send,
User,
X
} from 'lucide-react';
import { AnimatePresence,motion } from 'motion/react';
import { useEffect,useRef,useState,type FormEvent,type KeyboardEvent } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'How do I send money internationally?',
  'How does the trading module work?',
  'How do I freeze my virtual card?',
  'What documents do I need for KYC?',
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-amber-400/60"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? 'bg-amber-400/20' : 'bg-[#1a1a2e] border border-amber-400/30'
      }`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-amber-400" />
          : <Bot className="w-3.5 h-3.5 text-amber-400" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-amber-400/15 text-white rounded-tr-sm'
          : 'bg-white/8 text-white/90 rounded-tl-sm'
      }`}>
        {msg.content ? (
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        ) : (
          <TypingDots />
        )}
      </div>
    </motion.div>
  );
}

export default function AriaChatWidget() {
  const [open, setOpen]           = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [unread, setUnread]       = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: "Hello! I'm Aria, your City Gate Capital banking assistant. I can help you with transfers, trading, cards, account management, and more.\n\nHow can I assist you today?",
      }]);
    }
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const assistantId = `a-${Date.now()}`;

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
        );
      }

      if (!open) setUnread(n => n + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setError(null);
    setTimeout(() => {
      setMessages([{
        id: 'greeting-reset',
        role: 'assistant',
        content: "Conversation cleared. How can I help you?",
      }]);
    }, 100);
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center group"
            style={{
              background: 'linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #B8960C 100%)',
              boxShadow: '0 8px 32px rgba(201,168,76,0.4)',
            }}
            aria-label="Open Aria AI Assistant"
          >
            <MessageCircle className="w-6 h-6 text-black" />
            {unread > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
              >
                {unread}
              </motion.div>
            )}
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-amber-400/40"
              animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{
              height: minimised ? 'auto' : '520px',
              maxHeight: 'calc(100vh - 48px)',
              background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%)',
              border: '1px solid rgba(201,168,76,0.2)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8 shrink-0"
              style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.08) 0%, transparent 100%)' }}>
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #C9A84C20, #D4AF3730)' }}>
                  <Bot className="w-5 h-5 text-amber-400" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0f0f1a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Aria</div>
                <div className="text-xs text-white/40">City Gate Capital Assistant</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-white/30 hover:text-white/60"
                  title="Clear conversation"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMinimised(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-white/30 hover:text-white/60"
                >
                  {minimised ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/8 transition-colors text-white/30 hover:text-white/60"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!minimised && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
                  {messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}

                  {/* Suggested questions (only when no user messages yet) */}
                  {messages.length === 1 && messages[0].role === 'assistant' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-2"
                    >
                      <div className="text-xs text-white/30 px-1">Suggested questions</div>
                      {SUGGESTED_QUESTIONS.map(q => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="w-full text-left text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 transition-all border border-white/8 hover:border-amber-400/20"
                        >
                          {q}
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-xl bg-red-400/10 border border-red-400/20 px-3 py-2 text-xs text-red-300"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-3 pb-3 pt-2 border-t border-white/8 shrink-0">
                  <form onSubmit={handleSubmit} className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Aria anything…"
                      rows={1}
                      disabled={loading}
                      className="flex-1 resize-none bg-white/8 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-400/40 transition-colors disabled:opacity-50 leading-relaxed"
                      style={{ maxHeight: '100px', minHeight: '40px' }}
                      onInput={e => {
                        const t = e.currentTarget;
                        t.style.height = 'auto';
                        t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
                      style={{
                        background: input.trim() && !loading
                          ? 'linear-gradient(135deg, #C9A84C, #D4AF37)'
                          : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {loading
                        ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                        : <Send className="w-4 h-4 text-black" />
                      }
                    </button>
                  </form>
                  <div className="text-center mt-2">
                    <span className="text-xs text-white/15">Powered by City Gate Capital AI · Never share passwords</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
