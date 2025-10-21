// @ts-nocheck

import React, { useRef } from "react";
import SelfPreview from "./components/elements/SelfPreview/SelfPreview";

// Mock Mediasoup client for demo purposes
const mockMSC = {
  publishLocalStream: async (stream: MediaStream) => {
    console.log("Pretend publishing stream:", stream);
  },
} as any;

export default function App() {
  const previewRef = useRef<any>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0e",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <SelfPreview ref={previewRef} msc={mockMSC} />
      <button
        style={{
          background: "#0ff",
          color: "#000",
          border: "none",
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          cursor: "pointer",
        }}
        onClick={() => previewRef.current?.stopStream()}
      >
        Stop Stream
      </button>
    </div>
  );
}
