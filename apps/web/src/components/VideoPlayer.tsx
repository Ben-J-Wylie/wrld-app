// apps/web/src/components/VideoPlayer.tsx
import React, { useRef, useEffect } from "react";

export default function VideoPlayer({ peer }: { peer: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Placeholder: simulate live feed or attach actual stream later
    if (videoRef.current) {
      videoRef.current.src =
        "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4";
      videoRef.current.play().catch(() => {});
    }
  }, [peer]);

  return (
    <video
      ref={videoRef}
      className="broadcast-video"
      playsInline
      controls
      muted
    />
  );
}
