// src/parallax/Stage.tsx
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, PerformanceMonitor } from "@react-three/drei";
import { PropsWithChildren, useEffect } from "react";
import { useParallaxStore } from "./ParallaxStore";
import { SceneDebugHelpers } from "./SceneDebugHelpers";

/**
 * FitPerspectiveCamera
 * ------------------------------------------------------------
 * Creates a Perspective camera that adjusts automatically to viewport size.
 * Perspective projection introduces real parallax — closer layers move faster.
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
      position={[0, 0, 10]}
      fov={50} // field of view (lower = flatter, higher = more depth)
      near={0.1}
      far={100}
    />
  );
}

/**
 * CameraRig
 * ------------------------------------------------------------
 * Moves the camera vertically in response to page scroll.
 * Scroll down (scrollY ↑) moves camera down along -Y axis.
 */
function CameraRig() {
  const { camera } = useThree();
  const scrollNorm = useParallaxStore((s) => s.scroll);
  const vp = useParallaxStore((s) => s.viewport);

  useFrame(() => {
    // Global scroll amplitude (adjust to taste)
    const scrollRange = vp.h * 0.15;

    // Invert direction so scrolling down moves camera downward
    const cameraY = -(scrollNorm - 0.5) * scrollRange;

    camera.position.y = cameraY;
    camera.lookAt(0, cameraY, 0); // keep looking toward the center of the scene
  });

  return null;
}

export function Stage({ children }: PropsWithChildren) {
  return (
    <Canvas
      linear
      dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
    >
      <PerformanceMonitor onDecline={() => null} />

      {/* 🎥 Perspective camera with scroll-controlled rig */}
      <FitPerspectiveCamera />
      <CameraRig />

      {/* 🧭 Debug grid & axes */}
      <SceneDebugHelpers visible={true} />

      {/* Soft lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 2, 3]} intensity={0.4} />

      {children}
    </Canvas>
  );
}
