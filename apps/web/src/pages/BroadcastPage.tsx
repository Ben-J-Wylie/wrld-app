import React, { useState, useEffect, useRef } from "react";
import PeerList from "../components/PeerList";
import ChatWindow from "../components/ChatWindow";
import GyroVisualizer from "../components/GyroVisualizer";
import LocationMap from "../components/LocationMap";
import MicSpectrum from "../components/MicSpectrum";
import ScreenShareView from "../components/ScreenShareView";
import TorchIndicator from "../components/TorchIndicator";
import SelfPreview from "../components/SelfPreview";
import { useBroadcast } from "../context/BroadcastContext";
import { socket } from "../lib/socket";
import { MediaSoupClient } from "../lib/mediasoupClient";
import "../App.css";

export default function BroadcastPage() {
  const [msc] = useState(() => new MediaSoupClient());
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const updatePeers = (list: any[]) => setPeers(dedupePeers(list));
  const [isMobile, setIsMobile] = useState(false);
  const [isPeerListOpen, setIsPeerListOpen] = useState(true);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLVideoElement>(null);
  const selfPreviewRef = useRef<{ stopStream: () => void } | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const { settings, setSettings } = useBroadcast();

  const userInfo = JSON.parse(localStorage.getItem("wrld_user") || "{}");
  const selfDisplayName = userInfo.username || userInfo.email || "You";

  const [peers, setPeers] = useState<any[]>([]);

  function dedupePeers(list: any[]) {
    const seen = new Set();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  async function publishTrack(kind: "audio" | "video") {
    let constraints;
    if (kind === "audio") constraints = { audio: true, video: false };
    else constraints = { audio: false, video: true };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    await msc.publishLocalStream(stream);
    console.log(`📡 Published ${kind} stream`);
  }

  // ✅ Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        console.log("🚀 Preloading Mediasoup device...");
        await msc.prepareDevice();
      } catch (err) {
        console.error("❌ Failed to prepare device:", err);
      }
    })();
  }, [msc]);

  useEffect(() => {
    (async () => {
      try {
        console.log("🚀 Initializing Mediasoup stack...");

        // only one prepareDevice() call in the whole app
        await msc.prepareDevice();

        // wait until it's truly ready (covers race conditions)
        await msc.ready;

        await msc.createRecvTransport();
        console.log("✅ Mediasoup ready to receive and publish");
      } catch (err) {
        console.error("❌ Mediasoup init failed:", err);
      }
    })();
  }, []);

  // ✅ Register + initial recv transport
  useEffect(() => {
    const wrldUser =
      JSON.parse(localStorage.getItem("wrld_user") || "{}") || {};
    const username = wrldUser.username || wrldUser.email || "Anonymous";

    // ✅ Ensure socket connected
    if (!socket.connected) socket.connect();

    // ✅ Define helper to register and wait for ACK
    const registerAndWait = (username: string) => {
      return new Promise<void>((resolve) => {
        console.log("👤 Sending register:", username);
        socket.emit("register", { name: username }, (res: any) => {
          if (res?.ok) {
            console.log("✅ Registration acknowledged by server");
            resolve();
          } else {
            console.warn("⚠️ Registration unacknowledged", res);
            resolve(); // continue anyway to avoid deadlock
          }
        });

        // Timeout fallback
        setTimeout(() => resolve(), 2000);
      });
    };

    const init = async () => {
      // Wait until socket is connected
      if (!socket.connected) {
        await new Promise<void>((resolve) => {
          socket.once("connect", () => resolve());
        });
      }

      // ✅ Wait for register confirmation before Mediasoup setup
      await registerAndWait(username);

      // ✅ Now safe to start Mediasoup initialization
      if (!msc.recvTransport) {
        console.log("⚙️ Creating initial recv transport…");
        await msc.createRecvTransport();
      }
    };

    init();

    return () => {
      socket.off("connect");
    };
  }, []); // run once only

  // ✅ Fetch peers list (with settings)
  useEffect(() => {
    const updatePeers = (list: any[]) => setPeers(list);
    socket.on("peersList", updatePeers);
    socket.emit("getPeersList", (list: any[]) => setPeers(list));
    return () => socket.off("peersList", updatePeers);
  }, []);

  // ✅ Handle peer settings live updates
  // ✅ Live peer settings updates
  // ✅ Live peer settings updates
  useEffect(() => {
    const handlePeerUpdated = (updatedPeer: any) => {
      console.log("⚙️ Peer updated:", updatedPeer);

      // 1️⃣ Update peers list
      setPeers((prevPeers) => {
        const next = prevPeers.map((p) =>
          p.id === updatedPeer.id
            ? { ...p, settings: { ...updatedPeer.settings } }
            : p
        );
        return [...next]; // force new array reference
      });

      // 2️⃣ If currently watching that peer, sync immediately
      setSelectedPeer((prev) => {
        if (!prev) return prev;
        if (prev.id !== updatedPeer.id) return prev;
        console.log(
          "🔄 Updating selectedPeer in real time:",
          updatedPeer.settings
        );
        return { ...prev, settings: { ...updatedPeer.settings } };
      });
    };

    socket.on("peerUpdated", handlePeerUpdated);
    socket.on("peerSettingsUpdated", handlePeerUpdated); // support both

    return () => {
      socket.off("peerUpdated", handlePeerUpdated);
      socket.off("peerSettingsUpdated", handlePeerUpdated);
    };
  }, []);

  // ✅ Handle new remote streams
  useEffect(() => {
    msc.onNewStream = (stream: MediaStream, peerId: string, kind?: string) => {
      const kinds = stream.getTracks().map((t) => t.kind);
      console.log("🎬 New stream from:", peerId, "tracks:", kinds);

      setPeers((prev) => {
        const existing = prev.find((p) => p.id === peerId);

        const updatedPeer = existing
          ? {
              ...existing,
              displayName: existing.displayName || "Unknown",
              [kind === "audio" ? "audioStream" : "videoStream"]: stream,
            }
          : {
              id: peerId,
              displayName: "Unknown",
              [kind === "audio" ? "audioStream" : "videoStream"]: stream,
              settings: {},
            };

        const next = existing
          ? prev.map((p) => (p.id === peerId ? updatedPeer : p))
          : [...prev, updatedPeer];

        const unique = new Map<string, any>();
        for (const p of next) unique.set(p.id, p);
        return Array.from(unique.values());
      });

      // attach video if we’re watching that peer
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

  // ✅ Publish local stream when live
  useEffect(() => {
    const startLocal = async () => {
      if (localStream || (!settings.frontCamera && !settings.backCamera))
        return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        (window as any).localStreamRef = stream;
        await msc.publishLocalStream(stream);
        console.log(
          "📡 Published local stream with",
          stream.getTracks().map((t) => t.kind)
        );

        socket.emit("debugListProducers");

        // PiP preview
        if (pipRef.current) {
          pipRef.current.srcObject = stream;
          pipRef.current.play().catch(console.warn);
        }

        // Broadcast initial settings
        socket.emit("updateSettings", settings);
      } catch (err) {
        console.error("❌ Local stream error:", err);
      }
    };
    requestAnimationFrame(() => startLocal());
  }, [settings.frontCamera, settings.backCamera]);

  // ✅ When our local settings change, broadcast them to others
  useEffect(() => {
    if (!socket.connected) return;
    socket.emit("updateSettings", settings);
  }, [settings]);

  useEffect(() => {
    socket.onAny((event, payload) => {
      if (event === "peerSettingsUpdated") {
        console.log("💡 Received EVENT peerSettingsUpdated:", payload);
      }
    });
  }, []);

  // ✅ Handle peer selection
  const handleSelectPeer = async (peer: any) => {
    console.log("👆 Selected peer:", peer.displayName);
    setSelectedPeer(peer);

    // 🧠 If selecting self, immediately show own local video
    if (peer.id === socket.id) {
      if (remoteVideoRef.current && localStream) {
        remoteVideoRef.current.srcObject = localStream;
        await remoteVideoRef.current.play().catch(console.warn);
      }
      return;
    }

    // 🧩 For other peers, request their stream
    try {
      if (!msc.recvTransport) await msc.createRecvTransport();
      const producers = await msc.request("getPeerProducers", {
        peerId: peer.id,
      });
      console.log("📡 Producers for", peer.displayName, producers);

      if (producers?.length) {
        for (const p of producers) {
          const id = p.id || p.producerId;
          if (id) await msc.consume(id, peer.id);
        }
      }
    } catch (err) {
      console.error("❌ Error selecting peer:", err);
    }
  };

  // ✅ Whenever selectedPeer or localStream changes, update main video
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    const stream =
      selectedPeer?.videoStream ||
      (selectedPeer?.id === socket.id ? localStream : null) ||
      (!selectedPeer ? localStream : null);

    remoteVideoRef.current.srcObject = stream;
  }, [selectedPeer, localStream]);

  // ✅ Auto-reset if selected peer goes offline
  useEffect(() => {
    if (selectedPeer && !peers.find((p) => p.id === selectedPeer.id)) {
      console.log("⚠️ Selected peer went offline, resetting view");
      setSelectedPeer(null);
      if (remoteVideoRef.current && localStream) {
        remoteVideoRef.current.srcObject = localStream;
        remoteVideoRef.current.play().catch(console.warn);
      }
    }
  }, [peers, selectedPeer, localStream]);

  // ✅ Determine if user is live
  const isUserLive =
    settings.frontCamera ||
    settings.backCamera ||
    settings.mic ||
    settings.screenShare ||
    settings.location ||
    settings.chat ||
    settings.gyro ||
    settings.torch;

  // ✅ Build display list
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

  const FadeIn: React.FC<{ show: boolean; children: React.ReactNode }> = ({
    show,
    children,
  }) => {
    const [shouldRender, setShouldRender] = useState(show);

    useEffect(() => {
      if (show) setShouldRender(true);
      else {
        const timeout = setTimeout(() => setShouldRender(false), 400); // match CSS duration
        return () => clearTimeout(timeout);
      }
    }, [show]);

    return (
      <div className={`fade-wrapper ${show ? "fade-in" : "fade-out"}`}>
        {shouldRender && children}
      </div>
    );
  };
  // ✅ UI
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
        {!isMobile && (
          <button
            className="peerlist-toggle"
            onClick={() => setIsPeerListOpen(!isPeerListOpen)}
          >
            {isPeerListOpen ? "⟨" : "⟩"}
          </button>
        )}
      </div>

      {/* 🎥 Main View */}
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

        {/* 🎛️ Controls and broadcast widgets */}
        {selectedPeer && (
          <div className="controls-vertical">
            {selectedPeer.id === socket.id ? (
              <>
                {selectedPeer.id === socket.id ? (
                  <MicSpectrum
                    peer={{ ...selectedPeer, isSelf: true }}
                    localStream={localStream}
                  />
                ) : (
                  <MicSpectrum
                    peer={selectedPeer}
                    stream={selectedPeer.audioStream}
                  />
                )}
                {settings.location && <LocationMap peer={selectedPeer} />}
                {settings.chat && <ChatWindow peer={selectedPeer} />}
                {settings.screenShare && (
                  <ScreenShareView peer={selectedPeer} />
                )}
                {settings.gyro && <GyroVisualizer peer={selectedPeer} />}
                {settings.torch && <TorchIndicator peer={selectedPeer} />}
              </>
            ) : (
              <>
                {selectedPeer.id === socket.id ? (
                  <MicSpectrum
                    peer={{ ...selectedPeer, isSelf: true }}
                    localStream={localStream}
                  />
                ) : (
                  <MicSpectrum
                    peer={selectedPeer}
                    stream={selectedPeer.audioStream}
                  />
                )}
                {selectedPeer.settings?.location && (
                  <LocationMap peer={selectedPeer} />
                )}
                {selectedPeer.settings?.chat && (
                  <ChatWindow peer={selectedPeer} />
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
              </>
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
          background: rgba(17,24,39,0.95); /* solid color for GPU relief */
          border-right: 1px solid #222;
          padding: 1rem;
        }

        /* Mobile optimization */
        @media (max-width: 1024px) {
          .peerlist-sidebar {
            backdrop-filter: none; /* 🚫 remove blur on mobile */
            background: rgba(17,24,39,0.98);
          }

          .main-video {
            object-fit: cover; /* better hardware-accelerated scaling */
          }

          .pip {
            display: none; /* optional: remove PiP for mobile performance */
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

        .fade-wrapper {
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.4s ease, transform 0.4s ease;
          will-change: opacity, transform;
        }

        .fade-wrapper.fade-in {
          opacity: 1;
          transform: translateY(0);
        }

        .fade-wrapper.fade-out {
          opacity: 0;
          transform: translateY(8px);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
