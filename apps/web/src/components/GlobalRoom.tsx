// apps/web/src/components/GlobalRoom.tsx
import React, { useEffect, useRef, useState } from "react";
import { MediaSoupClient } from "../lib/mediasoupClient";

export default function GlobalRoom() {
  // ✅ Create the mediasoup client ONCE
  const [msc] = useState(() => new MediaSoupClient());

  // ✅ State for peers + streams
  const [peerList, setPeerList] = useState<string[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const selfVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false; // 🧩 guard for React Strict Mode double-mounts

    // ✅ Attach socket event handlers *immediately*
    msc.onPeerListCallback = (peers) => {
      if (cancelled) return;
      console.log("🔁 setPeerList called with:", peers);
      setPeerList(peers);
    };

    msc.onNewStream = (stream, id) => {
      if (cancelled) return;
      setRemoteStreams((prev) => new Map(prev.set(id, stream)));
    };

    msc.onRemoveStream = (id) => {
      if (cancelled) return;
      setRemoteStreams((prev) => {
        prev.delete(id);
        return new Map(prev);
      });
    };

    // ✅ Start async init AFTER wiring listeners
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (selfVideo.current) {
          selfVideo.current.srcObject = stream;
          try {
            await selfVideo.current.play();
          } catch (err: any) {
            if (err.name !== "AbortError") {
              console.warn("Video play error:", err);
            }
          }
        }

        await msc.publishLocalStream(stream);
      } catch (err) {
        console.error("Error starting local stream:", err);
      }
    })();

    // 🧹 Cleanup
    return () => {
      cancelled = true;
      console.log("🧹 Cleaning up GlobalRoom");

      // ⚙️ Don’t close in dev strict mode’s fake unmount
      if (process.env.NODE_ENV !== "development") {
        msc.close();
      } else {
        // 🧩 Delay close slightly to survive double-mount
        setTimeout(() => {
          if (cancelled) msc.close();
        }, 500);
      }
    };
  }, [msc]);

  // ✅ Log to confirm React sees the updates
  useEffect(() => {
    console.log("👀 React sees peerList update:", peerList);
  }, [peerList]);

  return (
    <div className="p-4">
      <h2 className="text-lg mb-2">Active Peers ({peerList.length})</h2>

      <ul className="mb-4">
        {peerList.length === 0 ? (
          <li className="text-gray-500 text-sm italic">
            No one else is here yet
          </li>
        ) : (
          peerList.map((p) => (
            <li key={p} className="text-sm">
              {p}
            </li>
          ))
        )}
      </ul>

      <div className="flex flex-wrap gap-4">
        <div>
          <video
            ref={selfVideo}
            autoPlay
            muted
            playsInline
            className="w-64 h-48 bg-black"
          />
          <p className="text-center text-sm mt-1">You</p>
        </div>

        {[...remoteStreams.entries()].map(([id, stream]) => (
          <div key={id}>
            <video
              autoPlay
              playsInline
              className="w-64 h-48 bg-black"
              ref={(el) => el && (el.srcObject = stream)}
            />
            <p className="text-center text-sm mt-1">Peer: {id.slice(0, 6)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
