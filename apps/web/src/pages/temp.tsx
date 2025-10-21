// apps/web/src/pages/BroadcastPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PeerList from "../components/PeerList";
import VideoPlayer from "../components/VideoPlayer";
import ChatWindow from "../components/ChatWindow";
import GyroVisualizer from "../components/GyroVisualizer";
import LocationMap from "../components/LocationMap";
import MicSpectrum from "../components/MicSpectrum";
import ScreenShareView from "../components/ScreenShareView";
import TorchIndicator from "../components/TorchIndicator";
import SelfPreview from "../components/SelfPreview";
import { useBroadcast } from "../context/BroadcastContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { socket } from "../lib/socket";
import { MediaSoupClient } from "../lib/mediasoupClient";
import "../App.css";

export default function BroadcastPage() {
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [isPeerListOpen, setIsPeerListOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [peers, setPeers] = useState<any[]>([]);
  const navigate = useNavigate();
  const selfPreviewRef = useRef<{ stopStream: () => void } | null>(null);
  const [msc] = useState(() => new MediaSoupClient());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentPeerName, setCurrentPeerName] = useState<string | null>(null);

  const { settings } = useBroadcast();

  // ✅ Responsive check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // 🔹 Called whenever mediasoup-client creates a new consumer stream
    msc.onNewStream = (stream, peerId) => {
      console.log("🎬 Received new stream from:", peerId);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .then(() => console.log("▶️ Playing stream from:", peerId))
          .catch((err) =>
            console.warn("⚠️ play() error on incoming stream:", err)
          );
      }

      // optional: track who you're watching
      setCurrentPeerName(peerId);
    };

    // cleanup when leaving page
    return () => {
      msc.onNewStream = undefined;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  useEffect(() => {
    const wrldUser =
      JSON.parse(localStorage.getItem("wrld_user") || "{}") || {};
    const username = wrldUser.username || wrldUser.email || "Anonymous";

    if (socket.connected) {
      socket.emit("register", { name: username });
    } else {
      socket.on("connect", () => {
        socket.emit("register", { name: username });
      });
    }

    return () => {
      socket.off("connect");
    };
  }, []);

  // ✅ Listen for peers list from the server (filtered to only live users)
  useEffect(() => {
    const handlePeersList = (list: any[]) => {
      //console.log("📡 Received live peers list:", list);
      setPeers(list);
    };

    socket.on("peersList", handlePeersList);

    // 🔹 Ask for the current list when first connecting
    socket.emit("getPeersList", (initialList: any[]) => {
      console.log("📡 Initial peers list:", initialList);
      setPeers(initialList);
    });

    return () => {
      socket.off("peersList", handlePeersList);
    };
  }, []);

  useEffect(() => {
    if (!selectedPeer) return;

    const updated = peers.find((p) => p.id === selectedPeer.id);
    if (updated) {
      setSelectedPeer(updated);
    } else {
      // Peer went offline or stopped streaming → clear selection
      setSelectedPeer(null);
    }
  }, [peers]);

  // ✅ Determine if current user is live
  const isUserLive =
    settings.frontCamera ||
    settings.backCamera ||
    settings.mic ||
    settings.screenShare ||
    settings.location ||
    settings.chat ||
    settings.gyro ||
    settings.torch;

  // ✅ Include self if live
  const peersToDisplay = [
    ...(settings.__live
      ? [
          {
            id: socket.id,
            displayName:
              JSON.parse(localStorage.getItem("wrld_user") || "{}")?.username ||
              "You",
          },
        ]
      : []),
    ...peers.filter((p) => p.id !== socket.id),
  ];

  return (
    <div className="broadcast-page">
      {/* 📱 Hamburger for mobile */}
      {isMobile && (
        <button
          className="hamburger-btn"
          onClick={() => setIsPeerListOpen(!isPeerListOpen)}
        >
          ☰
        </button>
      )}

      {/* 👥 PeerList sidebar */}
      <div
        className={`peerlist-sidebar ${isPeerListOpen ? "open" : "closed"} ${
          isMobile ? "mobile" : ""
        }`}
      >
        <PeerList
          peers={peersToDisplay}
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

      {/* 🎥 Main broadcast area */}
      <div className="broadcast-main">
        {selectedPeer ? (
          <div className="peer-broadcast-view">
            <h2 className="broadcast-title">
              Watching <span>{selectedPeer.displayName}</span>
            </h2>

            {/* ✅ Camera */}
            {selectedPeer.settings?.frontCamera ||
            selectedPeer.settings?.backCamera ? (
              <VideoPlayer peer={selectedPeer} msc={msc} />
            ) : null}

            {/* ✅ Mic spectrum */}
            {selectedPeer.settings?.mic ? (
              <MicSpectrum peer={selectedPeer} />
            ) : null}

            {/* ✅ Map */}
            {selectedPeer.settings?.location ? (
              <LocationMap peer={selectedPeer} />
            ) : null}

            {/* ✅ Chat */}
            {selectedPeer.settings?.chat ? (
              <ChatWindow peer={selectedPeer} />
            ) : null}

            {/* ✅ Screen share */}
            {selectedPeer.settings?.screenShare ? (
              <ScreenShareView peer={selectedPeer} />
            ) : null}

            {/* ✅ Gyro */}
            {selectedPeer.settings?.gyro ? (
              <GyroVisualizer peer={selectedPeer} />
            ) : null}

            {/* ✅ Torch */}
            {selectedPeer.settings?.torch ? (
              <TorchIndicator peer={selectedPeer} />
            ) : null}
          </div>
        ) : (
          <>
            <h2 className="broadcast-title">
              <span>{isUserLive ? "You're Live" : "Your Camera"}</span>
            </h2>
            <SelfPreview ref={selfPreviewRef} msc={msc} />
          </>
        )}
      </div>
    </div>
  );
}

<style>{`
  .peer-broadcast-view > * {
    margin-bottom: 1rem;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 0.75rem;
    background: rgba(30, 41, 59, 0.7);
  }

  .mic-spectrum,
  .map,
  .chat-window,
  .screen-share,
  .gyro-visualizer,
  .torch-indicator {
    text-align: center;
    color: #e5e7eb;
  }
`}</style>;
