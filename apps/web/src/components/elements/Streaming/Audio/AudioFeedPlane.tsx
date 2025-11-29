import React, { useCallback, useEffect, useRef, useState, memo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

import { ImagePlane } from "../../../CoreScene/Geometry/ImagePlane";
import { VideoPlane } from "../../../CoreScene/Geometry/VideoPlane";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

interface AudioFeedPlaneProps {
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

/**
 * AudioFeedPlane
 *
 * Responsibilities:
 * - Host a hidden <canvas> (via <Html portal>).
 * - Attach MediaStream (local or remote audio).
 * - Create ONE THREE.CanvasTexture.
 * - Drive updates via rAF, drawing an audio visualizer to the canvas.
 * - Render a shadow-casting ImagePlane behind the canvas (frame).
 * - Render a VideoPlane textured with the canvas (the visualizer).
 */
export const AudioFeedPlane = memo(function AudioFeedPlane({
  msc,
  peerId = "self",
  name = "AudioFeedPlane",

  width,
  height,
  position,
  rotation,
  scale,
  z = 0,
  visible = true,
  debug = false,
}: AudioFeedPlaneProps) {
  // Hidden canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // CanvasTexture to display the visualizer
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  // Audio analyser bits
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [hasStream, setHasStream] = useState(false);
  const [attachedSrc, setAttachedSrc] = useState(false);

  const baseZ = z ?? 0;

  // ---------------------------------------------------------------------------
  // Attach a MediaStream to the analyser
  // ---------------------------------------------------------------------------
  const attachStreamToAnalyser = useCallback(
    (stream: MediaStream | null) => {
      if (!stream) return;
      if (!canvasRef.current) return;

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        console.warn("AudioFeedPlane: No audio tracks available");
        return;
      }

      setAttachedSrc(true);
      setHasStream(true);

      // Clean previous
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }

      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      let source: MediaStreamAudioSourceNode | null = null;
      try {
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
      } catch (err) {
        console.warn(
          "AudioFeedPlane: Could not connect stream to analyser",
          err
        );
        return;
      }

      // Create CanvasTexture once
      if (!texture) {
        const tex = new THREE.CanvasTexture(canvasRef.current);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        (tex as any).colorSpace =
          (THREE as any).NoColorSpace ??
          (THREE as any).LinearSRGBColorSpace ??
          tex.colorSpace;
        setTexture(tex);
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastDraw = performance.now();

      const draw = (t: number) => {
        rafRef.current = requestAnimationFrame(draw);

        // ~30fps cap
        if (t - lastDraw < 33) return;
        lastDraw = t;

        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 1.4;

        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 255;
          const h = v * canvas.height;
          ctx.fillStyle = `rgba(0, 224, 255, ${0.2 + v * 0.8})`;
          ctx.fillRect(x, canvas.height - h, barWidth, h);
          x += barWidth + 1;
        }

        if (texture) texture.needsUpdate = true;
      };

      draw(performance.now());
    },
    [texture]
  );

  // ---------------------------------------------------------------------------
  // LOCAL preview (raw mic) if peerId === "self"
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (peerId !== "self") return;
    if (!msc.localMicStream) return;

    console.log("🎤 [Local Mic] Attaching raw mic stream", msc.localMicStream);
    attachStreamToAnalyser(msc.localMicStream);
  }, [peerId, msc.localMicStream, attachStreamToAnalyser]);

  // ---------------------------------------------------------------------------
  // REMOTE streams from Mediasoup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!msc) return;

    console.log("🔌 AudioFeedPlane: binding onNewStreamAudio for", peerId);
    const orig = msc.onNewStream;

    msc.onNewStream = (stream: MediaStream, id: string) => {
      if (id === peerId) {
        console.log("🎧 Attaching remote audio stream", stream);
        attachStreamToAnalyser(stream);
      }
      if (orig) orig(stream, id);
    };

    return () => {
      console.log("🔌 AudioFeedPlane: restoring original onNewStream");
      msc.onNewStream = orig;
    };
  }, [msc, peerId, attachStreamToAnalyser]);

  // ---------------------------------------------------------------------------
  // Debug overlay
  // ---------------------------------------------------------------------------
  const DebugOverlay = () =>
    !debug ? null : (
      <Html position={[0, 0, 2]}>
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
          <div>attachedSrc: {String(attachedSrc)}</div>
          <div>texture: {texture ? "ready ✔" : "null"}</div>
        </div>
      </Html>
    );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Hidden-but-active <canvas> */}
      <Html portal={{ current: document.body }}>
        <canvas
          ref={canvasRef}
          width={300}
          height={100}
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

      {/* Shadow-casting background frame */}
      <ImagePlane
        name={`${name}-ShadowFrame`}
        width={width}
        height={height}
        position={position}
        rotation={rotation}
        scale={scale}
        z={baseZ}
        castShadow={true}
        receiveShadow={false}
        color={"#ffffff"}
        visible={visible}
      />

      {/* Visualizer texture plane */}
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
