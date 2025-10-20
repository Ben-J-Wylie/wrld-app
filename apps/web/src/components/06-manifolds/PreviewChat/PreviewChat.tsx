import React, { useState, useRef, useEffect } from "react";
import "../../01-main/main.css";

interface PreviewChatProps {
  messages: string[];
  setMessages: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function PreviewChat({
  messages,
  setMessages,
}: PreviewChatProps) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, input.trim()]);
    setInput("");
  };

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="preview-chat">
      <div className="chat-window">
        {messages.length === 0 ? (
          <p className="chat-placeholder">No messages yet...</p>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className="chat-message">
                {m}
              </div>
            ))}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button className="chat-send-btn" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}
