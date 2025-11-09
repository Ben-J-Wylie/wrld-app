import React, { useEffect, useState } from "react";
import "../../_main/main.css";

export default function PreviewGyro() {
  const [alpha, setAlpha] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [needPerm, setNeedPerm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const anyDO = DeviceOrientationEvent as any;

    if (typeof anyDO?.requestPermission === "function") {
      // iOS requires explicit permission
      setNeedPerm(true);
    } else {
      attachListeners();
    }

    function handleOrientation(e: DeviceOrientationEvent) {
      setAlpha(e.alpha ?? 0);
      setBeta(e.beta ?? 0);
      setGamma(e.gamma ?? 0);
    }

    function attachListeners() {
      try {
        window.addEventListener("deviceorientation", handleOrientation);
      } catch (err: any) {
        setError("Device orientation not supported.");
      }
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
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
      } else {
        setError("Permission denied.");
      }
    } catch (err) {
      setError("Permission request failed.");
    }
  }

  return (
    <div className="preview-gyro">
      {needPerm ? (
        <button className="form-button" onClick={requestPerm}>
          Enable Motion Access
        </button>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : (
        <div className="gyro-values">
          <div>α (yaw): {alpha?.toFixed(1)}</div>
          <div>β (pitch): {beta?.toFixed(1)}</div>
          <div>γ (roll): {gamma?.toFixed(1)}</div>
        </div>
      )}
    </div>
  );
}
