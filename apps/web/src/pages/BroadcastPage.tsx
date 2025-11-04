import React, { useState, useEffect, useRef } from "react";
import PeerList from "../components/PeerList";
import ChatWindow from "../components/ChatWindow";
import GyroVisualizer from "../components/GyroVisualizer";
import LocationMap from "../components/LocationMap";
import MicSpectrum from "../components/MicSpectrum";
import ScreenShareView from "../components/ScreenShareView";
import TorchIndicator from "../components/TorchIndicator";
import { useBroadcast } from "../context/BroadcastContext";
import { socket } from "../lib/socket";
import { chatSocket } from "../lib/chatSocket";
import "../App.css";

export default function BroadcastPage() {
  const { settings, msc } = useBroadcast();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [isPeerListOpen, setIsPeerListOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLVideoElement>(null);

  const userInfo = JSON.parse(localStorage.getItem("wrld_user") || "{}");
  const selfDisplayName = userInfo.username || userInfo.email || "You";

  const threadId =
    (selectedPeer?.userId as string) ||
    (selectedPeer?.stableId as string) ||
    (selectedPeer?.id as string) ||
    null;

  // 🧩 Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 🧩 Peer list updates
  useEffect(() => {
    const updatePeers = (list: any[]) => setPeers(list);
    socket.on("peersList", updatePeers);
    socket.emit("getPeersList", (list: any[]) => setPeers(list));
    return () => socket.off("peersList", updatePeers);
  }, []);

  // ✅ Live stream setup
  useEffect(() => {
    const goLive = async () => {
      const { __live, mic, frontCamera, backCamera, camera } = settings;
      if (!__live) {
        localStream?.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        return;
      }

      const wantVideo = frontCamera || backCamera || camera;
      const wantAudio = mic;

      if (!wantVideo && !wantAudio) return;

      try {
        const constraints: MediaStreamConstraints = {
          audio: wantAudio,
          video: wantVideo,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        await msc.publishLocalStream(stream);

        if (pipRef.current) {
          pipRef.current.srcObject = stream;
          pipRef.current.play().catch(console.warn);
        }

        socket.emit("updateSettings", settings);
      } catch (err) {
        console.error("❌ Live stream error:", err);
      }
    };

    goLive();
  }, [
    settings.__live,
    settings.mic,
    settings.frontCamera,
    settings.backCamera,
    settings.camera,
  ]);

  // 🧩 Remote stream handling
  useEffect(() => {
    msc.onNewStream = (stream: MediaStream, peerId: string, kind?: string) => {
      setPeers((prev) =>
        prev.map((p) =>
          p.id === peerId
            ? {
                ...p,
                [kind === "audio" ? "audioStream" : "videoStream"]: stream,
              }
            : p
        )
      );
      if (
        kind === "video" &&
        selectedPeer?.id === peerId &&
        remoteVideoRef.current
      ) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(console.warn);
      }
    };
    return () => {
      msc.onNewStream = undefined;
    };
  }, [msc, selectedPeer]);

  // 🧩 Peer selection
  const handleSelectPeer = async (peer: any) => {
    setSelectedPeer(peer);
    if (peer.id === socket.id && localStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = localStream;
      await remoteVideoRef.current.play().catch(console.warn);
      return;
    }

    try {
      const producers = await msc.request("getPeerProducers", {
        peerId: peer.id,
      });
      if (producers?.length) {
        await new Promise((r) => setTimeout(r, 200));
        for (const p of producers) {
          const id = p.id || p.producerId;
          if (id) await msc.consume(id, peer.id);
        }
      }
    } catch (err) {
      console.error("❌ Error selecting peer:", err);
    }
  };

  // 🧩 Keep video synced
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    const stream =
      selectedPeer?.videoStream ||
      (selectedPeer?.id === socket.id ? localStream : null) ||
      (!selectedPeer ? localStream : null);
    remoteVideoRef.current.srcObject = stream;
  }, [selectedPeer, localStream]);

  // 🧩 Remove offline peer
  useEffect(() => {
    if (selectedPeer && !peers.find((p) => p.id === selectedPeer.id)) {
      setSelectedPeer(null);
      if (remoteVideoRef.current && localStream) {
        remoteVideoRef.current.srcObject = localStream;
        remoteVideoRef.current.play().catch(console.warn);
      }
    }
  }, [peers, selectedPeer, localStream]);

  const isUserLive =
    settings.frontCamera ||
    settings.backCamera ||
    settings.mic ||
    settings.screenShare ||
    settings.location ||
    settings.chat ||
    settings.gyro ||
    settings.torch;

  const peersToDisplay = [
    ...(settings.__live
      ? [
          {
            id: socket.id,
            displayName: selfDisplayName,
            name: selfDisplayName,
            isStreaming: true,
            settings,
          },
        ]
      : []),
    ...peers.map((p) => ({
      ...p,
      displayName: p.displayName || p.name || "Unknown",
    })),
  ];

  return (
    <div className={`broadcast-page ${isMobile ? "mobile" : "desktop"}`}>
      {/* 👥 Peer Sidebar */}
      <div
        className={`peerlist-sidebar ${isPeerListOpen ? "open" : "closed"} ${
          isMobile ? "mobile" : ""
        }`}
      >
        <PeerList
          peers={peersToDisplay}
          selectedPeer={selectedPeer}
          onSelectPeer={handleSelectPeer}
        />
      </div>

      {/* 🟦 Toggle tab for mobile */}
      {isMobile && (
        <div
          className="peerlist-tab"
          onClick={() => setIsPeerListOpen((p) => !p)}
        >
          {isPeerListOpen ? "⟨" : "⟩"}
        </div>
      )}

      {/* 🎥 Main + Chat layout */}
      <div className="broadcast-main">
        <div className="video-section">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="main-video"
          />
          {isUserLive && (
            <video ref={pipRef} autoPlay muted playsInline className="pip" />
          )}
        </div>

        {/* 💬 Chat window: thread = selected peer (public thread about that peer) */}
        <div className="chat-section">
          <ChatWindow
            threadId={threadId}
            selfId={chatSocket.id || ""} // ✅ correct id for bubble alignment + debugging
            title={
              selectedPeer
                ? `Chat about ${
                    selectedPeer.displayName || selectedPeer.name || "Peer"
                  }`
                : "Select a peer to chat"
            }
          />
        </div>

        {/* Extra interactive overlays */}
        {selectedPeer && (
          <div className="controls-vertical">
            <MicSpectrum
              peer={selectedPeer}
              stream={
                selectedPeer.id === socket.id
                  ? localStream
                  : selectedPeer.audioStream
              }
            />
            {selectedPeer.settings?.location && (
              <LocationMap peer={selectedPeer} />
            )}
            {selectedPeer.settings?.screenShare && (
              <ScreenShareView peer={selectedPeer} />
            )}
            {selectedPeer.settings?.gyro && (
              <GyroVisualizer peer={selectedPeer} />
            )}
            {selectedPeer.settings?.torch && (
              <TorchIndicator peer={selectedPeer} />
            )}
          </div>
        )}
      </div>

      {/* ✨ Styling */}
      <style>{`
        .broadcast-page {
          display: flex;
          height: 100vh;
          width: 100%;
          background: #000;
          color: #fff;
        }

        /* Sidebar */
        .peerlist-sidebar {
          width: 16rem;
          background: rgba(17, 24, 39, 0.95);
          border-right: 1px solid #222;
          padding: 1rem;
        }

        /* Layout container */
        .broadcast-main {
          flex: 1;
          display: flex;
          flex-direction: row;
          position: relative;
        }

        .video-section {
          flex: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .chat-section {
          flex: 1;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          background: rgba(17, 24, 39, 0.7);
        }

        .main-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
          border-radius: 8px;
        }

        .pip {
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          width: 200px;
          height: 150px;
          object-fit: cover;
          border: 2px solid #0ff;
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(0,255,255,0.3);
        }

        /* 📱 Mobile: stack video + chat vertically */
        .broadcast-page.mobile .broadcast-main {
          flex-direction: column;
        }

        .broadcast-page.mobile .video-section {
          flex: none;
          height: 60vh;
        }

        .broadcast-page.mobile .chat-section {
          flex: 1;
          height: 40vh;
          border-left: none;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .controls-vertical {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: rgba(17, 24, 39, 0.7);
        }
      `}</style>
    </div>
  );
}
