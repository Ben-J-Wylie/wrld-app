// /**
//  * DomSurface.tsx
//  * ------------------------------------------------------------
//  * Renders arbitrary React DOM content offscreen, rasterizes it
//  * into a <canvas> using html2canvas, and exposes a
//  * THREE.CanvasTexture for use on 3D geometry.
//  *
//  * Strategy:
//  * - Render DOM in a hidden but layout-participating container
//  * - Use html2canvas to rasterize that container into a bitmap
//  * - Draw bitmap into our own <canvas>
//  * - Lazily create a THREE.CanvasTexture the first time we have
//  *   a valid canvas, and reuse it thereafter
//  * - Update the same texture on every change (no reallocation)
//  *
//  * This avoids:
//  * - WebGL glCopySubTextureCHROMIUM errors
//  * - Mismatched sizes between GPU texture and source canvas
//  * - Needing to recreate textures inside consumers (ImagePlane)
//  * ------------------------------------------------------------
//  */

// import React, { useEffect, useRef, useState } from "react";
// import * as THREE from "three";
// import html2canvas from "html2canvas";

// export interface DomSurfaceAPI {
//   texture: THREE.Texture | null;
//   width: number;
//   height: number;
//   update: () => Promise<void>;
//   dispose: () => void;
// }

// interface DomSurfaceProps {
//   content?: React.ReactNode;
//   onReady?: (api: DomSurfaceAPI) => void;
//   background?: string;
//   pixelRatio?: number;
// }

// export function DomSurface({
//   content,
//   onReady,
//   background = "transparent",
//   pixelRatio = window.devicePixelRatio || 1,
// }: DomSurfaceProps) {
//   const containerRef = useRef<HTMLDivElement | null>(null);
//   const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);

//   const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
//   const apiRef = useRef<DomSurfaceAPI | null>(null);

//   const resizeObserverRef = useRef<ResizeObserver | null>(null);
//   const mutationObserverRef = useRef<MutationObserver | null>(null);

//   // Track last known layout size to avoid duplicate captures on no-op resizes
//   const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

//   // Prevent overlapping html2canvas runs; coalesce multiple requests
//   const isUpdatingRef = useRef(false);
//   const pendingUpdateRef = useRef(false);

//   // ------------------------------------------------------------
//   // Core updater: DOM → html2canvas → outputCanvas → CanvasTexture
//   // ------------------------------------------------------------
//   const updateTexture = async () => {
//     const container = containerRef.current;
//     const outputCanvas = outputCanvasRef.current;

//     if (!container || !outputCanvas) return;

//     // Concurrency guard: if we're already updating, just mark that
//     // another pass is needed and bail. We'll run again afterwards.
//     if (isUpdatingRef.current) {
//       pendingUpdateRef.current = true;
//       return;
//     }
//     isUpdatingRef.current = true;

//     try {
//       const w = container.offsetWidth;
//       const h = container.offsetHeight;

//       if (w === 0 || h === 0) {
//         return;
//       }

//       // --- Rasterize DOM via html2canvas ------------------------
//       const renderCanvas = await html2canvas(container, {
//         backgroundColor: null,
//         scale: pixelRatio,
//         useCORS: true,
//         ignoreElements: (el) => el instanceof HTMLCanvasElement,
//       });

//       if (renderCanvas.width === 0 || renderCanvas.height === 0) {
//         return;
//       }

//       // Normalize dimensions
//       const safeWidth = Math.max(1, Math.floor(renderCanvas.width));
//       const safeHeight = Math.max(1, Math.floor(renderCanvas.height));

//       // Resize our output canvas to match
//       outputCanvas.width = safeWidth;
//       outputCanvas.height = safeHeight;

//       const ctx = outputCanvas.getContext("2d", { willReadFrequently: true });
//       if (!ctx) return;

//       ctx.clearRect(0, 0, safeWidth, safeHeight);
//       ctx.drawImage(renderCanvas, 0, 0, safeWidth, safeHeight);

//       // --- Lazily create or update THREE.CanvasTexture ----------
//       let tex = texture;

//       if (!tex) {
//         // First-time creation
//         tex = new THREE.CanvasTexture(outputCanvas);
//         tex.minFilter = THREE.LinearFilter;
//         tex.magFilter = THREE.LinearFilter;
//         tex.needsUpdate = true;

//         setTexture(tex);

//         const api: DomSurfaceAPI = {
//           texture: tex,
//           width: w,
//           height: h,
//           update: updateTexture,
//           dispose: () => tex!.dispose(),
//         };

//         apiRef.current = api;
//         onReady?.(api);
//       } else {
//         // Subsequent updates reuse same texture & canvas
//         tex.needsUpdate = true;
//         // @ts-ignore: Three types may not know about .source
//         if (tex.source) tex.source.needsUpdate = true;

//         if (apiRef.current) {
//           apiRef.current.texture = tex;
//           apiRef.current.width = w;
//           apiRef.current.height = h;
//         }
//       }
//     } finally {
//       // Clear updating flag and run any pending update once on next frame
//       isUpdatingRef.current = false;
//       if (pendingUpdateRef.current) {
//         pendingUpdateRef.current = false;
//         requestAnimationFrame(() => {
//           updateTexture();
//         });
//       }
//     }
//   };

//   // Small helper so future call sites can be swapped easily
//   const requestUpdate = () => {
//     // We could add extra time-based throttling here if needed
//     updateTexture();
//   };

//   // ------------------------------------------------------------
//   // Initial capture and content-driven recapture
//   // ------------------------------------------------------------
//   useEffect(() => {
//     requestUpdate();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [content]);

//   // ------------------------------------------------------------
//   // Resize observer → recapture on size changes (deduped)
//   // ------------------------------------------------------------
//   useEffect(() => {
//     const container = containerRef.current;
//     if (!container) return;

//     const handleResize = () => {
//       const w = container.offsetWidth;
//       const h = container.offsetHeight;

//       const last = lastSizeRef.current;
//       if (w === last.w && h === last.h) {
//         return; // no real change
//       }

//       lastSizeRef.current = { w, h };
//       requestUpdate();
//     };

//     const resizeObserver = new ResizeObserver(handleResize);

//     resizeObserver.observe(container);
//     resizeObserverRef.current = resizeObserver;

//     return () => resizeObserver.disconnect();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // ------------------------------------------------------------
//   // Mutation observer → recapture on DOM changes
//   // ------------------------------------------------------------
//   useEffect(() => {
//     const container = containerRef.current;
//     if (!container) return;

//     const mutationObserver = new MutationObserver(() => {
//       requestUpdate();
//     });

//     mutationObserver.observe(container, {
//       childList: true,
//       characterData: true,
//       subtree: true,
//       attributes: true, // keep this to not break style/class-driven DOM changes
//     });

//     mutationObserverRef.current = mutationObserver;

//     return () => mutationObserver.disconnect();
//   }, []);

//   // ------------------------------------------------------------
//   // Cleanup texture on unmount
//   // ------------------------------------------------------------
//   useEffect(() => {
//     return () => {
//       if (apiRef.current?.texture) {
//         apiRef.current.texture.dispose();
//       }
//     };
//   }, []);

//   // ------------------------------------------------------------
//   // Hidden DOM container + offscreen canvas
//   // ------------------------------------------------------------
//   return (
//     <>
//       {/* Hidden DOM container (participates in layout, but offscreen) */}
//       <div
//         ref={containerRef}
//         style={{
//           position: "fixed",
//           top: 0,
//           left: 0,

//           // Move it FAR offscreen so the user cannot see it
//           transform: "translate(-2000px, -2000px)",

//           // MUST be visible and opaque for html2canvas
//           visibility: "visible",
//           opacity: 1,

//           pointerEvents: "none",
//           background,
//           display: "inline-block",
//         }}
//       >
//         {content}
//       </div>

//       {/* Output canvas used as the backing image for CanvasTexture */}
//       <canvas
//         ref={outputCanvasRef}
//         width={1}
//         height={1}
//         style={{ display: "none" }}
//       />
//     </>
//   );
// }

/**
 * DomSurface.tsx
 * ------------------------------------------------------------
 * Renders arbitrary React DOM content offscreen, rasterizes it
 * into a <canvas> using html2canvas, and exposes a
 * THREE.CanvasTexture for use on 3D geometry.
 *
 * Strategy:
 * - Render DOM in a hidden but layout-participating container
 * - Use html2canvas to rasterize that container into a bitmap
 * - Draw bitmap into our own <canvas>
 * - Lazily create a THREE.CanvasTexture the first time we have
 *   a valid canvas, and reuse it thereafter
 * - Update the same texture on every change (no reallocation)
 *
 * Performance:
 * - No overlapping html2canvas runs (concurrency guard)
 * - Throttled via requestAnimationFrame + maxUpdateRate
 * - ResizeObserver + MutationObserver only used if autoUpdate
 * - Consumers can manually call api.update() whenever they want
 * ------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import html2canvas from "html2canvas";

export interface DomSurfaceAPI {
  texture: THREE.Texture | null;
  width: number;
  height: number;
  update: () => Promise<void>;
  dispose: () => void;
}

interface DomSurfaceProps {
  content?: React.ReactNode;
  onReady?: (api: DomSurfaceAPI) => void;
  background?: string;

  /** Absolute pixel ratio for html2canvas (defaults to window.devicePixelRatio) */
  pixelRatio?: number;

  /**
   * If true, DomSurface will watch for DOM/size changes and re-capture
   * automatically (throttled). If false, only manual api.update() triggers
   * a capture.
   *
   * Default: true (to avoid breaking existing usage)
   * Recommended for performance-sensitive UI: false
   */
  autoUpdate?: boolean;

  /**
   * Maximum update rate in captures per second when autoUpdate is enabled.
   * Default: 10 (i.e. at most one capture every 100ms).
   */
  maxUpdateRate?: number;
}

export function DomSurface({
  content,
  onReady,
  background = "transparent",
  pixelRatio = window.devicePixelRatio || 1,
  autoUpdate = true,
  maxUpdateRate = 10,
}: DomSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const apiRef = useRef<DomSurfaceAPI | null>(null);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  // Concurrency + throttling
  const isUpdatingRef = useRef(false);
  const rafScheduledRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);

  // Track size to avoid re-capture on no-op resizes
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const minIntervalMs = 1000 / Math.max(1, maxUpdateRate);

  // ------------------------------------------------------------
  // Core updater: DOM → html2canvas → outputCanvas → CanvasTexture
  // (does the actual work, but DOES NOT throttle)
  // ------------------------------------------------------------
  const updateTexture = async () => {
    const container = containerRef.current;
    const outputCanvas = outputCanvasRef.current;

    if (!container || !outputCanvas) return;

    // Concurrency guard – coalesce calls
    if (isUpdatingRef.current) {
      // A capture is already in progress; just mark that we're "dirty".
      // The throttled requestUpdate() will schedule another pass.
      return;
    }
    isUpdatingRef.current = true;

    try {
      const w = container.offsetWidth;
      const h = container.offsetHeight;

      if (w === 0 || h === 0) {
        return;
      }

      const renderCanvas = await html2canvas(container, {
        backgroundColor: null,
        scale: pixelRatio,
        useCORS: true,
        ignoreElements: (el) => el instanceof HTMLCanvasElement,
      });

      if (renderCanvas.width === 0 || renderCanvas.height === 0) {
        return;
      }

      const safeWidth = Math.max(1, Math.floor(renderCanvas.width));
      const safeHeight = Math.max(1, Math.floor(renderCanvas.height));

      outputCanvas.width = safeWidth;
      outputCanvas.height = safeHeight;

      const ctx = outputCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, safeWidth, safeHeight);
      ctx.drawImage(renderCanvas, 0, 0, safeWidth, safeHeight);

      let tex = texture;

      if (!tex) {
        // First-time creation
        tex = new THREE.CanvasTexture(outputCanvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;

        setTexture(tex);

        const api: DomSurfaceAPI = {
          texture: tex,
          width: w,
          height: h,
          update: () => {
            requestUpdate();
            return Promise.resolve();
          },
          dispose: () => tex!.dispose(),
        };

        apiRef.current = api;
        onReady?.(api);
      } else {
        // Subsequent updates reuse same texture & canvas
        tex.needsUpdate = true;
        // @ts-ignore: Three types may not know about .source
        if (tex.source) tex.source.needsUpdate = true;

        if (apiRef.current) {
          apiRef.current.texture = tex;
          apiRef.current.width = w;
          apiRef.current.height = h;
        }
      }
    } finally {
      isUpdatingRef.current = false;
      lastUpdateTimeRef.current = performance.now();
    }
  };

  // ------------------------------------------------------------
  // Throttled wrapper – schedule the REAL update
  // ------------------------------------------------------------
  const requestUpdate = () => {
    // Manual callers can always request; we just throttle frequency.
    if (rafScheduledRef.current) return;
    rafScheduledRef.current = true;

    requestAnimationFrame(() => {
      rafScheduledRef.current = false;

      const now = performance.now();
      const delta = now - lastUpdateTimeRef.current;

      if (delta < minIntervalMs) {
        // Too soon since last capture; skip this cycle.
        // Any further calls will schedule again.
        return;
      }

      void updateTexture();
    });
  };

  // ------------------------------------------------------------
  // Initial capture + content-driven recapture (if autoUpdate)
  // ------------------------------------------------------------
  useEffect(() => {
    if (autoUpdate) {
      requestUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, autoUpdate]);

  // ------------------------------------------------------------
  // Resize observer → recapture on size changes (if autoUpdate)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!autoUpdate) return;

    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;

      const last = lastSizeRef.current;
      if (w === last.w && h === last.h) return; // no change

      lastSizeRef.current = { w, h };
      requestUpdate();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    return () => resizeObserver.disconnect();
  }, [autoUpdate]);

  // ------------------------------------------------------------
  // Mutation observer → recapture on DOM changes (if autoUpdate)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!autoUpdate) return;

    const container = containerRef.current;
    if (!container) return;

    const mutationObserver = new MutationObserver(() => {
      requestUpdate();
    });

    mutationObserver.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
      // attributes omitted to reduce noise; style/class-driven visual
      // changes should use manual api.update() when needed.
    });

    mutationObserverRef.current = mutationObserver;

    return () => mutationObserver.disconnect();
  }, [autoUpdate]);

  // ------------------------------------------------------------
  // Cleanup texture on unmount
  // ------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (apiRef.current?.texture) {
        apiRef.current.texture.dispose();
      }
    };
  }, []);

  // ------------------------------------------------------------
  // Hidden DOM container + offscreen canvas
  // ------------------------------------------------------------
  return (
    <>
      {/* Hidden DOM container (participates in layout, but offscreen) */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,

          // Move it FAR offscreen so the user cannot see it
          transform: "translate(-2000px, -2000px)",

          // MUST be visible and opaque for html2canvas
          visibility: "visible",
          opacity: 1,

          pointerEvents: "none",
          background,
          display: "inline-block",
        }}
      >
        {content}
      </div>

      {/* Output canvas used as the backing image for CanvasTexture */}
      <canvas
        ref={outputCanvasRef}
        width={1}
        height={1}
        style={{ display: "none" }}
      />
    </>
  );
}
