// apps/web/src/components/SelfPreview.tsx
import React, { useRef, useEffect } from "react";

export default function SelfPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera access denied or error:", err);
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="broadcast-video self-preview"
      autoPlay
      playsInline
      muted
    />
  );
}
