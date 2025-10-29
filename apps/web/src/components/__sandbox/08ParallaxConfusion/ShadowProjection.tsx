import React, { useEffect, useRef } from "react";
import { useParallaxScene } from "./ParallaxScene";
import { useParallaxLight } from "./ParallaxLight";

/**
 * ShadowProjection
 * -------------------------------------------------------------------
 * Global inter-object shadow compositor.
 * Draws dynamic, depth-aware shadows for all ParallaxItems.
 * Canvas lives above the scene (multiply blend mode).
 */
const ShadowProjection: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { items, vw, vh } = useParallaxScene();
  const { x: lx, y: ly, intensity, color } = useParallaxLight();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -----------------------------
    //  Prepare canvas
    // -----------------------------
    canvas.width = vw;
    canvas.height = vh;
    ctx.clearRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = "source-over";

    // Test marker (helps confirm paint visibility)
    // ctx.fillStyle = "rgba(0,0,0,0.3)";
    // ctx.fillRect(50, 50, 100, 100);

    // -----------------------------
    //  Sort and draw
    // -----------------------------
    const sorted = [...items].sort((a, b) => b.depth - a.depth);

    for (const caster of sorted) {
      const casterEl = caster.ref.current;
      if (!casterEl) continue;

      const rect = casterEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Draw shadows on all receivers below this caster
      for (const receiver of items.filter((i) => i.depth < caster.depth)) {
        const receiverEl = receiver.ref.current;
        if (!receiverEl) continue;

        const rRect = receiverEl.getBoundingClientRect();
        const delta = caster.depth - receiver.depth;

        // ---------------------------------
        //  Shadow physics
        // ---------------------------------
        const offset = 8 * delta * intensity; // distance from caster
        const blur = 2 + delta * 6; // softness
        const baseOpacity = Math.min(0.6, 0.45 / delta); // fade with distance
        const contactBoost = delta < 1.5 ? 1.6 : 1; // darker if close
        const opacity = baseOpacity * contactBoost;

        // light direction
        const sx = -lx * offset;
        const sy = -ly * offset;

        // ---------------------------------
        //  Draw shadow
        // ---------------------------------
        ctx.save();
        // Clip so this shadow only darkens the receiver's area
        ctx.beginPath();
        ctx.rect(rRect.left, rRect.top, rRect.width, rRect.height);
        ctx.clip();

        ctx.filter = `blur(${blur}px)`;
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = color || "rgba(0, 0, 0, 1)";

        ctx.beginPath();
        ctx.ellipse(
          cx + sx,
          cy + sy,
          rect.width / 2,
          rect.height / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
      }
    }

    // reset
    ctx.globalCompositeOperation = "source-over";
  }, [items, vw, vh, lx, ly, intensity, color]);

  // -----------------------------
  //  Canvas Element
  // -----------------------------
  return (
    <canvas
      ref={canvasRef}
      data-shadow-projection
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 1000,
        background: "transparent",
      }}
    />
  );
};

export default ShadowProjection;
