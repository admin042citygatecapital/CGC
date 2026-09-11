/**
 * Chat API Route — Streaming Chatbot / Agent
 *
 * Handles POST /api/chat
 * Streams raw text responses from the configured AI provider using the Vercel AI SDK.
 *
 * The client reads this as a plain ReadableStream<string> — no special protocol needed.
 *
 * Input budgets (in addition to the global /api rate limit applied in entry.ts):
 *  - At most MAX_MESSAGES conversation turns, each at most MAX_MESSAGE_LENGTH
 *    characters, so a client cannot grow the provider bill by resending an
 *    unbounded history.
 *  - Output capped at MAX_OUTPUT_TOKENS per response.
 *  - A hard stream timeout: the provider call is aborted when the response
 *    closes or after STREAM_TIMEOUT_MS, whichever comes first.
 *
 * For AGENT MODE: Uncomment the two import lines at the top and the
 * tools/maxSteps block inside streamText() below, then implement your tools.
 *
 * See src/lib/chatbot/chat-config.ts to configure the provider and model.
 */

import type { Request, Response } from 'express';
import { streamText } from 'ai';
// import { tool } from 'ai';   // ← Uncomment for agent mode
// import { z } from 'zod';     // ← Uncomment for agent mode
import { getChatModel, getSystemPrompt } from '@/lib/chatbot/chat-config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_OUTPUT_TOKENS = 1_000;
const STREAM_TIMEOUT_MS = 60_000;

export default async function handler(req: Request, res: Response) {
  const messages = req.body?.messages as unknown;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Missing or invalid messages array' });
    return;
  }
  if (messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: `Conversation history is limited to ${MAX_MESSAGES} messages` });
    return;
  }

  // Validate and rebuild every turn from its parts — client objects are never
  // forwarded as-is. Anything that is not a plain user/assistant turn is
  // rejected: a system-role entry would enable prompt injection, and a null
  // or non-object element must not crash the handler outside this contract.
  const safeMessages: ChatMessage[] = [];
  for (const entry of messages) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      res.status(400).json({ error: 'Each message must be an object with role and content' });
      return;
    }
    const { role, content } = entry as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') {
      res.status(400).json({ error: 'Messages may only use the user or assistant roles' });
      return;
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Each message requires non-empty text content' });
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Each message is limited to ${MAX_MESSAGE_LENGTH} characters` });
      return;
    }
    safeMessages.push({ role, content });
  }

  // Hard stop for stalled streams: abort the provider call when the response
  // lifecycle ends (client disconnected or finished) or on the timeout.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), STREAM_TIMEOUT_MS);
  res.on('close', () => {
    timeout.abort();
    clearTimeout(timer);
  });
  res.on('finish', () => clearTimeout(timer));

  try {
    const model = getChatModel();

    const result = streamText({
      model,
      system: getSystemPrompt(),
      messages: safeMessages,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: timeout.signal,

      // ─── AGENT MODE ──────────────────────────────────────────────────────
      // Uncomment tools and maxSteps to enable multi-step tool calling.
      // tools: {
      //   getCurrentTime: tool({
      //     description: 'Get the current date and time',
      //     parameters: z.object({}),
      //     execute: async () => ({ time: new Date().toISOString() }),
      //   }),
      //   // Add more tools here...
      // },
      // maxSteps: 5,
      // ─────────────────────────────────────────────────────────────────────
    });

    // Disable nginx proxy buffering so chunks reach the client immediately.
    res.setHeader('X-Accel-Buffering', 'no');

    // pipeTextStreamToResponse is the confirmed Express streaming method on
    // StreamTextResult in AI SDK v6. It pipes the raw text stream directly
    // into the Express ServerResponse and calls res.end() when complete.
    result.pipeTextStreamToResponse(res);

    console.log(JSON.stringify({ event: 'chat.stream.started', messageCount: safeMessages.length }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ event: 'chat.error', error: message }));

    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat request failed' });
    }
  }
}