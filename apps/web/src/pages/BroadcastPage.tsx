// apps/web/src/pages/BroadcastPage.tsx
import React, { useState, useEffect } from "react";
import PeerList from "../components/PeerList";
import VideoPlayer from "../components/VideoPlayer";
import SelfPreview from "../components/SelfPreview"; // ✅ new
import "../App.css";

export default function BroadcastPage() {
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [isPeerListOpen, setIsPeerListOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [autoLive, setAutoLive] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // If navigated here from setup (Go Live), auto-activate preview
    setAutoLive(true);
  }, []);

  const mockPeers = [
    { id: "1", displayName: "Alice" },
    { id: "2", displayName: "Bob" },
    { id: "3", displayName: "Charlie" },
  ];

  return (
    <div className="broadcast-page">
      {/* Hamburger for mobile */}
      {isMobile && (
        <button
          className="hamburger-btn"
          onClick={() => setIsPeerListOpen(!isPeerListOpen)}
        >
          ☰
        </button>
      )}

      {/* PeerList sidebar */}
      <div
        className={`peerlist-sidebar ${isPeerListOpen ? "open" : "closed"} ${
          isMobile ? "mobile" : ""
        }`}
      >
        <PeerList
          peers={mockPeers}
          selectedPeer={selectedPeer}
          onSelectPeer={(peer) => {
            setSelectedPeer(peer);
            if (isMobile) setIsPeerListOpen(false);
          }}
        />
        {!isMobile && (
          <button
            className="peerlist-toggle"
            onClick={() => setIsPeerListOpen(!isPeerListOpen)}
          >
            {isPeerListOpen ? "⟨" : "⟩"}
          </button>
        )}
      </div>

      {/* Main broadcast area */}
      <div className="broadcast-main">
        {selectedPeer ? (
          <>
            <h2 className="broadcast-title">
              Watching <span>{selectedPeer.displayName}</span>
            </h2>
            <VideoPlayer peer={selectedPeer} />
          </>
        ) : (
          <>
            <h2 className="broadcast-title">
              <span>{autoLive ? "You're Live" : "Your Camera"}</span>
            </h2>
            <SelfPreview />
          </>
        )}
      </div>
    </div>
  );
}
