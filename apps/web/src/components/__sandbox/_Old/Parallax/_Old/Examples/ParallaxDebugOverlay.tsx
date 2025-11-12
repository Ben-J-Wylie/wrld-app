// @ts-nocheck

// src/containers/Parallax/ParallaxDebugOverlay.tsx

import React, { useEffect, useState } from "react";
import { parallaxRAFManager } from "./ParallaxRAFManager";

/**
 * A lightweight overlay showing:
 * - Current FPS (smoothed)
 * - Number of active ParallaxItem subscribers
 * - Visual heartbeat for active updates
 */

export default function ParallaxDebugOverlay() {
  const [fps, setFps] = useState(0);
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let last = performance.now();
    let frames = 0;
    let fpsTimer: number;
    let active = true;

    const update = () => {
      if (!active) return;
      const now = performance.now();
      frames++;
      const delta = now - last;
      if (delta >= 1000) {
        setFps(Math.round((frames * 1000) / delta));
        frames = 0;
        last = now;
      }

      // Pulse visual to show updates
      setPulse((p) => !p);

      // Reflect live subscriber count
      setCount((parallaxRAFManager as any).subscribers.size || 0);

      fpsTimer = requestAnimationFrame(update);
    };

    update();
    return () => {
      active = false;
      cancelAnimationFrame(fpsTimer);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "10px",
        right: "10px",
        background: "rgba(0,0,0,0.6)",
        color: "#0ff",
        fontSize: "12px",
        fontFamily: "monospace",
        padding: "6px 10px",
        borderRadius: "8px",
        zIndex: 9999,
        userSelect: "none",
        pointerEvents: "none",
        border: "1px solid rgba(0,255,255,0.3)",
      }}
    >
      <div>
        FPS: <span style={{ color: fps < 30 ? "#f55" : "#0f0" }}>{fps}</span>
      </div>
      <div>Items: {count}</div>
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: pulse ? "#0ff" : "#055",
          marginTop: "4px",
          transition: "background 0.1s",
        }}
      ></div>
    </div>
  );
}
