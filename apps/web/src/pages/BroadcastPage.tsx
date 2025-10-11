// apps/web/src/pages/BroadcastPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PeerList from "../components/PeerList";
import VideoPlayer from "../components/VideoPlayer";
import SelfPreview from "../components/SelfPreview";
import { Power } from "lucide-react";
import "../App.css";

export default function BroadcastPage() {
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [isPeerListOpen, setIsPeerListOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [autoLive, setAutoLive] = useState(false);
  const navigate = useNavigate();
  const selfPreviewRef = useRef<{ stopStream: () => void } | null>(null); // ✅ new

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setAutoLive(true); // ✅ auto start camera if coming from setup
  }, []);

  const mockPeers = [
    { id: "1", displayName: "Alice" },
    { id: "2", displayName: "Bob" },
    { id: "3", displayName: "Charlie" },
  ];

  // ✅ End stream: stop camera and go back to setup
  const handleEndStream = () => {
    selfPreviewRef.current?.stopStream();
    navigate("/setup");
  };

  return (
    <div className="broadcast-page">
      {/* ✅ End Stream Button */}
      <button className="end-stream-btn" onClick={handleEndStream}>
        <Power size={20} />
        End Stream
      </button>

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
            <SelfPreview ref={selfPreviewRef} /> {/* ✅ forwardRef for stop */}
          </>
        )}
      </div>
    </div>
  );
}
