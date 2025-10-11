// apps/web/src/components/SelfPreview.tsx
import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";

const SelfPreview = forwardRef((_, ref) => {
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

          // ✅ Safe playback start to suppress AbortError noise
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              if (err.name !== "AbortError") {
                console.warn("Video play error:", err);
              }
            });
          }
        }
      } catch (err) {
        console.error("Camera access denied or error:", err);
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ✅ Expose stopStream() to parent
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
