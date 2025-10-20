// apps/web/src/components/SelfPreview.tsx
import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { MediaSoupClient } from "../lib/mediasoupClient";

const SelfPreview = forwardRef(({ msc }: { msc: MediaSoupClient }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true, // include mic for publishing audio producers
        });

        streamRef.current = localStream;

        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              if (err.name !== "AbortError") {
                console.warn("Video play error:", err);
              }
            });
          }
        }

        // ✅ Publish local stream to mediasoup
        if (msc) {
          console.log("🚀 Publishing local stream...");
          await msc.publishLocalStream(localStream);
        } else {
          console.warn("⚠️ msc not available in SelfPreview");
        }
      } catch (err) {
        console.error("Camera/mic access denied or error:", err);
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [msc]);

  useImperativeHandle(ref, () => ({
    stopStream: () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
  }));

  return (
    <video
      ref={videoRef}
      className="broadcast-video self-preview"
      autoPlay
      playsInline
      muted
    />
  );
});

export default SelfPreview;
