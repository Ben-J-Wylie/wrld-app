// apps/web/src/wrld/Streaming/CameraFeedPlane.tsx

import React, { useCallback, useEffect, useRef, useState, memo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

import { VideoPlane } from "../../../CoreScene/Geometry/VideoPlane";
import { ImagePlane } from "../../../CoreScene/Geometry/ImagePlane";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

interface CameraFeedPlaneProps {
  msc: MediaSoupClient;
  peerId?: string;
  name?: string;

  // keep these loose to match your responsive system
  width: any;
  height: any;
  position: any;
  rotation?: any;
  scale?: any;
  z?: number;
  visible?: boolean;

  /** Optional: enable in-scene debug overlay */
  debug?: boolean;
}

/**
 * CameraFeedPlane
 *
 * Responsibilities:
 * - Host a hidden <video> DOM element (via <Html portal>).
 * - Attach MediaStream (local or remote) to <video>.
 * - Create ONE THREE.VideoTexture when the video can play.
 * - Drive texture updates via requestVideoFrameCallback (when available),
 *   with a useFrame() fallback.
 * - Render a lightweight VideoPlane that simply displays the texture.
 * - Render a shadow-casting ImagePlane behind the video (frame).
 */
export const CameraFeedPlane = memo(function CameraFeedPlane({
  msc,
  peerId = "self",
  name = "CameraFeedPlane",

  width,
  height,
  position,
  rotation,
  scale,
  z = 0,
  visible = true,
  debug = false,
}: CameraFeedPlaneProps) {
  // Hidden-but-present HTML video element
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // THREE.VideoTexture, created lazily once the video can play
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

  // Debug flags
  const [hasStream, setHasStream] = useState(false);
  const [attachedSrcObject, setAttachedSrcObject] = useState(false);

  // Base Z for this stack (frame / video / future layers)
  const baseZ = z ?? 0;

  // ---------------------------------------------------------------------------
  // Helper: attach a MediaStream to the <video> element & kick playback
  // ---------------------------------------------------------------------------
  const attachStreamToVideo = useCallback((stream: MediaStream | null) => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    // Force play attempt — required on Safari/iOS/Chrome
    video
      .play()
      .catch((err) =>
        console.warn("❌ CameraFeedPlane: video.play() failed:", err)
      );

    setAttachedSrcObject(true);
    setHasStream(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Create VideoTexture AFTER <video> has metadata and can play
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      // Avoid re-creating if we already have one
      if (texture) return;

      console.log(
        "🎥 CameraFeedPlane: <video> canplay → creating THREE.VideoTexture"
      );

      const tex = new THREE.VideoTexture(video);

      // 🔑 Performance-critical flags:
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;

      // Avoid extra sRGB transform – keep as linear / default
      // (NoColorSpace is r152+, fall back gracefully)
      (tex as any).colorSpace =
        (THREE as any).NoColorSpace ??
        (THREE as any).LinearSRGBColorSpace ??
        (tex as any).colorSpace;

      // We drive updates manually; don't let React control this each render
      tex.needsUpdate = false;

      setTexture(tex);
    };

    video.addEventListener("canplay", handleCanPlay);
    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);

  // ---------------------------------------------------------------------------
  // Attach LOCAL raw camera stream (for preview before/alongside Mediasoup)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (peerId !== "self") return;
    if (!msc.localStream) return;

    console.log(
      "📺 [Local Preview] Attaching raw localStream to <video>",
      msc.localStream
    );
    attachStreamToVideo(msc.localStream);
  }, [peerId, msc.localStream, attachStreamToVideo]);

  // ---------------------------------------------------------------------------
  // Handle remote / Mediasoup "onNewStream" events
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!msc) return;

    console.log("🔌 CameraFeedPlane: binding onNewStream handler for", peerId);
    const originalHandler = msc.onNewStream;

    msc.onNewStream = (stream: MediaStream, id: string) => {
      console.log("🔥 CameraFeedPlane: onNewStream fired", { stream, id });

      if (id === peerId) {
        console.log("📺 Attaching Mediasoup stream to <video>", stream);
        attachStreamToVideo(stream);
      }

      if (originalHandler) {
        originalHandler(stream, id);
      }
    };

    return () => {
      console.log("🔌 CameraFeedPlane: restoring original onNewStream");
      msc.onNewStream = originalHandler;
    };
  }, [msc, peerId, attachStreamToVideo]);

  // ---------------------------------------------------------------------------
  // Drive VideoTexture updates using requestVideoFrameCallback when available.
  // This avoids per-frame React work and only updates when a new video frame
  // actually exists.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    const tex = texture;

    if (!video || !tex) return;

    const anyVideo = video as any;
    const hasRVFC =
      typeof anyVideo.requestVideoFrameCallback === "function" &&
      typeof anyVideo.cancelVideoFrameCallback === "function";

    if (!hasRVFC) {
      // Fallback: we'll simply mark needsUpdate in VideoPlane via useFrame.
      console.log(
        "ℹ️ CameraFeedPlane: requestVideoFrameCallback not available; using fallback in VideoPlane."
      );
      return;
    }

    let handle: number;

    const onFrame = () => {
      tex.needsUpdate = true;
      handle = anyVideo.requestVideoFrameCallback(onFrame);
    };

    handle = anyVideo.requestVideoFrameCallback(onFrame);

    return () => {
      if (handle && anyVideo.cancelVideoFrameCallback) {
        anyVideo.cancelVideoFrameCallback(handle);
      }
    };
  }, [texture]);

  // ---------------------------------------------------------------------------
  // Optional in-scene Debug Overlay (disabled by default)
  // ---------------------------------------------------------------------------
  const DebugOverlay = () =>
    !debug ? null : (
      <Html position={[0, 0, 1]}>
        <div
          style={{
            padding: "4px 8px",
            background: "rgba(0,0,0,0.6)",
            color: "white",
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

  // ---------------------------------------------------------------------------
  // Render hidden <video> + frame plane + VideoPlane
  // ---------------------------------------------------------------------------
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

      {/* Shadow-casting frame behind the video (z layer 0) */}
      <ImagePlane
        name={`${name}-ShadowFrame`}
        width={width}
        height={height}
        position={position}
        rotation={rotation}
        scale={scale}
        z={baseZ} // back layer
        castShadow={true}
        receiveShadow={false}
        // optional: a neutral color; shadow map is what matters
        color={"#ffffff"}
        visible={visible}
      />

      {/* VideoPlane at z layer 1 (no shadows, just the video) */}
      {texture && (
        <VideoPlane
          name={name}
          texture={texture}
          width={width}
          height={height}
          position={position}
          rotation={rotation}
          scale={scale}
          z={baseZ + 1}
          visible={visible}
        />
      )}
    </>
  );
});
