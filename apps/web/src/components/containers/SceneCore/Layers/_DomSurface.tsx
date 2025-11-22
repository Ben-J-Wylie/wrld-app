import React, { useRef, useEffect, useState, ReactNode } from "react";
import * as THREE from "three";
import { createRoot, Root } from "react-dom/client";
import html2canvas from "html2canvas";

import { ScreenGroup } from "./ScreenGroup";
import { ImagePlane } from "../../SceneObjects/Geometry/ImagePlane";

function createOffscreenContainer() {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "0";
  el.style.top = "0";
  el.style.opacity = "0"; // Invisible but still rendered
  el.style.pointerEvents = "none";
  el.style.zIndex = "-1";

  console.log("[DomSurface] Created offscreen DOM container");

  document.body.appendChild(el);
  return el;
}

export interface DomSurfaceProps {
  children: ReactNode;

  width: number;
  height: number;

  worldWidth?: number;
  worldHeight?: number;

  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "center" | "bottom";

  offsetX?: number;
  offsetY?: number;

  z?: number;
}

export function DomSurface({
  children,
  width,
  height,
  worldWidth,
  worldHeight,
  anchorX = "center",
  anchorY = "center",
  offsetX = 0,
  offsetY = 0,
  z = 50,
}: DomSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const reactRootRef = useRef<Root | null>(null);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log("[DomSurface] Initializing…");

    containerRef.current = createOffscreenContainer();
    canvasRef.current = document.createElement("canvas");

    console.log("[DomSurface] Canvas created:", canvasRef.current);

    reactRootRef.current = createRoot(containerRef.current);
    console.log("[DomSurface] React root created");

    setReady(true);

    return () => {
      console.log("[DomSurface] Cleanup container");
      if (containerRef.current) document.body.removeChild(containerRef.current);
    };
  }, []);

  // ---- RENDER DOM → CANVAS ----
  useEffect(() => {
    if (!ready) {
      console.log("[DomSurface] Not ready yet");
      return;
    }

    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const root = reactRootRef.current!;

    console.log("[DomSurface] Rendering children into DOM container…");

    root.render(children);

    // Let React flush the DOM before snapshotting
    requestAnimationFrame(() => {
      console.log("[DomSurface] After React render");
      console.log("[DomSurface] container innerHTML:", container.innerHTML);

      updateCanvasFromDOM(container, canvas).then(() => {
        console.log("[DomSurface] Snapshot complete");
        updateTexture(canvas);
      });
    });
  }, [children, ready, width, height]);

  async function updateCanvasFromDOM(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement
  ) {
    const dpr = window.devicePixelRatio || 1;
    const supersample = 1.5;
    const dpi = dpr * supersample;

    canvas.width = width * dpi;
    canvas.height = height * dpi;

    console.log(
      `[DomSurface] Canvas resized to ${canvas.width} × ${canvas.height}`
    );

    console.log("[DomSurface] Starting html2canvas…");

    try {
      const snapshot = await html2canvas(container, {
        backgroundColor: null,
        scale: dpi,
        useCORS: true,
      });

      console.log(
        "[DomSurface] html2canvas snapshot SIZE:",
        snapshot.width,
        snapshot.height
      );

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(snapshot, 0, 0);
    } catch (err) {
      console.error("[DomSurface] html2canvas ERROR:", err);
    }
  }

  function updateTexture(canvas: HTMLCanvasElement) {
    if (!textureRef.current) {
      textureRef.current = new THREE.CanvasTexture(canvas);
      textureRef.current.minFilter = THREE.LinearFilter;
      textureRef.current.magFilter = THREE.LinearFilter;
      textureRef.current.generateMipmaps = false;

      console.log("[DomSurface] Texture created");
    } else {
      textureRef.current.needsUpdate = true;
      console.log("[DomSurface] Texture updated");
    }
  }

  if (!ready) {
    console.log("[DomSurface] Not ready → returning null");
    return null;
  }

  if (!textureRef.current) {
    console.log("[DomSurface] No texture yet → returning null");
    return null;
  }

  console.log("[DomSurface] Rendering ImagePlane with texture");

  return (
    <ScreenGroup
      anchorX={anchorX}
      anchorY={anchorY}
      offsetX={offsetX}
      offsetY={offsetY}
      z={z}
    >
      <ImagePlane
        width={worldWidth ?? width}
        height={worldHeight ?? height}
        texture={textureRef.current}
      />
    </ScreenGroup>
  );
}
