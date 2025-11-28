// apps/web/src/wrld/Streaming/CameraFeedPlane.tsx

import React, { useEffect, useRef, useState } from "react";
import { VideoTexture, LinearFilter, SRGBColorSpace } from "three";
import { Html } from "@react-three/drei";

import { ImagePlane } from "../../../CoreScene/Geometry/ImagePlane";
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
  // Hidden video element driving our VideoTexture
  const videoRef = useRef<HTMLVideoElement>(null);

  // THREE.VideoTexture
  const [texture, setTexture] = useState<VideoTexture | null>(null);

  // Debug visibility flags
  const [hasStream, setHasStream] = useState(false);
  const [attachedSrcObject, setAttachedSrcObject] = useState(false);

  // -------------------------------------------------------
  // Create VideoTexture when <video> exists
  // -------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log("🎥 CameraFeedPlane: initial videoRef is ready");

    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    const tex = new VideoTexture(video);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.colorSpace = SRGBColorSpace;

    setTexture(tex);
    console.log("🎥 CameraFeedPlane: VideoTexture created", tex);

    return () => {
      tex.dispose();
    };
  }, []);

  // -------------------------------------------------------
  // Handle incoming mediasoup streams
  // -------------------------------------------------------
  useEffect(() => {
    if (!msc) return;

    console.log("🔌 CameraFeedPlane: binding onNewStream handler for", peerId);

    const originalHandler = msc.onNewStream;

    msc.onNewStream = (stream, id) => {
      console.log("🔥 CameraFeedPlane: onNewStream fired", { stream, id });

      if (id === peerId && videoRef.current) {
        console.log("📺 Attaching stream to <video>", stream);
        videoRef.current.srcObject = stream;
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

  // -------------------------------------------------------
  // Render debug overlay
  // -------------------------------------------------------
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
        <div>texture: {texture ? "ready" : "null"}</div>
      </div>
    </Html>
  );

  // -------------------------------------------------------
  // Render plane + debug
  // -------------------------------------------------------
  return (
    <>
      {/* Hidden HTML video element */}
      <Html portal={{ current: document.body }}>
        <video ref={videoRef} style={{ display: "none" }} />
      </Html>

      {/* Debug info in 3D scene */}
      <DebugOverlay />

      {/* The actual video plane */}
      <ImagePlane
        name={name}
        texture={texture ?? undefined}
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
