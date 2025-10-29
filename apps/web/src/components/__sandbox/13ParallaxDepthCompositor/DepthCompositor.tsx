import React, { useEffect, useRef } from "react";
import { useParallaxScene } from "./ParallaxScene";
import { useParallaxLight } from "./ParallaxLight";

const DepthCompositor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { items, vw, vh } = useParallaxScene();
  const { x: lx, y: ly, intensity, color } = useParallaxLight();

  // ---- Tunables ----
  const OFFSET_SCALE = 12;
  const BLUR_BASE = 6;
  const ALPHA_BASE = 0.4;
  const ALPHA_DECAY = 0.6;
  const SHAPE_SHRINK = 0.85;

  const ellipseFromRect = (
    ctx: CanvasRenderingContext2D,
    r: DOMRect,
    shrink = 1,
    dx = 0,
    dy = 0
  ) => {
    const cx = r.x + r.width / 2 + dx;
    const cy = r.y + r.height / 2 + dy;
    const rx = (r.width / 2) * shrink;
    const ry = (r.height / 2) * shrink;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = vw;
    canvas.height = vh;

    const params = new URLSearchParams(window.location.search);
    const DEBUG = params.get("debug") === "1";

    // 🔹 hash generator to throttle redraws
    const makeHash = () => {
      let h = `${lx.toFixed(2)}|${ly.toFixed(2)}|${intensity.toFixed(
        2
      )}|${color}`;
      for (const it of items) {
        if (!it.rect) continue;
        h += `|${it.id}:${it.depth.toFixed(2)}:${it.rect.x.toFixed(
          1
        )},${it.rect.y.toFixed(1)},${it.rect.width.toFixed(
          1
        )},${it.rect.height.toFixed(1)}`;
      }
      return h;
    };

    let lastHash = "";
    let raf = 0;

    const drawFrame = () => {
      const currentHash = makeHash();
      const dirty = currentHash !== lastHash;
      if (!dirty) {
        raf = requestAnimationFrame(drawFrame);
        return;
      }
      lastHash = currentHash;

      ctx.clearRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = "multiply";

      const sorted = [...items].sort((a, b) => b.depth - a.depth);
      const norm = Math.hypot(lx, ly) || 1;
      const nx = lx / norm;
      const ny = ly / norm;

      // ======= TRUE INTER-OBJECT SHADOWS =======
      for (let i = 0; i < sorted.length; i++) {
        const caster = sorted[i];
        const cRect = caster.rect;
        if (!cRect) continue;

        // Cast onto every deeper receiver
        for (let j = i + 1; j < sorted.length; j++) {
          const receiver = sorted[j];
          const rRect = receiver.rect;
          if (!rRect) continue;

          const dz = caster.depth - receiver.depth;
          if (dz <= 0) continue;

          const offset = OFFSET_SCALE * Math.pow(dz, 1.2);
          const blur = BLUR_BASE + Math.pow(dz, 1.4) * 2;
          const alpha = (ALPHA_BASE * intensity) / (1 + dz * dz * ALPHA_DECAY);
          if (alpha < 0.01) continue;

          const sx = -nx * offset * intensity;
          const sy = -ny * offset * intensity;

          ctx.save();
          // clip to receiver’s bounds so only overlapping part is drawn
          ctx.beginPath();
          ctx.rect(rRect.x, rRect.y, rRect.width, rRect.height);
          ctx.clip();

          ctx.filter = `blur(${blur}px)`;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "black";
          ellipseFromRect(ctx, cRect, SHAPE_SHRINK, sx, sy);
          ctx.fill();
          ctx.restore();
        }

        // Also cast onto background (depth 0)
        const dzBg = caster.depth;
        if (dzBg > 0) {
          const offsetBg = OFFSET_SCALE * Math.pow(dzBg, 1.2);
          const blurBg = BLUR_BASE + Math.pow(dzBg, 1.4) * 2;
          const alphaBg =
            (ALPHA_BASE * intensity) / (1 + dzBg * dzBg * ALPHA_DECAY);
          if (alphaBg > 0.01) {
            const sx = -nx * offsetBg * intensity;
            const sy = -ny * offsetBg * intensity;
            ctx.save();
            ctx.filter = `blur(${blurBg}px)`;
            ctx.globalAlpha = alphaBg;
            ctx.fillStyle = "black";
            ellipseFromRect(ctx, cRect, SHAPE_SHRINK, sx, sy);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // ======= DEBUG OVERLAYS =======
      if (DEBUG) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "rgba(255,255,0,0.6)";
        ctx.lineWidth = 2;
        const cx = vw / 2;
        const cy = vh / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + nx * 50, cy + ny * 50);
        ctx.stroke();
        ctx.restore();
      }

      raf = requestAnimationFrame(drawFrame);
    };

    drawFrame();
    return () => cancelAnimationFrame(raf);
  }, [items, vw, vh, lx, ly, intensity, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 999,
        mixBlendMode: "multiply",
      }}
    />
  );
};

export default DepthCompositor;
