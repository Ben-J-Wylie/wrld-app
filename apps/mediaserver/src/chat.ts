import { Server as SocketServer, Socket } from "socket.io";
import { randomUUID } from "crypto";

/**
 * Message shape shared to clients.
 */
export type ChatMsg = {
  id: string;
  threadId: string;   // the peerId this thread is about
  senderId: string;   // socket.id of sender
  senderName: string; // display name (best effort)
  text: string;
  ts: number;         // epoch ms
};

type JoinAck = { ok: true; history: ChatMsg[] } | { ok: false; error: string };
type SendAck = { ok: true; msg: ChatMsg } | { ok: false; error: string };

export type WireChatOptions = {
  /**
   * Optional namespace (e.g. "/chat"). If provided, handlers will be bound
   * to io.of(namespace) instead of the root.
   */
  namespace?: string;

  /**
   * Max messages kept per thread in memory.
   * Default: 200 (can also be overridden by env CHAT_MAX_HISTORY)
   */
  maxHistory?: number;

  /**
   * Soft character limit per message (excess will be trimmed).
   * Default: 2000
   */
  maxMessageLen?: number;

  /**
   * Basic server-side rate limit per socket (messages per 10s window).
   * Default: 20
   */
  ratePerWindow?: number;

  /**
   * Rate limit window (ms). Default: 10_000
   */
  rateWindowMs?: number;

  /**
   * Optional logger (console-like). Defaults to console.
   */
  log?: Pick<Console, "log" | "warn" | "error">;
};

/**
 * In-memory thread history: threadId -> messages
 * (Swap to Redis/DB later if you want persistence across server restarts.)
 */
const chatHistory = new Map<string, ChatMsg[]>();

/**
 * Very simple per-socket rate limiter.
 */
class RateLimiter {
  private counts = new Map<string, { count: number; resetAt: number }>();
  constructor(private max: number, private windowMs: number) {}

  allow(id: string) {
    const now = Date.now();
    const entry = this.counts.get(id);
    if (!entry || now >= entry.resetAt) {
      this.counts.set(id, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count < this.max) {
      entry.count += 1;
      return true;
    }
    return false;
  }

  remaining(id: string) {
    const entry = this.counts.get(id);
    if (!entry) return this.max;
    return Math.max(0, this.max - entry.count);
  }
}

function normalizeThreadId(threadId: unknown): string | null {
  if (typeof threadId !== "string") return null;
  const tid = threadId.trim();
  return tid.length ? tid : null;
}

function sanitizeMessage(text: unknown, maxLen: number): string | null {
  if (typeof text !== "string") return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

function getSenderName(sock: Socket): string {
  // You can pass a user object during socket.io connection: io(url, { auth: { user } })
  const authUser = (sock.handshake.auth?.user || {}) as any;
  const dataName = (sock.data as any)?.displayName;

  return (
    authUser?.username ||
    authUser?.email ||
    authUser?.name ||
    dataName ||
    `User-${sock.id.slice(0, 5)}`
  );
}

function pushMessage(
  threadId: string,
  msg: ChatMsg,
  maxHistory: number
) {
  const list = chatHistory.get(threadId) ?? [];
  const next = [...list, msg].slice(-maxHistory);
  chatHistory.set(threadId, next);
}

export function wireChat(io: SocketServer, opts: WireChatOptions = {}) {
  const log = opts.log ?? console;
  const ns = opts.namespace ? io.of(opts.namespace) : io;
  const MAX_HISTORY =
    Number(process.env.CHAT_MAX_HISTORY || opts.maxHistory || 200);
  const MAX_MSG_LEN = opts.maxMessageLen ?? 2000;
  const RATE_MAX = opts.ratePerWindow ?? 20;
  const RATE_WINDOW = opts.rateWindowMs ?? 10_000;

  const limiter = new RateLimiter(RATE_MAX, RATE_WINDOW);

  ns.on("connection", (sock: Socket) => {
    log.log("🔌 [chat] connected", { id: sock.id, ns: opts.namespace ?? "/" });

    // Join a public thread (room = chat:<threadId>)
    sock.on("chat:joinThread", (payload: any, ack?: (res: JoinAck) => void) => {
      const threadId = normalizeThreadId(payload?.threadId);
      log.log("🟦 [chat] joinThread", { from: sock.id, threadId });
      if (!threadId) {
        ack?.({ ok: false, error: "invalid threadId" });
        return;
      }

      const room = `chat:${threadId}`;
      sock.join(room);

      const history = chatHistory.get(threadId) ?? [];
      ack?.({ ok: true, history });
    });

    // Leave a thread
    sock.on("chat:leaveThread", (payload: any) => {
      const threadId = normalizeThreadId(payload?.threadId);
      log.log("⬜ [chat] leaveThread", { from: sock.id, threadId });
      if (!threadId) return;
      sock.leave(`chat:${threadId}`);
    });

    // Send a message
    sock.on("chat:send", (payload: any, ack?: (res: SendAck) => void) => {
      const threadId = normalizeThreadId(payload?.threadId);
      const text = sanitizeMessage(payload?.text, MAX_MSG_LEN);
      if (!threadId) {
        ack?.({ ok: false, error: "invalid threadId" });
        return;
      }
      if (!text) {
        ack?.({ ok: false, error: "empty" });
        return;
      }

      // Basic rate limit
      if (!limiter.allow(sock.id)) {
        log.warn("⚠️ [chat] rate limited", {
          id: sock.id,
          remaining: limiter.remaining(sock.id),
        });
        ack?.({ ok: false, error: "rate_limited" });
        return;
      }

      const msg: ChatMsg = {
        id: randomUUID(),
        threadId,
        senderId: sock.id,
        senderName: getSenderName(sock),
        text,
        ts: Date.now(),
      };

      pushMessage(threadId, msg, MAX_HISTORY);

      const room = `chat:${threadId}`;
      log.log("📢 [chat] emit chat:message", { room, msgId: msg.id });
      ns.to(room).emit("chat:message", msg);

      ack?.({ ok: true, msg });
    });

    // Optional: typing indicator (not stored in history)
    sock.on("chat:typing", (payload: any) => {
      const threadId = normalizeThreadId(payload?.threadId);
      const isTyping = !!payload?.isTyping;
      if (!threadId) return;
      const room = `chat:${threadId}`;
      ns.to(room).emit("chat:typing", {
        threadId,
        userId: sock.id,
        userName: getSenderName(sock),
        isTyping,
        ts: Date.now(),
      });
    });

    // Optional: fetch older history (pagination by count)
    sock.on("chat:fetch", (payload: any, ack?: (res: JoinAck) => void) => {
      const threadId = normalizeThreadId(payload?.threadId);
      const limit = Math.max(1, Math.min(500, Number(payload?.limit) || 100));
      if (!threadId) {
        ack?.({ ok: false, error: "invalid threadId" });
        return;
      }
      const history = (chatHistory.get(threadId) ?? []).slice(-limit);
      ack?.({ ok: true, history });
    });

    sock.on("disconnect", (reason) => {
      log.log("🔌 [chat] disconnected", { id: sock.id, reason });
    });
  });

  log.log("✅ [chat] wired", {
    namespace: opts.namespace ?? "/",
    MAX_HISTORY,
    MAX_MSG_LEN,
    RATE_MAX,
    RATE_WINDOW,
  });
}
