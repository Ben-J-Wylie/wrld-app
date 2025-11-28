// @ts-nocheck

import React from "react";
import MicSpectrum from "./components/elements/MicSpectrum/MicSpectrum";

export default function App() {
  const dummyPeer = {
    id: "123",
    displayName: "Ben",
    // optional: attach a dummy stream if you want it to animate with noise
    // audioStream: new MediaStream(),
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0e",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        padding: "40px",
      }}
    >
      <MicSpectrum peer={dummyPeer} />
    </div>
  );
}
