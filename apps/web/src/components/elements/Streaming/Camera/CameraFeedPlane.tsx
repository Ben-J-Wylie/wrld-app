// apps/web/src/wrld/Streaming/CameraFeedPlane.tsx

import React, { useEffect, useRef, useState } from "react";
import { VideoTexture, LinearFilter, SRGBColorSpace } from "three";
import { Html } from "@react-three/drei";

import { VideoPlane } from "../../../CoreScene/Geometry/VideoPlane"; // ⬅️ uses your new VideoPlane
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

interface CameraFeedPlaneProps {
  msc: MediaSoupClient;
  peerId?: string;
  name?: string;

  width: any;
  height: any;
  position: any;
  rotation?: any;
  scale?: any;
  cornerRadius?: any;
  castShadow?: boolean;
  receiveShadow?: boolean;
  z?: number;
  visible?: boolean;
}

export function CameraFeedPlane({
  msc,
  peerId = "self",
  name = "CameraFeedPlane",

  width,
  height,
  position,
  rotation,
  scale,
  cornerRadius,
  castShadow = true,
  receiveShadow = true,
  z = 0,
  visible = true,
}: CameraFeedPlaneProps) {
  // Hidden-but-present HTML video element
  const videoRef = useRef<HTMLVideoElement>(null);

  // THREE.VideoTexture (created after canplay)
  const [texture, setTexture] = useState<VideoTexture | null>(null);

  // Debug flags
  const [hasStream, setHasStream] = useState(false);
  const [attachedSrcObject, setAttachedSrcObject] = useState(false);

  // ---------------------------------------------------------------------
  // Create VideoTexture *after* video has metadata and is ready to play
  // ---------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      console.log("🎥 CameraFeedPlane: <video> canplay → creating texture");

      const tex = new VideoTexture(video);
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.colorSpace = SRGBColorSpace;

      setTexture(tex);
    };

    video.addEventListener("canplay", handleCanPlay);
    return () => video.removeEventListener("canplay", handleCanPlay);
  }, []);

  // ---------------------------------------------------------------------
  // Attach LOCAL raw camera stream (for preview before Mediasoup consume)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (peerId !== "self") return;
    if (!msc.localStream) return;
    const video = videoRef.current;
    if (!video) return;

    console.log(
      "📺 [Local Preview] Attaching raw localStream",
      msc.localStream
    );
    video.srcObject = msc.localStream;

    video.muted = true;
    video.playsInline = true;

    // Force play attempt — required on Safari/iOS/Chrome
    video
      .play()
      .catch((err) =>
        console.warn("❌ video.play() failed for localStream:", err)
      );

    setAttachedSrcObject(true);
    setHasStream(true);
  }, [peerId, msc.localStream]);

  // ---------------------------------------------------------------------
  // Handle remote / Mediasoup self-consume streams
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!msc) return;

    console.log("🔌 CameraFeedPlane: binding onNewStream handler for", peerId);
    const originalHandler = msc.onNewStream;

    msc.onNewStream = (stream, id) => {
      console.log("🔥 CameraFeedPlane: onNewStream fired", { stream, id });

      if (id === peerId && videoRef.current) {
        const video = videoRef.current;

        console.log("📺 Attaching Mediasoup stream to <video>", stream);
        video.srcObject = stream;

        video.muted = true;
        video.playsInline = true;

        // Required to unfreeze VideoTexture
        video
          .play()
          .catch((err) =>
            console.warn("❌ video.play() failed on onNewStream:", err)
          );

        setAttachedSrcObject(true);
        setHasStream(true);
      }

      if (originalHandler) originalHandler(stream, id);
    };

    return () => {
      console.log("🔌 CameraFeedPlane: restoring original onNewStream");
      msc.onNewStream = originalHandler;
    };
  }, [msc, peerId]);

  // ---------------------------------------------------------------------
  // 3D Debug Overlay
  // ---------------------------------------------------------------------
  const DebugOverlay = () => (
    <Html position={[0, 0, 1]}>
      <div
        style={{
          padding: "4px 8px",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        <div>peerId: {peerId}</div>
        <div>hasStream: {String(hasStream)}</div>
        <div>attached: {String(attachedSrcObject)}</div>
        <div>texture: {texture ? "ready ✔" : "null"}</div>
      </div>
    </Html>
  );

  // ---------------------------------------------------------------------
  // Render invisible video + the VideoPlane
  // ---------------------------------------------------------------------
  return (
    <>
      {/* Hidden-but-active <video> (NOT display:none!) */}
      <Html portal={{ current: document.body }}>
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "1px",
            height: "1px",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
      </Html>

      <DebugOverlay />

      <VideoPlane
        name={name}
        videoElement={videoRef.current ?? undefined}
        width={width}
        height={height}
        cornerRadius={cornerRadius}
        position={position}
        rotation={rotation}
        scale={scale}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        z={z}
        visible={visible}
      />
    </>
  );
}
