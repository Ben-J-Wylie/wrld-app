import React, { useEffect, useRef } from "react";
import "../../01-main/main.css";

interface PreviewCameraProps {
  facing?: "user" | "environment";
}

export default function PreviewCamera({ facing = "user" }: PreviewCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });

        if (!isMounted) return;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera access error:", err);
      }
    })();

    return () => {
      isMounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  return (
    <div className="preview-camera">
      <video
        ref={videoRef}
        className="preview-video"
        playsInline
        muted
        autoPlay
      />
    </div>
  );
}
