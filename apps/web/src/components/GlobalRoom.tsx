import React, { useEffect, useRef, useState } from "react";
import { MediaSoupClient } from "../lib/mediasoupClient";

export default function GlobalRoom() {
  const [msc] = useState(() => new MediaSoupClient());
  const [peerList, setPeerList] = useState<any[]>([]); // ✅ now supports {id,name} objects
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const selfVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;

    // ✅ peerList callback
    msc.onPeerListCallback = (peers) => {
      console.log("👀 React sees peerList update:", peers);

      // ✅ Deduplicate by id and sort for stable ordering
      const unique = Array.from(
        new Map(peers.map((p: any) => [p.id, p])).values()
      );

      setPeerList(unique);
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

    // ✅ Register username when connected
    const username =
      localStorage.getItem("username") ||
      JSON.parse(localStorage.getItem("wrld_user") || "{}")?.username ||
      "Guest";

    msc.socket.on("connect", () => {
      console.log("🧠 Registering user:", username);
      msc.socket.emit("register", { name: username });
    });

    // ✅ Start camera/mic
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (selfVideo.current) {
          selfVideo.current.srcObject = stream;
          await selfVideo.current.play().catch(() => {});
        }
        await msc.publishLocalStream(stream);
      } catch (err) {
        console.error("Error starting local stream:", err);
      }
    })();

    return () => {
      cancelled = true;
      console.log("🧹 Cleaning up GlobalRoom");

      if (process.env.NODE_ENV !== "development") {
        msc.close();
      } else {
        setTimeout(() => {
          if (cancelled) msc.close();
        }, 500);
      }
    };
  }, [msc]);

  // ✅ Debug — confirm state updates
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
          peerList.map((p: any, idx) => {
            // ✅ Support both string[] and {id,name}[]
            const id = typeof p === "string" ? p : p.id;
            const name =
              typeof p === "string" ? p.slice(0, 6) : p.name || "Anonymous";
            return (
              <li key={id || idx} className="text-sm">
                {name} ({id?.slice?.(0, 5) ?? "----"})
              </li>
            );
          })
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
