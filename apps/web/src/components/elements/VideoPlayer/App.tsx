// @ts-nocheck

import React from "react";
import VideoPlayer from "./components/elements/VideoPlayer/VideoPlayer";

// Mock MediasoupClient for demo
const mockMSC = {
  device: true,
  socket: { connected: true },
  recvTransport: true,
  createRecvTransport: async () => {},
  request: async () => [{ id: "mockVideo" }],
  consume: async () => ({
    track: new MediaStreamTrack(), // placeholder (no actual feed)
  }),
} as any;

export default function App() {
  const mockPeer = { id: "123", displayName: "Ben" };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0e",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px",
      }}
    >
      <VideoPlayer peer={mockPeer} msc={mockMSC} />
    </div>
  );
}
