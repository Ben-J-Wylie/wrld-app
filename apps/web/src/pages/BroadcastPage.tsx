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

  // 👤 Get local user info
  const userInfo = JSON.parse(localStorage.getItem("wrld_user") || "{}");
  const selfDisplayName = userInfo.username || userInfo.email || "You";

  // 🧩 Handle responsive UI
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

  // ✅ When user goes live or toggles mic/camera, publish selected sources
  useEffect(() => {
    const goLive = async () => {
      const { __live, mic, frontCamera, backCamera, camera } = settings;
      if (!__live) {
        console.log("🧹 User went offline, stopping local tracks");
        localStream?.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        return;
      }

      const wantVideo = frontCamera || backCamera || camera;
      const wantAudio = mic;

      if (!wantVideo && !wantAudio) {
        console.log("⚠️ No media sources selected — not publishing anything");
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: wantAudio,
          video: wantVideo,
        };

        console.log("🎙️ getUserMedia constraints:", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        (window as any).localStreamRef = stream;

        const tracks = stream.getTracks().map((t) => `${t.kind}:${t.enabled}`);
        console.log("📡 Local stream tracks:", tracks);

        await msc.publishLocalStream(stream);
        console.log("✅ Published local stream via MediasoupClient");

        if (pipRef.current) {
          pipRef.current.srcObject = stream;
          const playPromise = pipRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              if (err.name !== "AbortError") {
                console.warn("🎬 pip play() failed:", err);
              }
            });
          }
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

  // 🧩 Handle remote stream updates
  useEffect(() => {
    msc.onNewStream = (stream: MediaStream, peerId: string, kind?: string) => {
      setPeers((prev) => {
        const updated = prev.map((p) =>
          p.id === peerId
            ? {
                ...p,
                [kind === "audio" ? "audioStream" : "videoStream"]: stream,
              }
            : p
        );
        return updated;
      });

      // auto-play video for selected peer
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

  // 🧩 Selecting a peer
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
        // 👇 wait briefly to ensure transport handshake completes
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

  // 🧩 Keep main video synced
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    const stream =
      selectedPeer?.videoStream ||
      (selectedPeer?.id === socket.id ? localStream : null) ||
      (!selectedPeer ? localStream : null);
    remoteVideoRef.current.srcObject = stream;
  }, [selectedPeer, localStream]);

  // 🧩 Remove peer from view when offline
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

  // Merge self and peers into one list
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
    <div className="broadcast-page">
      {/* 👥 Sidebar */}
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

      {/* 🎥 Main display */}
      <div className="broadcast-main">
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
            {selectedPeer.settings?.chat && <ChatWindow peer={selectedPeer} />}
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

      <style>{`
        .broadcast-page {
          display: flex;
          height: 100vh;
          width: 100%;
          background: #000;
          color: #fff;
        }
        .peerlist-sidebar {
          width: 16rem;
          background: rgba(17,24,39,0.95);
          border-right: 1px solid #222;
          padding: 1rem;
        }
        @media (max-width: 1024px) {
          .peerlist-sidebar {
            background: rgba(17,24,39,0.98);
          }
          .pip {
            display: none;
          }
        }
        .broadcast-main {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .main-video {
          width: 100%;
          height: 70%;
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
        .controls-vertical {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: rgba(17,24,39,0.7);
        }
      `}</style>
    </div>
  );
}
