// // ShadowProjection.tsx (conceptual prototype)
// import React, { useEffect, useRef } from "react";
// import { useParallaxScene } from "./ParallaxScene";
// import { useParallaxLight } from "./ParallaxLight";
// import { useParallaxDepth } from "./ParallaxDepthController";

// export const ShadowProjection: React.FC = () => {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const { items, vw, vh } = useParallaxScene();
//   const { x: lx, y: ly, intensity, color } = useParallaxLight();
//   const { focalDepth } = useParallaxDepth();

//   useEffect(() => {
//     const canvas = canvasRef.current;

//     console.log("🟣 ShadowProjection effect running", {
//       vw,
//       vh,
//       itemsCount: items.length,
//     });

//     if (!canvas) return;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;

//     canvas.width = vw;
//     canvas.height = vh;

//     // 1️⃣ Base for multiply
//     ctx.globalCompositeOperation = "source-over";
//     ctx.fillStyle = "#fff";
//     ctx.fillRect(0, 0, vw, vh);

//     // 2️⃣ Switch to multiply for shadows
//     ctx.globalCompositeOperation = "multiply";

//     // 3️⃣ Draw obvious debug shadow
//     ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
//     ctx.fillRect(100, 100, 200, 200); // should see dark square

//     // Draw only on receivers with depth == focalDepth
//     const receivers = items.filter((i) => i.depth === 0);
//     const casters = items.filter((i) => i.depth > 0);

//     for (const recv of receivers) {
//       for (const cast of casters) {
//         const relDepth = cast.depth - recv.depth;
//         const offset = relDepth * 10;
//         const blur = 2 + relDepth * 4;
//         const alpha = Math.max(0, 0.6 - relDepth * 0.1);

//         const sx = -lx * offset * intensity;
//         const sy = -ly * offset * intensity;

//         const shadowColor = `rgba(0,0,0,${alpha})`; // simple black for testing

//         ctx.filter = `blur(${blur}px)`;
//         ctx.fillStyle = shadowColor;
//         const r = cast.rect;
//         ctx.fillRect(r.x + sx, r.y + sy, r.width, r.height);
//       }
//     }
//     ctx.filter = "none";
//     console.log(
//       "ShadowProjection items:",
//       items.map((i) => ({ depth: i.depth, rect: i.rect }))
//     );

//     ctx.filter = "none";
//   }, [items, vw, vh, lx, ly, intensity, color, focalDepth]);

//   return (
//     <canvas
//       ref={canvasRef}
//       style={{
//         position: "fixed",
//         top: 0,
//         left: 0,
//         width: "100vw",
//         height: "100vh",
//         pointerEvents: "none",
//         zIndex: 9999, // 🔥 bring to front
//         background: "rgba(255,255,255,0.1)", // 🔥 debug visibility
//       }}
//     />
//   );
// };

// export default ShadowProjection;

import React, { useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { useParallaxScene } from "./ParallaxScene";
import { useParallaxLight } from "./ParallaxLight";
import { useParallaxDepth } from "./ParallaxDepthController";

/**
 * ShadowProjection (with lazy html2canvas caching)
 * --------------------------------------------------------------
 * Renders accurate, cached shadows using asynchronous DOM snapshots.
 */
const ShadowProjection: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());

  const { items, vw, vh } = useParallaxScene();
  const { x: lx, y: ly, intensity } = useParallaxLight();
  const { focalDepth } = useParallaxDepth();

  // 🧠 Polyfill for Safari
  const requestIdle = (cb: IdleRequestCallback) =>
    (window.requestIdleCallback || ((fn: any) => setTimeout(fn, 40)))(cb);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = vw;
    canvas.height = vh;

    // Base white fill
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff";
    ctx.clearRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = "source-over";

    const receivers = items.filter((i) => i.depth === focalDepth);
    const casters = items.filter((i) => i.depth > focalDepth);

    const drawCachedShadow = (
      snapshot: HTMLCanvasElement,
      rect: DOMRect,
      offsetX: number,
      offsetY: number,
      blur: number,
      alpha: number
    ) => {
      ctx.save();
      ctx.filter = `blur(${blur}px)`;
      ctx.globalAlpha = alpha;
      ctx.drawImage(snapshot, rect.x + offsetX, rect.y + offsetY);
      ctx.restore();
    };

    const makeSnapshot = async (id: string, el: HTMLElement) => {
      // Avoid re-processing if one is already queued
      if (pendingRef.current.has(id)) return;
      pendingRef.current.add(id);

      const rect = el.getBoundingClientRect();
      try {
        const snapshot = await html2canvas(el, {
          backgroundColor: null,
          useCORS: true,
          scale: 0.6, // reduce res for speed
        });
        cacheRef.current.set(id, snapshot);
      } catch (err) {
        console.warn("Snapshot failed for", id, err);
      } finally {
        pendingRef.current.delete(id);
      }
    };

    (async () => {
      for (const recv of receivers) {
        for (const cast of casters) {
          const relDepth = cast.depth - recv.depth;
          const offset = relDepth * 10;
          const blur = 4 + relDepth * 6;
          const alpha = Math.max(0, 0.5 - relDepth * 0.1);

          const sx = -lx * offset * intensity;
          const sy = -ly * offset * intensity;
          const rect = cast.rect;
          const id = cast.id;

          const cache = cacheRef.current;
          const snapshot = cache.get(id);

          if (snapshot) {
            drawCachedShadow(snapshot, rect, sx, sy, blur, alpha);
          } else {
            // Schedule snapshot lazily
            requestIdle(() => makeSnapshot(id, cast.element));
          }
        }
      }
    })();
  }, [items, vw, vh, lx, ly, intensity, focalDepth]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
};

export default ShadowProjection;
