import React, { useEffect, useRef, useState } from "react";
import { chatSocket as socket } from "../lib/chatSocket";
import "./ChatWindow.css";

type Message = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
};

interface ChatWindowProps {
  threadId: string | null;
  selfId: string;
  title?: string;
}

export default function ChatWindow({
  threadId,
  selfId,
  title,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [byThread, setByThread] = useState<Map<string, Message[]>>(new Map());
  const [isJoining, setIsJoining] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🔒 de-dupe across the session (ids are UUIDs from server)
  const seenRef = useRef<Set<string>>(new Set());

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });

  // Helper: add message if not seen
  const addMessage = (m: Message) => {
    if (seenRef.current.has(m.id)) return; // ignore dup (optimistic vs echo, or double listeners)
    seenRef.current.add(m.id);
    setByThread((prev) => {
      const list = prev.get(m.threadId) ?? [];
      const next = new Map(prev);
      next.set(m.threadId, [...list, m]);
      return next;
    });
  };

  // Join/leave when thread changes
  useEffect(() => {
    if (!threadId) return;

    setIsJoining(true);
    socket.emit(
      "chat:joinThread",
      { threadId },
      (resp: { ok: boolean; history?: Message[] }) => {
        setIsJoining(false);
        if (resp?.ok && resp.history) {
          // pre-fill history (also de-dupe into seenRef)
          setByThread((prev) => {
            const sorted = [...resp.history].sort((a, b) => a.ts - b.ts);
            for (const m of sorted) seenRef.current.add(m.id);
            const next = new Map(prev);
            next.set(threadId, sorted);
            return next;
          });
          setTimeout(scrollToBottom, 50);
        }
      }
    );

    return () => {
      socket.emit("chat:leaveThread", { threadId });
    };
  }, [threadId]);

  // Receive live messages
  useEffect(() => {
    const onMsg = (msg: Message) => {
      addMessage(msg);
      if (msg.threadId === threadId) setTimeout(scrollToBottom, 0);
    };
    socket.on("chat:message", onMsg);
    return () => {
      socket.off("chat:message", onMsg);
    };
  }, [threadId]);

  // Send without optimistic add (let server echo it back once)
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId) return;
    const text = input.trim();
    if (!text) return;

    socket.emit("chat:joinThread", { threadId }, () => {
      socket.emit("chat:send", { threadId, text }, (ack: { ok: boolean }) => {
        // no local push here — wait for server echo
        // if ack not ok, you could show a toast
      });
    });
    setInput("");
  };

  const msgs = threadId ? byThread.get(threadId) ?? [] : [];

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-title">{title ?? "Chat"}</div>
        <div className="chat-sub">
          {threadId ? `Thread: ${threadId}` : "No thread selected"}
        </div>
      </div>

      <div className="chat-messages">
        {!threadId && (
          <div className="chat-status">Select a peer to open its thread.</div>
        )}
        {threadId && isJoining && (
          <div className="chat-status">Joining thread…</div>
        )}
        {threadId && !isJoining && msgs.length === 0 && (
          <div className="chat-status">
            No messages yet — be the first to say hi.
          </div>
        )}

        {msgs.map((m) => {
          const isSelf = m.senderId === selfId;
          return (
            <div key={m.id} className={`chat-message ${isSelf ? "self" : ""}`}>
              <div className="meta">
                <strong className="name">{m.senderName}</strong>
                <span className="time">
                  {new Date(m.ts).toLocaleTimeString()}
                </span>
              </div>
              <div className="text">{m.text}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={threadId ? "Type a message…" : "Select a peer to chat…"}
          disabled={!threadId}
        />
        <button type="submit" disabled={!threadId || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
