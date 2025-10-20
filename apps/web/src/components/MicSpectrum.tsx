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

    // 🧹 Always stop any existing analyzer before creating a new one
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
    }

    // 🎧 Choose the correct audio stream
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
      console.warn(`⚠️ No valid audio stream for ${peer.displayName}`);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      console.warn(`⚠️ Stream has no audio tracks for ${peer.displayName}`);
      return;
    }

    const audioTrack = audioTracks[0];

    // 🕐 Wait until the audio track is live and ready
    let retries = 20; // 2 seconds max (20 * 100ms)
    const waitForLiveTrack = async (): Promise<boolean> => {
      while (retries > 0) {
        if (
          audioTrack.readyState === "live" &&
          audioTrack.enabled &&
          !audioTrack.muted
        ) {
          return true;
        }
        await new Promise((r) => setTimeout(r, 100));
        retries--;
      }
      return false;
    };

    (async () => {
      const ready = await waitForLiveTrack();
      if (!ready) {
        console.warn(
          `⚠️ Audio track never became live for ${peer.displayName}`
        );
        return;
      }

      // 🧠 Setup AudioContext + Analyser
      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      // 👂 Connect MediaStreamSource
      let source: MediaStreamAudioSourceNode | null = null;
      try {
        source = audioCtx.createMediaStreamSource(stream!);
        source.connect(analyser);
        sourceRef.current = source;
      } catch (err) {
        console.warn("⚠️ Could not connect stream to analyser:", err);
        return;
      }

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastDraw = performance.now();

      const draw = (now: number) => {
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

        // optional average level line
        const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        ctx.fillStyle = "rgba(0,255,200,0.25)";
        ctx.fillRect(0, canvas.height - avg / 2, canvas.width, 2);
      };

      draw(performance.now());

      // 🔊 Resume audioCtx if suspended (tab switch / user gesture)
      const handleResume = () => {
        if (audioCtx.state === "suspended") audioCtx.resume();
      };
      document.addEventListener("click", handleResume);
      document.addEventListener("keydown", handleResume);

      // 🧹 Cleanup
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        try {
          source?.disconnect();
          analyser.disconnect();
          audioCtx.close();
        } catch {}
        document.removeEventListener("click", handleResume);
        document.removeEventListener("keydown", handleResume);
      };
    })();
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
