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

export const AudioFeedPlane = memo(function AudioFeedPlane({
  msc,
  peerId = "self",
  name = "AudioFeed",

  width,
  height,
  position,
  rotation,
  scale,
  z = 0,
  visible = true,
  debug = false,
}: AudioFeedPlaneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  // Audio nodes / state
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [hasStream, setHasStream] = useState(false);
  const [attachedSrc, setAttachedSrc] = useState(false);

  const baseZ = z ?? 0;

  // ----------------------------------------------------------
  // Prepare canvas size based on plane props
  // ----------------------------------------------------------
  const updateCanvasSize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;

    // double resolution for crisp UI
    const w = (typeof width === "number" ? width : 300) * 2;
    const h = (typeof height === "number" ? height : 100) * 2;

    c.width = w;
    c.height = h;
  }, [width, height]);

  useEffect(() => {
    updateCanvasSize();
  }, [updateCanvasSize]);

  // ----------------------------------------------------------
  // Connect audio stream → analyser → canvas visualizer
  // ----------------------------------------------------------
  const attachStreamToAnalyser = useCallback(
    (stream: MediaStream | null) => {
      if (!stream) return;
      if (!canvasRef.current) return;

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        console.warn("AudioFeedPlane: No audio tracks in stream");
        return;
      }

      console.log("🎧 AudioFeedPlane attaching audio stream:", stream);

      setAttachedSrc(true);
      setHasStream(true);

      // Cleanup previous
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }

      // Create audio context
      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      // Safari fix — resume on user gesture
      audioCtx.resume().catch(() => {});

      // Create analyser
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // optimized resolution
      analyserRef.current = analyser;

      // Stream → source → analyser
      let source: MediaStreamAudioSourceNode;
      try {
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
      } catch (err) {
        console.warn("AudioFeedPlane: Cannot connect stream to analyser:", err);
        return;
      }

      // Create CanvasTexture if missing
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

      // Drawing loop
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        rafRef.current = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barW = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 255;
          const h = v * canvas.height;
          ctx.fillStyle = `rgba(0, 224, 255, ${0.2 + v * 0.8})`;
          ctx.fillRect(x, canvas.height - h, barW, h);
          x += barW + 1;
        }

        if (texture) texture.needsUpdate = true;
      };

      draw();
    },
    [texture]
  );

  // ----------------------------------------------------------
  // LOCAL mic preview
  // ----------------------------------------------------------
  useEffect(() => {
    if (peerId !== "self") return;
    if (!msc.localMicStream) return;

    console.log("🎤 AudioFeedPlane: Attaching LOCAL mic stream");
    attachStreamToAnalyser(msc.localMicStream);
  }, [peerId, msc.localMicStream, attachStreamToAnalyser]);

  // ----------------------------------------------------------
  // REMOTE audio via Mediasoup
  // ----------------------------------------------------------
  useEffect(() => {
    if (!msc) return;

    console.log("🔌 AudioFeedPlane: Binding onNewStream for audio for", peerId);
    const orig = msc.onNewStream;

    msc.onNewStream = (stream: MediaStream, id: string, mediaTag?: string) => {
      // Prefer explicit tag from mediasoup
      if (id === peerId && mediaTag === "mic") {
        console.log("🎧 Remote MIC stream received — attaching");
        attachStreamToAnalyser(stream);
      }

      // Backwards-compatible fallback (in case server hasn’t sent mediaTag)
      else if (id === peerId && stream.getAudioTracks().length > 0) {
        console.log("🎧 Remote audio (legacy) — attaching");
        attachStreamToAnalyser(stream);
      }

      if (orig) orig(stream, id, mediaTag);
    };

    return () => {
      msc.onNewStream = orig;
    };
  }, [msc, peerId, attachStreamToAnalyser]);

  // ----------------------------------------------------------
  // Debug overlay UI
  // ----------------------------------------------------------
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

  return (
    <>
      {/* Hidden canvas */}
      <Html portal={{ current: document.body }}>
        <canvas
          ref={canvasRef}
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

      {/* Shadow frame */}
      <ImagePlane
        name={`${name}-ShadowFrame`}
        width={width}
        height={height}
        position={position}
        rotation={rotation}
        scale={scale}
        z={baseZ}
        castShadow
        receiveShadow={false}
        visible={visible}
      />

      {/* Visualizer */}
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
