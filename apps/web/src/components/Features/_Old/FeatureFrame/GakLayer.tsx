import React, { useEffect, useRef } from "react";
import "./GakLayer.css";

interface GakLayerProps {
  intensity?: number; // 0-1 for animation density
}

export function GakLayer({ intensity = 0.5 }: GakLayerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dots = Array.from(el.querySelectorAll(".gak-dot"));
    dots.forEach((dot) => {
      const duration = 4 + Math.random() * 6;
      (dot as HTMLElement).style.animationDuration = `${duration}s`;
    });
  }, []);

  const dots = Array.from({ length: Math.floor(30 * intensity) });

  return (
    <div ref={ref} className="gak-layer">
      <div className="gak-grid"></div>
      {dots.map((_, i) => (
        <div
          key={i}
          className="gak-dot"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}
