import React, { useEffect, useRef, useState } from "react";
import { MediaSoupClient } from "../lib/mediasoupClient";

export default function GlobalRoom() {
  const [msc] = useState(() => new MediaSoupClient());
  const [peerList, setPeerList] = useState<string[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const selfVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (selfVideo.current) {
        selfVideo.current.srcObject = stream;
        try {
          await selfVideo.current.play();
        } catch (err: any) {
          if (err.name !== "AbortError") console.warn("Video play error:", err);
        }
      }

      msc.onPeerList = setPeerList;
      msc.onNewStream = (stream, id) => {
        setRemoteStreams((prev) => new Map(prev.set(id, stream)));
      };
      msc.onRemoveStream = (id) => {
        setRemoteStreams((prev) => {
          prev.delete(id);
          return new Map(prev);
        });
      };

      await msc.publishLocalStream(stream);
    })();

    return () => msc.close();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg mb-2">Active Peers ({peerList.length})</h2>
      <ul className="mb-4">
        {peerList.map((p) => (
          <li key={p} className="text-sm">
            {p}
          </li>
        ))}
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
