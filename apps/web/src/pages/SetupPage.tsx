import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Video,
  Mic,
  MapPin,
  ScreenShare,
  RotateCw,
  Lightbulb,
  Power,
} from "lucide-react";
import L, { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import Chart from "chart.js/auto";
import "../App.css";

type Toggles = {
  frontCamera: boolean;
  backCamera: boolean;
  mic: boolean;
  location: boolean;
  screenShare: boolean;
  gyro: boolean;
  torch: boolean;
};

export default function SetupPage() {
  const [settings, setSettings] = useState<Toggles>({
    frontCamera: false,
    backCamera: false,
    mic: false,
    location: false,
    screenShare: false,
    gyro: false,
    torch: false,
  });

  const [isLive, setIsLive] = useState(false);

  const toggle = (key: keyof Toggles) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      // single camera enforcement
      if (key === "frontCamera" && updated.frontCamera)
        updated.backCamera = false;
      if (key === "backCamera" && updated.backCamera)
        updated.frontCamera = false;
      return updated;
    });
  };

  const handleGoLive = () => {
    if (!hasAnyEnabled) return;
    setIsLive((prev) => !prev);
  };

  // ✅ disable Go Live unless one toggle is active
  const hasAnyEnabled = Object.values(settings).some(Boolean);

  return (
    <div className="setup-container">
      <div className="setup-header">
        <button
          className={`go-live-button ${isLive ? "active" : ""}`}
          onClick={handleGoLive}
          disabled={!hasAnyEnabled}
        >
          <Power size={20} />
          {isLive ? "End Stream" : "Go Live"}
        </button>

        <h1 className="setup-title">Setup Your Stream</h1>
        <p className="setup-subtitle">
          Choose what you’ll share before going live.
        </p>
      </div>

      <div className="toggle-grid">
        <FeatureCard
          label="Front Camera"
          icon={<Camera />}
          active={settings.frontCamera}
          onClick={() => toggle("frontCamera")}
          preview={settings.frontCamera && <CameraPreview facing="user" />}
        />

        <FeatureCard
          label="Back Camera"
          icon={<Video />}
          active={settings.backCamera}
          onClick={() => toggle("backCamera")}
          preview={
            settings.backCamera && <CameraPreview facing="environment" />
          }
        />

        <FeatureCard
          label="Microphone"
          icon={<Mic />}
          active={settings.mic}
          onClick={() => toggle("mic")}
          preview={settings.mic && <MicFFTPreview />}
        />

        <FeatureCard
          label="Screen Share"
          icon={<ScreenShare />}
          active={settings.screenShare}
          onClick={() => toggle("screenShare")}
          preview={settings.screenShare && <ScreenSharePreview />}
        />

        <FeatureCard
          label="Location"
          icon={<MapPin />}
          active={settings.location}
          onClick={() => toggle("location")}
          preview={settings.location && <LocationPreview />}
        />

        <FeatureCard
          label="Gyroscope"
          icon={<RotateCw />}
          active={settings.gyro}
          onClick={() => toggle("gyro")}
          preview={settings.gyro && <GyroPreview />}
        />

        <FeatureCard
          label="Torch"
          icon={<Lightbulb />}
          active={settings.torch}
          onClick={() => toggle("torch")}
          preview={settings.torch && <TorchPreview />}
        />
      </div>

      <div className="go-live-wrapper">
        <button
          className={`go-live-button ${isLive ? "active" : ""}`}
          onClick={handleGoLive}
        >
          <Power size={20} />
          {isLive ? "End Stream" : "Go Live"}
        </button>
      </div>
    </div>
  );
}

/* -----------------------------
   Feature Card shell
------------------------------ */
function FeatureCard({
  icon,
  label,
  active,
  onClick,
  preview,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  preview?: React.ReactNode;
}) {
  return (
    <div className={`feature-card ${active ? "active" : ""}`}>
      <button
        className={`toggle-button ${active ? "active" : ""}`}
        onClick={onClick}
      >
        <span className="toggle-icon">{icon}</span>
        <span>{label}</span>
      </button>
      {active && <div className="preview">{preview}</div>}
    </div>
  );
}

/* -----------------------------
   Camera Preview (front/back)
------------------------------ */
function CameraPreview({ facing }: { facing: "user" | "environment" }) {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        streamRef.current = stream;
        if (vidRef.current) {
          vidRef.current.srcObject = stream;
          await vidRef.current.play();
        }
      } catch (e) {
        console.error("Camera error:", e);
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  return <video ref={vidRef} className="preview-video" playsInline muted />;
}

/* -----------------------------
   Mic FFT Preview (bars)
------------------------------ */
function MicFFTPreview() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        streamRef.current = stream;
        const ac = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        acRef.current = ac;
        const analyser = ac.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        const source = ac.createMediaStreamSource(stream);
        audioRef.current = source;
        source.connect(analyser);

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          rafRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = (canvas.width / bufferLength) * 1.8;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 255;
            const h = v * canvas.height;
            ctx.fillStyle = `rgba(0, 224, 255, ${0.2 + v * 0.8})`;
            ctx.fillRect(x, canvas.height - h, barWidth, h);
            x += barWidth + 1;
          }
        };
        draw();
      } catch (e) {
        console.error("Mic error:", e);
      }
    })();

    return () => {
      rafRef.current && cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      acRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <canvas
      className="preview-canvas"
      ref={canvasRef}
      width={420}
      height={140}
    />
  );
}

/* -----------------------------
   Screen Share Preview
------------------------------ */
function ScreenSharePreview() {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true,
          audio: false,
        });
        streamRef.current = stream;
        if (vidRef.current) {
          vidRef.current.srcObject = stream;
          await vidRef.current.play();
        }
      } catch (e) {
        console.error("Screen share error:", e);
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return <video ref={vidRef} className="preview-video" playsInline muted />;
}

/* -----------------------------
   Location Preview (Leaflet)
------------------------------ */
function LocationPreview() {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Init map and geolocation
  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [0, 0],
        zoom: 2,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(mapRef.current);
    }

    const onPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const latlng: [number, number] = [latitude, longitude];
      mapRef.current?.setView(latlng, 14);
      if (!markerRef.current) {
        markerRef.current = L.marker(latlng).addTo(mapRef.current!);
      } else {
        markerRef.current.setLatLng(latlng);
      }
    };

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onPosition,
        undefined,
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
        }
      );
    }

    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Handle expand/collapse + map resizing
  useEffect(() => {
    if (!mapRef.current) return;
    // wait a frame to ensure CSS transition has applied
    const timeout = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 300); // matches your CSS transition duration

    return () => clearTimeout(timeout);
  }, [expanded]);

  // Collapse when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  return (
    <>
      <div
        ref={containerRef}
        className={`preview-map ${expanded ? "expanded" : ""}`}
      >
        <button
          className="map-expand-btn"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? "×" : "⤢"}
        </button>
      </div>

      {expanded && <div className="map-overlay" />}
    </>
  );
}

/* -----------------------------
   Torch Preview (status + chart)
   - Attempts to toggle device torch (mobile) if supported.
   - Shows rolling 10s 0/1 line with Chart.js
------------------------------ */
function TorchPreview() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef<number[]>([]);
  const timeRef = useRef<string[]>([]);
  const intervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  // init chart
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
            tension: 0.2,
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

    // rolling 10s buffer
    intervalRef.current = window.setInterval(() => {
      const ts = new Date();
      const label = ts.toLocaleTimeString([], {
        minute: "2-digit",
        second: "2-digit",
      });
      timeRef.current.push(label);
      dataRef.current.push(torchOn ? 1 : 0);

      // keep ~10 points @ 1Hz
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

  // attempt to init torch control
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
      } catch (e: any) {
        setSupported(false);
        setError(e?.message || "Torch not available.");
      }
    })();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const setTorch = async (on: boolean) => {
    try {
      const track = trackRef.current;
      if (!track) return;
      // @ts-ignore - non-standard API
      await track.applyConstraints({ advanced: [{ torch: on }] });
      setTorchOn(on);
    } catch (e: any) {
      setError(e?.message || "Failed to set torch.");
    }
  };

  return (
    <div className="torch-preview">
      {supported ? (
        <>
          <div className="torch-controls">
            <button
              className={`form-button ${torchOn ? "" : "secondary"}`}
              onClick={() => setTorch(!torchOn)}
              type="button"
            >
              {torchOn ? "Turn Torch Off" : "Turn Torch On"}
            </button>
          </div>
          <canvas ref={canvasRef} className="preview-canvas" height={120} />
        </>
      ) : (
        <div className="hint">
          Torch control not supported on this device/browser.
          {error ? (
            <div className="error" style={{ marginTop: 6 }}>
              {error}
            </div>
          ) : null}
          <canvas ref={canvasRef} className="preview-canvas" height={120} />
        </div>
      )}
    </div>
  );
}

/* -----------------------------
   Gyro Preview (live values)
------------------------------ */
function GyroPreview() {
  const [alpha, setAlpha] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [needPerm, setNeedPerm] = useState(false);

  useEffect(() => {
    // iOS needs permission
    const anyDO = DeviceOrientationEvent as any;
    if (typeof anyDO?.requestPermission === "function") {
      setNeedPerm(true);
    } else {
      attach();
    }

    function onOrient(e: DeviceOrientationEvent) {
      setAlpha(e.alpha ?? 0);
      setBeta(e.beta ?? 0);
      setGamma(e.gamma ?? 0);
    }

    function attach() {
      window.addEventListener("deviceorientation", onOrient);
    }

    return () => {
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  async function requestPerm() {
    try {
      const anyDO = DeviceOrientationEvent as any;
      const res = await anyDO.requestPermission();
      if (res === "granted") {
        setNeedPerm(false);
        window.addEventListener("deviceorientation", (e) => {
          setAlpha(e.alpha ?? 0);
          setBeta(e.beta ?? 0);
          setGamma(e.gamma ?? 0);
        });
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="gyro-box">
      {needPerm ? (
        <button className="form-button" onClick={requestPerm} type="button">
          Enable Motion Access
        </button>
      ) : (
        <>
          <div>α (yaw): {alpha?.toFixed(1)}</div>
          <div>β (pitch): {beta?.toFixed(1)}</div>
          <div>γ (roll): {gamma?.toFixed(1)}</div>
        </>
      )}
    </div>
  );
}
