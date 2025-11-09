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
import { PropsWithChildren, useEffect } from "react";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxConfig } from "./ParallaxConfig";

function FitPerspectiveCamera() {
  const { size } = useThree();
  const setViewport = useParallaxStore((s) => s.setViewport);

  // Update viewport on resize
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

function CameraRig() {
  const { camera } = useThree();
  const scrollNorm = useParallaxStore((s) => s.scroll);
  const vp = useParallaxStore((s) => s.viewport);

  // Persistent smoothed Y value (starts at camera's initial position)
  let currentY = camera.position.y;

  useFrame(() => {
    // Scroll range scales with viewport height
    const scrollRange = vp.h * ParallaxConfig.scroll.rangeMultiplier;

    // Convert normalized scroll (0–1) into world-space Y position
    const targetY = -(scrollNorm - 0.5) * scrollRange;

    // Smooth interpolation toward target (lerp)
    currentY += (targetY - currentY) * ParallaxConfig.scroll.smoothness;

    camera.position.y = currentY;
    camera.lookAt(0, currentY, 0);
  });

  return null;
}

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
        position={lighting.directional.position}
        intensity={lighting.directional.intensity}
      />

      {/* 🧱 Scene content */}
      {children}

      {/* 🧭 Optional debug grid */}
      {debug.enabled && (
        <>
          <gridHelper args={[20, 20]} />
          <axesHelper args={[2]} />
        </>
      )}
    </Canvas>
  );
}
