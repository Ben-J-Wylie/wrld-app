import React from "react";
export default function ChatWindow({ peer }: any) {
  return (
    <div className="chat-window">💬 Chat with {peer.displayName} (stub)</div>
  );
}
