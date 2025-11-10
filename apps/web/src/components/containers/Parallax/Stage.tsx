// src/parallax/Stage.tsx
// ------------------------------------------------------------
// Dual-mode camera system: press [T] or click toggle button
// to switch between Dynamic-FOV (fixed-Z) and Dynamic-Z (fixed-FOV)
// modes.  Overlay shows FOV, Z, and visible world height.

import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, PerformanceMonitor } from "@react-three/drei";
import {
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxConfig } from "./ParallaxConfig";

/* ------------------------------------------------------------ */
/*  Option A – Dynamic FOV / Fixed Z                            */
/* ------------------------------------------------------------ */
function FitPerspectiveCameraA({
  onValuesChange,
}: {
  onValuesChange?: (vals: { fov: number; visibleHeight: number }) => void;
}) {
  const { camera, size } = useThree();
  const setViewport = useParallaxStore((s) => s.setViewport);
  const bgWidth = useParallaxStore((s) => s.backgroundWidth);
  const smooth = true;
  const fovTarget = useRef(ParallaxConfig.camera.baseFov);

  useEffect(() => setViewport(size.width, size.height), [size, setViewport]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const distance = ParallaxConfig.camera.positionZ;

    const fovDeg =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;
    if (smooth) fovTarget.current += (fovDeg - fovTarget.current) * 0.1;
    else fovTarget.current = fovDeg;

    cam.fov = fovTarget.current;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const visibleHeight = 2 * distance * Math.tan((cam.fov * Math.PI) / 360); // fov/2 in radians
    onValuesChange?.({ fov: cam.fov, visibleHeight });
  });

  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 0, ParallaxConfig.camera.positionZ]}
      near={ParallaxConfig.camera.near}
      far={ParallaxConfig.camera.far}
    />
  );
}

/* ------------------------------------------------------------ */
/*  Option B – Fixed FOV / Dynamic Z                            */
/* ------------------------------------------------------------ */
function FitPerspectiveCameraB({
  onValuesChange,
}: {
  onValuesChange?: (vals: { z: number; visibleHeight: number }) => void;
}) {
  const { camera, size } = useThree();
  const setViewport = useParallaxStore((s) => s.setViewport);
  const bgWidth = useParallaxStore((s) => s.backgroundWidth);
  const smooth = true;
  const zTarget = useRef(ParallaxConfig.camera.positionZ);

  useEffect(() => setViewport(size.width, size.height), [size, setViewport]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const fovRad = (ParallaxConfig.camera.baseFov * Math.PI) / 180;
    const desiredZ = bgWidth / (2 * aspect * Math.tan(fovRad / 2));

    if (smooth) zTarget.current += (desiredZ - zTarget.current) * 0.1;
    else zTarget.current = desiredZ;

    cam.position.z = zTarget.current;
    cam.fov = ParallaxConfig.camera.baseFov;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const visibleHeight = 2 * zTarget.current * Math.tan(fovRad / 2); // fixed fov
    onValuesChange?.({ z: zTarget.current, visibleHeight });
  });

  return (
    <PerspectiveCamera
      makeDefault
      fov={ParallaxConfig.camera.baseFov}
      position={[0, 0, ParallaxConfig.camera.positionZ]}
      near={ParallaxConfig.camera.near}
      far={ParallaxConfig.camera.far}
    />
  );
}

/* ------------------------------------------------------------ */
/*  CameraRig – scroll Y interpolation                          */
/* ------------------------------------------------------------ */
function CameraRig() {
  const { camera } = useThree();
  const scrollNorm = useParallaxStore((s) => s.scroll);
  const bgHeight = useParallaxStore((s) => s.backgroundHeight);
  const baseFov = ParallaxConfig.camera.baseFov;
  const bgDepth = ParallaxConfig.scene.background.depth ?? 0;
  const vFov = (baseFov * Math.PI) / 180;
  const camToBg = Math.abs(camera.position.z - bgDepth);
  const visibleH = 2 * Math.tan(vFov / 2) * camToBg;
  const travelY = Math.max(0, bgHeight - visibleH);
  const currentY = useRef(camera.position.y);

  useFrame(() => {
    const targetY = -(scrollNorm - 0.5) * travelY;
    currentY.current +=
      (targetY - currentY.current) * ParallaxConfig.scroll.smoothness;
    camera.position.y = currentY.current;
    camera.lookAt(0, currentY.current, 0);
  });
  return null;
}

/* ------------------------------------------------------------ */
/*  Stage – runtime toggle + overlay                            */
/* ------------------------------------------------------------ */
export function Stage({ children }: PropsWithChildren) {
  const { lighting, debug } = ParallaxConfig;
  const [mode, setMode] = useState<"A" | "B">("A");
  const [fovDisplay, setFovDisplay] = useState(ParallaxConfig.camera.baseFov);
  const [zDisplay, setZDisplay] = useState(ParallaxConfig.camera.positionZ);
  const [visHeight, setVisHeight] = useState(0);
  const bgWidth = useParallaxStore((s) => s.backgroundWidth);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "t") setMode((m) => (m === "A" ? "B" : "A"));
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <>
      <Canvas
        linear
        dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      >
        <PerformanceMonitor onDecline={() => null} />

        {mode === "A" ? (
          <FitPerspectiveCameraA
            onValuesChange={({ fov, visibleHeight }) => {
              setFovDisplay(fov);
              setVisHeight(visibleHeight);
            }}
          />
        ) : (
          <FitPerspectiveCameraB
            onValuesChange={({ z, visibleHeight }) => {
              setZDisplay(z);
              setVisHeight(visibleHeight);
            }}
          />
        )}

        <CameraRig />

        <ambientLight intensity={lighting.ambient} />
        <directionalLight
          position={lighting.directional.position as [number, number, number]}
          intensity={lighting.directional.intensity}
        />

        {children}

        {debug.enabled && (
          <>
            <gridHelper args={[20, 20]} />
            <axesHelper args={[2]} />
          </>
        )}
      </Canvas>

      {/* 🧩 Overlay */}
      <div
        style={{
          position: "fixed",
          bottom: "8px",
          right: "12px",
          padding: "6px 10px",
          background: "rgba(0,0,0,0.65)",
          color: "#0ff",
          fontFamily: "monospace",
          fontSize: "12px",
          borderRadius: "6px",
          zIndex: 9999,
          userSelect: "none",
          lineHeight: "1.3em",
        }}
      >
        <div>
          Mode:{" "}
          {mode === "A" ? "Dynamic FOV / Fixed Z" : "Fixed FOV / Dynamic Z"}
        </div>
        {mode === "A" ? (
          <div>FOV: {fovDisplay.toFixed(2)}°</div>
        ) : (
          <div>Camera Z: {zDisplay.toFixed(2)}</div>
        )}
        <div>Visible Height: {visHeight.toFixed(3)}</div>
        <div>BG Width: {bgWidth.toFixed(2)}</div>
        <div>Press “T” to toggle</div>
      </div>

      <button
        onClick={() => setMode((m) => (m === "A" ? "B" : "A"))}
        style={{
          position: "fixed",
          bottom: "8px",
          left: "12px",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontFamily: "monospace",
          fontSize: "12px",
          border: "1px solid #666",
          borderRadius: "4px",
          padding: "4px 8px",
          cursor: "pointer",
          zIndex: 9999,
        }}
      >
        Toggle Mode [T]
      </button>
    </>
  );
}
