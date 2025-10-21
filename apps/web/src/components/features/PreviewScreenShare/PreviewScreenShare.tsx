import React, { useEffect, useRef, useState } from "react";
import "../../_main/main.css";

export default function PreviewScreenShare() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const startScreenShare = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setActive(true);

      // Stop when the user manually ends sharing
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err: any) {
      console.error("Screen share error:", err);
      setError(err?.message || "Unable to start screen share.");
    }
  };

  const stopScreenShare = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => {
    return () => {
      stopScreenShare();
    };
  }, []);

  return (
    <div className="preview-screenshare">
      {!active ? (
        <div className="screenshare-placeholder">
          <p>Click below to start screen sharing</p>
          <button className="form-button" onClick={startScreenShare}>
            Start Screen Share
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="preview-video"
            playsInline
            muted
            autoPlay
          />
          <div className="screenshare-controls">
            <button className="form-button secondary" onClick={stopScreenShare}>
              Stop Sharing
            </button>
          </div>
        </>
      )}
    </div>
  );
}
