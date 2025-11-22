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
 * This avoids:
 * - WebGL glCopySubTextureCHROMIUM errors
 * - Mismatched sizes between GPU texture and source canvas
 * - Needing to recreate textures inside consumers (ImagePlane)
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
  pixelRatio?: number;
}

export function DomSurface({
  content,
  onReady,
  background = "transparent",
  pixelRatio = window.devicePixelRatio || 1,
}: DomSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const apiRef = useRef<DomSurfaceAPI | null>(null);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  // ------------------------------------------------------------
  // Core updater: DOM → html2canvas → outputCanvas → CanvasTexture
  // ------------------------------------------------------------
  const updateTexture = async () => {
    const container = containerRef.current;
    const outputCanvas = outputCanvasRef.current;

    if (!container || !outputCanvas) return;

    const w = container.offsetWidth;
    const h = container.offsetHeight;

    console.log("[DomSurface] container size:", w, h);

    if (w === 0 || h === 0) {
      console.warn("[DomSurface] container has zero size. Skipping capture.");
      return;
    }

    // --- Rasterize DOM via html2canvas ------------------------
    const renderCanvas = await html2canvas(container, {
      backgroundColor: null,
      scale: pixelRatio,
      useCORS: true,
      ignoreElements: (el) => el instanceof HTMLCanvasElement,
    });

    console.log(
      "[DomSurface] renderCanvas size:",
      renderCanvas.width,
      renderCanvas.height
    );

    if (renderCanvas.width === 0 || renderCanvas.height === 0) {
      console.warn(
        "[DomSurface] html2canvas returned 0x0 canvas. Skipping update."
      );
      return;
    }

    // Normalize dimensions
    const safeWidth = Math.max(1, Math.floor(renderCanvas.width));
    const safeHeight = Math.max(1, Math.floor(renderCanvas.height));

    console.log("[DomSurface] safe canvas size:", safeWidth, safeHeight);

    // Resize our output canvas to match
    outputCanvas.width = safeWidth;
    outputCanvas.height = safeHeight;

    const ctx = outputCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, safeWidth, safeHeight);
    ctx.drawImage(renderCanvas, 0, 0, safeWidth, safeHeight);

    // --- Lazily create or update THREE.CanvasTexture ----------
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
        update: updateTexture,
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
  };

  // ------------------------------------------------------------
  // Initial capture and content-driven recapture
  // ------------------------------------------------------------
  useEffect(() => {
    updateTexture();
  }, [content]);

  // ------------------------------------------------------------
  // Resize observer → recapture on size changes
  // ------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      updateTexture();
    });

    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    return () => resizeObserver.disconnect();
  }, []);

  // ------------------------------------------------------------
  // Mutation observer → recapture on DOM changes
  // ------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mutationObserver = new MutationObserver(() => {
      updateTexture();
    });

    mutationObserver.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
    });

    mutationObserverRef.current = mutationObserver;

    return () => mutationObserver.disconnect();
  }, []);

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
