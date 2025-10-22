// apps/web/src/components/MicSpectrum.tsx
import React, { useEffect, useRef } from "react";
import { socket } from "../lib/socket";

interface MicSpectrumProps {
  peer: any;
}

export default function MicSpectrum({ peer }: MicSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!peer) return;

    // 🔇 Clean up any old analyser/context
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      try {
        audioCtxRef.current.close();
      } catch (err) {
        console.warn("AudioContext cleanup error:", err);
      }
    }

    // 🎧 Pick the correct audio stream
    let stream: MediaStream | null = null;
    if (peer?.id === socket.id) {
      stream = (window as any).localStreamRef || null;
    } else if (peer?.audioStream instanceof MediaStream) {
      stream = peer.audioStream;
    } else if (peer?.stream instanceof MediaStream) {
      stream = peer.stream;
    }

    console.log("🎧 MicSpectrum init for", peer.displayName, stream);

    if (!stream) {
      console.warn(
        `⚠️ No valid audio stream for ${peer.displayName} (id: ${peer.id})`
      );
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      console.warn(`⚠️ Stream has no audio tracks for ${peer.displayName}`);
      return;
    }

    const audioTrack = audioTracks[0];
    let active = true; // used to stop retries on unmount

    // 🕐 Wait until the audio track is live and ready
    const waitForLiveTrack = async (): Promise<boolean> => {
      for (let i = 0; i < 20; i++) {
        if (!active) return false;
        if (
          audioTrack.readyState === "live" &&
          audioTrack.enabled &&
          !audioTrack.muted
        ) {
          return true;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    };

    const setup = async () => {
      const ready = await waitForLiveTrack();
      if (!ready || !active) {
        console.warn(
          `⚠️ Audio track never became live for ${peer.displayName}`
        );
        return;
      }

      // 🎚️ Create AudioContext + Analyser
      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      // 🎛️ Connect MediaStreamSource
      try {
        const source = audioCtx.createMediaStreamSource(stream!);
        source.connect(analyser);
        sourceRef.current = source;
      } catch (err) {
        console.warn("⚠️ Could not connect stream to analyser:", err);
        return;
      }

      // 🖼️ Setup drawing
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastDraw = performance.now();

      const draw = (now: number) => {
        if (!active) return;
        rafRef.current = requestAnimationFrame(draw);
        if (now - lastDraw < 33) return; // ~30fps
        lastDraw = now;

        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.6;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 255;
          const h = v * canvas.height;
          ctx.fillStyle = `rgba(0, 224, 255, ${0.2 + v * 0.8})`;
          ctx.fillRect(x, canvas.height - h, barWidth, h);
          x += barWidth + 1;
        }

        // Optional average level line
        const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        ctx.fillStyle = "rgba(0,255,200,0.25)";
        ctx.fillRect(0, canvas.height - avg / 2, canvas.width, 2);
      };

      draw(performance.now());

      // 🧩 Resume audio context on user gesture
      const handleResume = () => {
        if (audioCtx.state === "suspended") audioCtx.resume();
      };
      document.addEventListener("click", handleResume);
      document.addEventListener("keydown", handleResume);

      // ✅ Proper cleanup returned to React
      return () => {
        active = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        try {
          sourceRef.current?.disconnect();
          analyser.disconnect();
          if (audioCtx.state !== "closed") audioCtx.close();
        } catch (err) {
          console.warn("Cleanup error:", err);
        }
        document.removeEventListener("click", handleResume);
        document.removeEventListener("keydown", handleResume);
      };
    };

    // ⚙️ Run setup
    const teardownPromise = setup();

    // ✅ Return proper cleanup
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      teardownPromise.then((cleanup) => cleanup?.());
    };
  }, [peer?.id, peer?.audioStream]);

  return (
    <div
      className="mic-spectrum"
      style={{
        position: "relative",
        width: "100%",
        textAlign: "center",
        marginBottom: "1rem",
      }}
    >
      <p style={{ fontSize: "0.9rem", color: "#0ff", marginBottom: "0.5rem" }}>
        🎤 Listening to {peer.displayName || peer.name || "peer"}'s mic…
      </p>
      <canvas
        ref={canvasRef}
        width={300}
        height={100}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(0,0,0,0.4)",
          borderRadius: 8,
          border: "1px solid rgba(0,255,255,0.3)",
          display: "block",
          margin: "0 auto",
        }}
      />
    </div>
  );
}
