// @ts-nocheck

import React, { useState } from "react";
import PreviewChat from "./components/manifolds/PreviewChat/PreviewChat";

export default function App() {
  const [messages, setMessages] = useState<string[]>([]);

  return (
    <div
      style={{
        background: "#0e0e0e",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "20px",
        padding: "20px",
      }}
    >
      <h2 style={{ fontWeight: 500 }}>Chat Preview Demo</h2>

      <div style={{ width: "80%", maxWidth: "400px" }}>
        <PreviewChat messages={messages} setMessages={setMessages} />
      </div>

      <p style={{ color: "#777", fontSize: "0.9rem", textAlign: "center" }}>
        Type messages and press Enter or click Send.
      </p>
    </div>
  );
}
