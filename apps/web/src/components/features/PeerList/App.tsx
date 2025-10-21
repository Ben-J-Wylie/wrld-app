// @ts-nocheck

import React, { useState } from "react";
import PeerList from "./components/feature/PeerList/PeerList";

export default function App() {
  const [selectedPeer, setSelectedPeer] = useState<any>(null);

  const peers = [
    {
      id: "1",
      displayName: "Ben",
      settings: { mic: true, camera: true },
    },
    {
      id: "2",
      displayName: "Aaron",
      settings: { mic: false, camera: false },
    },
    {
      id: "3",
      displayName: "Norman",
      settings: { mic: true, backCamera: true },
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0e",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "60px",
      }}
    >
      <PeerList
        peers={peers}
        selectedPeer={selectedPeer}
        onSelectPeer={setSelectedPeer}
      />
    </div>
  );
}
