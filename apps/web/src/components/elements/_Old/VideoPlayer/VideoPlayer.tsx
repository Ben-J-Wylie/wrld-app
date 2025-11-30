import React, { useEffect, useRef, useState } from "react";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";
import "./VideoPlayer.css";

export default function VideoPlayer({
  peer,
  msc,
}: {
  peer: any;
  msc: MediaSoupClient;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 🔹 Consume the peer’s producers directly
  useEffect(() => {
    if (!peer?.id || !msc) return;
    let mounted = true;

    (async () => {
      try {
        console.log("🎯 Attempting to consume stream for", peer.displayName);

        // Ensure client ready
        let tries = 0;
        while (!msc.device || !msc.socket?.connected) {
          if (tries++ > 20)
            throw new Error("Timed out waiting for MediasoupClient");
          await new Promise((r) => setTimeout(r, 500));
        }

        // Create recv transport if needed
        if (!msc.recvTransport) {
          console.log("🚀 Creating recv transport...");
          await msc.createRecvTransport();
        }

        // Fetch peer’s active producers
        const producers = await msc.request("getPeerProducers", {
          peerId: peer.id,
        });
        console.log("📡 Producers received for", peer.displayName, producers);

        if (!producers?.length) {
          console.warn("⚠️ No active producers for", peer.displayName);
          return;
        }

        // Consume each producer
        const tracks: MediaStreamTrack[] = [];
        for (const prod of producers) {
          const id = prod.id || prod.producerId;
          if (!id) continue;

          const consumer = await msc.consume(id);
          if (!consumer?.track) {
            console.warn("⚠️ No valid consumer or track for producer", id);
            continue;
          }

          const { track } = consumer;

          if (track.kind === "video") {
            console.log("🎥 Video track consumed for", peer.displayName);
            tracks.push(track);
          } else if (track.kind === "audio") {
            console.log("🎧 Audio track consumed for", peer.displayName);
            const audioEl = new Audio();
            audioEl.srcObject = new MediaStream([track]);
            audioEl.autoplay = true;
          }
        }

        if (tracks.length && mounted) {
          const newStream = new MediaStream(tracks);
          setStream(newStream);
        }
      } catch (err) {
        console.error("❌ Error consuming peer stream:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [peer?.id]);

  // 🔹 Attach stream to <video>
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current
        .play()
        .then(() => console.log("▶️ Playing", peer.displayName))
        .catch((err) => console.warn("⚠️ play() failed:", err));
    }
  }, [stream]);

  // 🔹 UI
  return (
    <div className="video-player">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="video-player__video"
      />
      {!stream && (
        <div className="video-player__waiting">
          Waiting for {peer?.displayName || "peer"}…
        </div>
      )}
      <div className="video-player__label">
        {peer?.displayName || "Anonymous"}
      </div>
    </div>
  );
}
