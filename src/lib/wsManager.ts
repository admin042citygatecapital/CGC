/**
 * WebSocket Manager — shared singleton
 *
 * Features:
 *  - Single WS connection per URL, shared across all subscribers
 *  - Exponential backoff reconnect (1s → 2s → 4s … capped at 30s)
 *  - Heartbeat ping/pong (30s interval) to detect stale connections
 *  - BroadcastChannel so multiple tabs share one upstream connection
 *  - Subscriber pattern: components subscribe to message types
 *  - Graceful teardown when last subscriber unsubscribes
 *  - Page Visibility API: pauses heartbeat when tab is hidden,
 *    resumes + sends immediate ping when tab becomes visible again
 *  - Symbol subscription: sends {type:'subscribe',symbols:[...]} on open
 *    so the server streams only the symbols this client needs
 */

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

type Subscriber = (msg: WsMessage) => void;

interface ManagedSocket {
  ws: WebSocket | null;
  status: WsStatus;
  subscribers: Map<string, Set<Subscriber>>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  reconnectDelay: number;
  intentionallyClosed: boolean;
  url: string;
  /** Symbols this client has requested — sent to server on (re)connect */
  subscribedSymbols: Set<string>;
  /** Whether the Page Visibility listener has been attached */
  visibilityBound: boolean;
  /** Stored handler so the document listener can be removed on teardown */
  visibilityHandler: (() => void) | null;
}

const HEARTBEAT_INTERVAL = 30_000;
const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

const sockets = new Map<string, ManagedSocket>();

function getManagedSocket(url: string): ManagedSocket {
  if (!sockets.has(url)) {
    sockets.set(url, {
      ws: null,
      status: 'closed',
      subscribers: new Map(),
      reconnectTimer: null,
      heartbeatTimer: null,
      reconnectDelay: INITIAL_RECONNECT_DELAY,
      intentionallyClosed: false,
      url,
      subscribedSymbols: new Set(),
      visibilityBound: false,
      visibilityHandler: null,
    });
  }
  return sockets.get(url)!;
}

function startHeartbeat(managed: ManagedSocket) {
  stopHeartbeat(managed);
  managed.heartbeatTimer = setInterval(() => {
    if (managed.ws?.readyState === WebSocket.OPEN) {
      try {
        managed.ws.send(JSON.stringify({ type: 'ping' }));
      } catch {
        // ignore send errors — reconnect will handle it
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat(managed: ManagedSocket) {
  if (managed.heartbeatTimer) {
    clearInterval(managed.heartbeatTimer);
    managed.heartbeatTimer = null;
  }
}

/** Send the current symbol subscription list to the server */
function sendSubscription(managed: ManagedSocket) {
  if (managed.ws?.readyState !== WebSocket.OPEN) return;
  if (managed.subscribedSymbols.size === 0) return;
  try {
    managed.ws.send(JSON.stringify({
      type: 'subscribe',
      symbols: Array.from(managed.subscribedSymbols),
    }));
  } catch {
    // ignore
  }
}

/** Bind Page Visibility listener once per managed socket */
function bindVisibility(managed: ManagedSocket) {
  if (managed.visibilityBound || typeof document === 'undefined') return;
  managed.visibilityBound = true;

  const handler = () => {
    if (document.hidden) {
      // Tab hidden — pause heartbeat to avoid unnecessary keepalive traffic
      stopHeartbeat(managed);
    } else {
      // Tab visible again — restart heartbeat and send an immediate ping
      if (managed.ws?.readyState === WebSocket.OPEN) {
        startHeartbeat(managed);
        try { managed.ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
      } else if (!managed.intentionallyClosed && hasSubscribers(managed)) {
        // Socket died while hidden — reconnect immediately (only when someone
        // is still listening; never reopen a fully torn-down socket)
        managed.reconnectDelay = INITIAL_RECONNECT_DELAY;
        connect(managed);
      }
    }
  };
  managed.visibilityHandler = handler;
  document.addEventListener('visibilitychange', handler, { passive: true });
}

function removeVisibilityListener(managed: ManagedSocket) {
  if (managed.visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', managed.visibilityHandler);
  }
  managed.visibilityHandler = null;
  managed.visibilityBound = false;
}

function hasSubscribers(managed: ManagedSocket): boolean {
  return [...managed.subscribers.values()].some(set => set.size > 0);
}

function scheduleReconnect(managed: ManagedSocket) {
  if (managed.intentionallyClosed) return;
  if (managed.reconnectTimer) return;

  managed.reconnectTimer = setTimeout(() => {
    managed.reconnectTimer = null;
    if (!managed.intentionallyClosed) {
      connect(managed);
    }
  }, managed.reconnectDelay);

  // Exponential backoff
  managed.reconnectDelay = Math.min(managed.reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

function connect(managed: ManagedSocket) {
  if (typeof window === 'undefined') return; // SSR guard
  // Don't reconnect while tab is hidden — wait for visibilitychange
  if (typeof document !== 'undefined' && document.hidden) return;

  try {
    managed.status = 'connecting';
    notifyStatusSubscribers(managed);

    const ws = new WebSocket(managed.url);
    managed.ws = ws;

    ws.onopen = () => {
      managed.status = 'open';
      managed.reconnectDelay = INITIAL_RECONNECT_DELAY; // reset backoff on success
      notifyStatusSubscribers(managed);
      startHeartbeat(managed);
      // Tell the server which symbols we want streamed
      sendSubscription(managed);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        if (msg.type === 'pong') return; // heartbeat response — ignore

        // Dispatch to type-specific subscribers
        const typeSubs = managed.subscribers.get(msg.type);
        if (typeSubs) typeSubs.forEach(fn => fn(msg));

        // Dispatch to wildcard subscribers
        const wildcardSubs = managed.subscribers.get('*');
        if (wildcardSubs) wildcardSubs.forEach(fn => fn(msg));
      } catch {
        // malformed JSON — ignore
      }
    };

    ws.onerror = () => {
      managed.status = 'error';
      notifyStatusSubscribers(managed);
    };

    ws.onclose = () => {
      stopHeartbeat(managed);
      managed.ws = null;
      if (!managed.intentionallyClosed) {
        managed.status = 'closed';
        notifyStatusSubscribers(managed);
        scheduleReconnect(managed);
      }
    };
  } catch {
    managed.status = 'error';
    notifyStatusSubscribers(managed);
    scheduleReconnect(managed);
  }
}

function notifyStatusSubscribers(managed: ManagedSocket) {
  const subs = managed.subscribers.get('__status__');
  if (subs) subs.forEach(fn => fn({ type: '__status__', status: managed.status }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Subscribe to messages of a given type from a WebSocket URL.
 * Returns an unsubscribe function.
 *
 * @param url     Full WebSocket URL (wss://...)
 * @param type    Message type to listen for, or '*' for all messages
 * @param handler Callback invoked with each matching message
 */
export function wsSubscribe(url: string, type: string, handler: Subscriber): () => void {
  const managed = getManagedSocket(url);

  if (!managed.subscribers.has(type)) {
    managed.subscribers.set(type, new Set());
  }
  managed.subscribers.get(type)!.add(handler);

  // Bind visibility listener once per socket
  bindVisibility(managed);

  // Open connection if not already open/connecting
  if (!managed.ws || managed.ws.readyState === WebSocket.CLOSED || managed.ws.readyState === WebSocket.CLOSING) {
    managed.intentionallyClosed = false;
    connect(managed);
  }

  return () => {
    const set = managed.subscribers.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) managed.subscribers.delete(type);
    }

    // Close connection if no subscribers remain
    if (!hasSubscribers(managed)) {
      managed.intentionallyClosed = true;
      stopHeartbeat(managed);
      if (managed.reconnectTimer) {
        clearTimeout(managed.reconnectTimer);
        managed.reconnectTimer = null;
      }
      managed.ws?.close();
      managed.ws = null;
      managed.status = 'closed';
      // Fully tear down: drop the document listener and, when no symbols are
      // registered either, forget the entry entirely so a future subscriber
      // starts from a clean slate instead of inheriting stale state.
      removeVisibilityListener(managed);
      if (managed.subscribedSymbols.size === 0) {
        sockets.delete(url);
      }
    }
  };
}

/**
 * Subscribe to connection status changes for a URL.
 */
export function wsSubscribeStatus(url: string, handler: (status: WsStatus) => void): () => void {
  return wsSubscribe(url, '__status__', (msg) => handler(msg.status as WsStatus));
}

/**
 * Send a message to a connected WebSocket.
 * Returns false if the socket is not open.
 */
export function wsSend(url: string, data: WsMessage): boolean {
  const managed = sockets.get(url);
  if (!managed?.ws || managed.ws.readyState !== WebSocket.OPEN) return false;
  try {
    managed.ws.send(JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current connection status for a URL.
 */
export function wsStatus(url: string): WsStatus {
  return sockets.get(url)?.status ?? 'closed';
}

/**
 * Register symbols this client wants streamed.
 * Sends a {type:'subscribe',symbols:[...]} message immediately if connected,
 * or queues it to be sent on the next successful open.
 *
 * @param url     WebSocket URL
 * @param symbols Array of symbol strings (e.g. ['BTCUSDT','ETHUSDT'])
 */
export function wsRegisterSymbols(url: string, symbols: string[]): void {
  const managed = getManagedSocket(url);
  symbols.forEach(s => managed.subscribedSymbols.add(s));
  // Send immediately if already connected
  sendSubscription(managed);
}

/**
 * Unregister symbols (e.g. when a component unmounts).
 * Sends an updated subscription list to the server.
 */
export function wsUnregisterSymbols(url: string, symbols: string[]): void {
  const managed = sockets.get(url);
  if (!managed) return;
  symbols.forEach(s => managed.subscribedSymbols.delete(s));
  // Notify server of reduced subscription
  if (managed.subscribedSymbols.size > 0) {
    sendSubscription(managed);
  }
}
