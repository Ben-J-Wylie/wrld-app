import React, { useEffect, useRef, useState } from "react";
import { MediaSoupClient } from "../lib/mediasoupClient";
import { socket } from "../lib/socket";
import { useBroadcast } from "../context/BroadcastContext";

export default function GlobalRoom() {
  const [msc] = useState(() => new MediaSoupClient());
  const [peerList, setPeerList] = useState<any[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [peerStreams, setPeerStreams] = useState<
    Map<string, MediaStream | null>
  >(new Map());

  const selfMainRef = useRef<HTMLVideoElement>(null);
  const selfPipRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // ----------------------------------------------------------
  // ✅ Initialization
  // ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    // Update peer list
    msc.onPeerListCallback = (peers) => {
      if (cancelled) return;
      const unique = Array.from(
        new Map(peers.map((p: any) => [p.id, p])).values()
      );
      setPeerList(unique);
    };

    // Handle new remote streams
    msc.onNewStream = (stream, id) => {
      setPeerStreams((prev) => {
        const next = new Map(prev);
        next.set(id, stream);
        return next;
      });
    };

    // Handle stream removal
    msc.onRemoveStream = (id) => {
      setPeerStreams((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };

    // Register user on connect
    const username =
      localStorage.getItem("username") ||
      JSON.parse(localStorage.getItem("wrld_user") || "{}")?.username ||
      "Guest";

    msc.socket.off("connect");
    msc.socket.on("connect", () => {
      console.log("🧠 Registering user:", username);
      msc.socket.emit("register", { name: username });
    });

    // Start local stream
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) return;

        if (selfMainRef.current) {
          selfMainRef.current.srcObject = stream;
          await selfMainRef.current.play().catch(() => {});
        }
        if (selfPipRef.current) {
          selfPipRef.current.srcObject = stream;
          await selfPipRef.current.play().catch(() => {});
        }

        await msc.publishLocalStream(stream);
      } catch (err) {
        console.error("❌ Error starting local stream:", err);
      }
    })();

    const handleBeforeUnload = () => {
      msc.socket.disconnect();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      msc.close();
    };
  }, [msc]);

  // ----------------------------------------------------------
  // ✅ Click on Peer (instant switch)
  // ----------------------------------------------------------
  const handleClickPeer = async (p: any) => {
    console.log("👆 Clicked peer:", p.id);

    if (!msc.recvTransport) await msc.createRecvTransport();

    // Prefetch producers to make switching instant
    const producers = await msc.request("getPeerProducers", { peerId: p.id });
    if (!producers?.length) {
      console.warn("⚠️ No active producers for peer", p.id);
      return;
    }

    setSelectedPeerId(p.id);

    // Pre-consume before React tries to render
    for (const prod of producers) {
      const id = prod.id || prod.producerId;
      if (id) await msc.consume(id);
    }
  };

  // ----------------------------------------------------------
  // Listen for globally streaming peers
  // ----------------------------------------------------------
  useEffect(() => {
    const handlePeersList = (list: any[]) => {
      console.log("🌎 Global peersList received:", list);
      setPeerList(list);
    };

    socket.on("peersList", handlePeersList);

    // ask for current list immediately
    socket.emit("getPeersList", (list: any[]) => {
      console.log("🌎 Initial peersList:", list);
      setPeerList(list);
    });

    return () => {
      socket.off("peersList", handlePeersList);
    };
  }, []);

  // ----------------------------------------------------------
  // ✅ Smooth stream switching (no flicker)
  // ----------------------------------------------------------
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    const stream = selectedPeerId ? peerStreams.get(selectedPeerId) : null;

    // ⏸️ No new stream yet → keep old one visible
    if (!stream) {
      console.log("⏸️ Waiting for new remote stream...");
      return;
    }

    // 🚀 Attach only when ready to play
    const videoEl = remoteVideoRef.current;

    if (videoEl.srcObject !== stream) {
      console.log("🎬 Preparing to switch to remote stream:", selectedPeerId);

      // Temporarily keep the old stream until new one fires 'playing'
      const oldSrc = videoEl.srcObject;
      videoEl.srcObject = stream;

      const handlePlaying = () => {
        console.log("✅ New remote stream playing:", selectedPeerId);
        // once the new stream is rendering, release the old one
        if (oldSrc && oldSrc !== stream) {
          (oldSrc as MediaStream)?.getTracks()?.forEach((t) => t.stop?.());
        }
        videoEl.removeEventListener("playing", handlePlaying);
      };

      videoEl.addEventListener("playing", handlePlaying);
      videoEl
        .play()
        .catch((err) => console.warn("⚠️ Remote play() failed:", err));
    }
  }, [peerStreams, selectedPeerId]);

  // ----------------------------------------------------------
  // ✅ Render
  // ----------------------------------------------------------
  return (
    <>
      <div className="global-room">
        {/* 👥 Peer List Sidebar */}
        <div className="peerlist-sidebar">
          <h2>Active Streams ({peerList.length})</h2>
          <ul>
            {peerList.length === 0 ? (
              <li className="empty">No one is streaming right now</li>
            ) : (
              peerList.map((p: any) => (
                <li
                  key={p.id}
                  onClick={() => handleClickPeer(p)}
                  className={selectedPeerId === p.id ? "active" : ""}
                >
                  {p.name || "Anonymous"} ({p.platform || "?"})
                </li>
              ))
            )}
          </ul>
        </div>

        {/* 🎥 Main Stage */}
        <div className="stage">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="main-video"
          />
          <video ref={selfPipRef} autoPlay muted playsInline className="pip" />

          {!selectedPeerId && (
            <div className="self-center">
              <video ref={selfMainRef} autoPlay muted playsInline />
              <p>You are live. Select a peer to view.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Inline CSS --- */}
      <style>{`
        .global-room {
          display: flex;
          height: 100vh;
          width: 100%;
          background: #000;
          color: #fff;
          overflow: hidden;
          font-family: Inter, sans-serif;
        }

        .peerlist-sidebar {
          width: 16rem;
          background: rgba(17, 24, 39, 0.8);
          backdrop-filter: blur(12px);
          padding: 1rem;
          overflow-y: auto;
          border-right: 1px solid #374151;
          z-index: 50;
        }

        .peerlist-sidebar h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .peerlist-sidebar ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .peerlist-sidebar li {
          font-size: 0.875rem;
          cursor: pointer;
          transition: color 0.2s ease;
          padding: 0.25rem 0;
        }

        .peerlist-sidebar li:hover {
          text-decoration: underline;
        }

        .peerlist-sidebar li.active {
          color: #60a5fa;
          font-weight: 600;
        }

        .peerlist-sidebar li.empty {
          color: #9ca3af;
          font-style: italic;
        }

        .stage {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          overflow: hidden;
        }

        .stage video.main-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          max-width: 100%;
          max-height: 100%;
          background: #000;
        }

        .stage video.pip {
          position: absolute;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 240px;
          height: 180px;
          object-fit: contain;
          background: #000;
          border: 2px solid #22d3ee;
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
          z-index: 10;
        }

        .self-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          text-align: center;
        }

        .self-center video {
          width: 480px;
          height: 360px;
          object-fit: contain;
          border-radius: 12px;
          border: 2px solid #bef264;
          box-shadow: 0 0 24px rgba(190, 242, 100, 0.3);
        }

        .self-center p {
          margin-top: 0.5rem;
          font-size: 0.875rem;
        }
      `}</style>
    </>
  );
}
