import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

import { VideoPlane } from "../../../CoreScene/Geometry/VideoPlane";
import { ImagePlane } from "../../../CoreScene/Geometry/ImagePlane";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

// ------------------------------------------------------
// ⭐ ADD THIS: Proper strongly typed props interface
// ------------------------------------------------------
interface ScreenFeedPlaneProps {
  msc: MediaSoupClient;
  peerId?: string;
  name?: string;

  width: any;
  height: any;
  position: any;
  rotation?: any;
  scale?: any;
  z?: number;
  visible?: boolean;

  debug?: boolean;
}

// ------------------------------------------------------
// Component
// ------------------------------------------------------
export const ScreenFeedPlane = memo(function ScreenFeedPlane({
  msc,
  peerId = "self",
  name = "ScreenFeed",

  width,
  height,
  position,
  rotation,
  scale,
  z = 0,
  visible = true,
  debug = false,
}: ScreenFeedPlaneProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

  const [hasStream, setHasStream] = useState(false);
  const [attached, setAttached] = useState(false);

  const attachStream = useCallback((stream: MediaStream | null) => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    video.play().catch((err) => {
      console.warn("🖥 ScreenFeedPlane: video.play() failed:", err);
    });

    setAttached(true);
    setHasStream(true);
  }, []);

  // Create VideoTexture when <video> can play
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      if (texture) return;

      console.log("🖥 Screenshare: creating THREE.VideoTexture");

      const tex = new THREE.VideoTexture(video);
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;

      (tex as any).colorSpace =
        (THREE as any).NoColorSpace ??
        (THREE as any).LinearSRGBColorSpace ??
        tex.colorSpace;

      tex.needsUpdate = false;
      setTexture(tex);
    };

    video.addEventListener("canplay", handleCanPlay);
    return () => video.removeEventListener("canplay", handleCanPlay);
  }, [texture]);

  // Local screenshare preview (optional)
  useEffect(() => {
    if (peerId !== "self") return;
    if (!msc.localScreenStream) return;

    console.log("🖥 [Local Preview] attaching localScreenStream");
    attachStream(msc.localScreenStream);
  }, [peerId, msc.localScreenStream, attachStream]);

  // Bind mediasoup onNewStream with mediaTag filtering
  useEffect(() => {
    if (!msc) return;

    const orig = msc.onNewStream;

    msc.onNewStream = (stream: MediaStream, id: string, mediaTag?: string) => {
      console.log("🖥 ScreenshareFeedPlane onNewStream", { id, mediaTag });

      if (id === peerId) {
        // ⭐ Accept ONLY screenshare
        if (mediaTag === "screen") {
          console.log("🖥 Attaching SCREEN stream");
          attachStream(stream);
        }

        // Legacy fallback
        else if (!mediaTag && stream.getVideoTracks().length > 0) {
          console.log("🖥 Fallback: attaching stream without tag");
          attachStream(stream);
        }
      }

      if (orig) orig(stream, id, mediaTag);
    };

    return () => {
      msc.onNewStream = orig;
    };
  }, [msc, peerId, attachStream]);

  // RVFC for optimal updates
  useEffect(() => {
    const video = videoRef.current;
    const tex = texture;
    if (!video || !tex) return;

    const anyVideo = video as any;
    if (typeof anyVideo.requestVideoFrameCallback !== "function") return;

    let handle: number;
    const onFrame = () => {
      tex.needsUpdate = true;
      handle = anyVideo.requestVideoFrameCallback(onFrame);
    };
    handle = anyVideo.requestVideoFrameCallback(onFrame);

    return () => {
      if (handle) anyVideo.cancelVideoFrameCallback(handle);
    };
  }, [texture]);

  const DebugOverlay = () =>
    !debug ? null : (
      <Html position={[0, 0, 1]}>
        <div
          style={{
            padding: "4px 8px",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            fontSize: 12,
          }}
        >
          <div>peerId: {peerId}</div>
          <div>hasStream: {String(hasStream)}</div>
          <div>attached: {String(attached)}</div>
          <div>texture: {texture ? "ready ✔" : "null"}</div>
        </div>
      </Html>
    );

  return (
    <>
      {/* Hidden DOM video */}
      <Html portal={{ current: document.body }}>
        <video
          ref={videoRef}
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

      <ImagePlane
        name={`${name}-Frame`}
        width={width}
        height={height}
        position={position}
        rotation={rotation}
        scale={scale}
        z={z}
        castShadow
        receiveShadow={false}
        color={"#ffffff"}
        visible={visible}
      />

      {texture && (
        <VideoPlane
          name={name}
          texture={texture}
          width={width}
          height={height}
          position={position}
          rotation={rotation}
          scale={scale}
          z={z + 1}
          visible={visible}
        />
      )}
    </>
  );
});
