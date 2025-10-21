import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import "../../_main/main.css";

export default function PreviewTorch() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chartRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const dataRef = useRef<number[]>([]);
  const timeRef = useRef<string[]>([]);
  const intervalRef = useRef<number | null>(null);

  // Init torch control
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        const caps: any = track.getCapabilities?.();
        if (caps && "torch" in caps) {
          setSupported(true);
        } else {
          setSupported(false);
        }
      } catch (err: any) {
        setError(err?.message || "Torch not available.");
        setSupported(false);
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Initialize Chart.js
  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Torch",
            data: [],
            borderColor: "rgba(0,224,255,1)",
            backgroundColor: "rgba(0,224,255,0.15)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          y: { min: 0, max: 1, ticks: { stepSize: 1 } },
          x: { ticks: { maxTicksLimit: 6 } },
        },
        plugins: { legend: { display: false } },
      },
    });

    intervalRef.current = window.setInterval(() => {
      const ts = new Date();
      const label = ts.toLocaleTimeString([], {
        minute: "2-digit",
        second: "2-digit",
      });
      timeRef.current.push(label);
      dataRef.current.push(torchOn ? 1 : 0);

      if (timeRef.current.length > 10) {
        timeRef.current.shift();
        dataRef.current.shift();
      }

      const ch = chartRef.current!;
      ch.data.labels = [...timeRef.current];
      ch.data.datasets[0].data = [...dataRef.current];
      ch.update();
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      chartRef.current?.destroy();
    };
  }, [torchOn]);

  const setTorch = async (on: boolean) => {
    try {
      const track = trackRef.current;
      if (!track) return;
      // @ts-ignore non-standard API
      await track.applyConstraints({ advanced: [{ torch: on }] });
      setTorchOn(on);
    } catch (e: any) {
      setError(e?.message || "Failed to toggle torch.");
    }
  };

  return (
    <div className="preview-torch">
      {supported ? (
        <>
          <div className="torch-controls">
            <button
              className={`form-button ${torchOn ? "secondary" : ""}`}
              onClick={() => setTorch(!torchOn)}
            >
              {torchOn ? "Turn Torch Off" : "Turn Torch On"}
            </button>
          </div>
          <canvas ref={canvasRef} className="preview-canvas" height={120} />
        </>
      ) : (
        <div className="torch-unsupported">
          <p>Torch control not supported on this device/browser.</p>
          {error && <div className="error-text">{error}</div>}
          <canvas ref={canvasRef} className="preview-canvas" height={120} />
        </div>
      )}
    </div>
  );
}
