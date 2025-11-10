// In simple terms:
// - The "stage" is your fixed 3D camera and lighting setup that displays everything.

// Internal subcomponents:
// - FitPerspectiveCamera
// - Creates a PerspectiveCamera (the core of the parallax illusion).
// - Updates the store whenever viewport size changes.
// - Controlled by a few parameters:
//      - CAMERA_FOV: affects perspective distortion (lower = flatter, higher = deeper).
//      - near / far: render range.

// CameraRig
// - Moves the camera smoothly up and down based on scroll.
// - Controlled by:
//      - SCROLL_RANGE_MULT: overall parallax strength.
//      - Lerp speed (0.1 → 0.2 faster).
// - Uses the scroll value from the store and calculates vertical offset.

// Lighting
// - Adds an ambientLight and directionalLight for basic visibility.
// - You could later move these into the config if you want artistic control.

// Impact:
// - This file determines how strong and how smooth the parallax feels.

// src/parallax/Stage.tsx
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, PerformanceMonitor } from "@react-three/drei";
import { PropsWithChildren, useEffect, useRef } from "react";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxConfig } from "./ParallaxConfig";

/**
 * FitPerspectiveCamera
 * ------------------------------------------------------------
 * Creates a perspective camera that fits viewport and updates on resize.
 */
function FitPerspectiveCamera() {
  const { size } = useThree();
  const setViewport = useParallaxStore((s) => s.setViewport);

  useEffect(() => {
    setViewport(size.width, size.height);
  }, [size, setViewport]);

  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 0, ParallaxConfig.camera.positionZ]}
      fov={ParallaxConfig.camera.fov}
      near={ParallaxConfig.camera.near}
      far={ParallaxConfig.camera.far}
    />
  );
}

/**
 * CameraRig
 * ------------------------------------------------------------
 * Moves camera vertically based on scroll, derived from actual scene geometry.
 */
function CameraRig() {
  const { camera } = useThree();
  const scrollNorm = useParallaxStore((s) => s.scroll);
  const bgHeight = useParallaxStore((s) => s.backgroundHeight); // 🆕 dynamic height

  const fov = ParallaxConfig.camera.fov;
  const bgDepth = ParallaxConfig.scene.background.depth ?? 0;

  const vFov = (fov * Math.PI) / 180;
  const cameraToBg = Math.abs(camera.position.z - bgDepth);
  const visibleHeightAtBg = 2 * Math.tan(vFov / 2) * cameraToBg;

  const cameraTravelY = Math.max(0, bgHeight - visibleHeightAtBg);
  const currentY = useRef(camera.position.y);

  useFrame(() => {
    if (!camera) return;

    const targetY = -(scrollNorm - 0.5) * cameraTravelY;
    currentY.current +=
      (targetY - currentY.current) * ParallaxConfig.scroll.smoothness;

    camera.position.y = currentY.current;
    camera.lookAt(0, currentY.current, 0);
  });

  return null;
}

/**
 * Stage
 * ------------------------------------------------------------
 * Fixed full-viewport Canvas that renders the scene and manages camera + lights.
 */
export function Stage({ children }: PropsWithChildren) {
  const { lighting, debug } = ParallaxConfig;

  return (
    <Canvas
      linear
      dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
    >
      <PerformanceMonitor onDecline={() => null} />

      {/* 🎥 Camera system */}
      <FitPerspectiveCamera />
      <CameraRig />

      {/* 💡 Lighting setup */}
      <ambientLight intensity={lighting.ambient} />
      <directionalLight
        position={lighting.directional.position as [number, number, number]}
        intensity={lighting.directional.intensity}
      />

      {/* 🧱 Scene content */}
      {children}

      {/* 🧭 Optional debug helpers */}
      {debug.enabled && (
        <>
          <gridHelper args={[20, 20]} />
          <axesHelper args={[2]} />
        </>
      )}
    </Canvas>
  );
}
