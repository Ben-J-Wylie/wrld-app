// src/parallax/Stage.tsx
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, PerformanceMonitor } from "@react-three/drei";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxConfig } from "./ParallaxConfig";

/**
 * FitPerspectiveCamera
 * ------------------------------------------------------------
 * Dynamically adjusts FOV to fit background plane width.
 * Includes optional smooth transitions and live debug overlay.
 */
function FitPerspectiveCamera({
  onFovChange,
}: {
  onFovChange?: (fov: number) => void;
}) {
  const { camera, size } = useThree();
  const setViewport = useParallaxStore((s) => s.setViewport);
  const bgWidth = useParallaxStore((s) => s.backgroundWidth);

  const smoothFov = true;
  const fovTarget = useRef(ParallaxConfig.camera.baseFov);

  useEffect(() => {
    setViewport(size.width, size.height);
  }, [size.width, size.height, setViewport]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const distance = ParallaxConfig.camera.positionZ;

    // Compute FOV from bg width & aspect
    const fovRadians = 2 * Math.atan(bgWidth / 2 / (distance * aspect));
    const fovDegrees = (fovRadians * 180) / Math.PI;

    if (smoothFov) {
      fovTarget.current += (fovDegrees - fovTarget.current) * 0.1;
      cam.fov = fovTarget.current;
    } else {
      cam.fov = fovDegrees;
    }

    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    if (onFovChange) onFovChange(cam.fov);
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

/**
 * CameraRig
 * ------------------------------------------------------------
 * Moves camera vertically based on scroll.
 */
function CameraRig() {
  const { camera } = useThree();
  const scrollNorm = useParallaxStore((s) => s.scroll);
  const bgHeight = useParallaxStore((s) => s.backgroundHeight);

  const baseFov = ParallaxConfig.camera.baseFov;
  const bgDepth = ParallaxConfig.scene.background.depth ?? 0;

  const vFov = (baseFov * Math.PI) / 180;
  const cameraToBg = Math.abs(camera.position.z - bgDepth);
  const visibleHeightAtBg = 2 * Math.tan(vFov / 2) * cameraToBg;
  const cameraTravelY = Math.max(0, bgHeight - visibleHeightAtBg);

  const currentY = useRef(camera.position.y);

  useFrame(() => {
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
 * Full-viewport Canvas + FOV debug overlay.
 */
export function Stage({ children }: PropsWithChildren) {
  const { lighting, debug } = ParallaxConfig;
  const [fovDisplay, setFovDisplay] = useState(ParallaxConfig.camera.baseFov);
  const aspect = window.innerWidth / window.innerHeight;
  const bgWidth = useParallaxStore((s) => s.backgroundWidth);

  return (
    <>
      <Canvas
        linear
        dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      >
        <PerformanceMonitor onDecline={() => null} />

        {/* 🎥 Camera system */}
        <FitPerspectiveCamera onFovChange={setFovDisplay} />
        <CameraRig />

        {/* 💡 Lighting */}
        <ambientLight intensity={lighting.ambient} />
        <directionalLight
          position={lighting.directional.position as [number, number, number]}
          intensity={lighting.directional.intensity}
        />

        {/* 🧱 Scene content */}
        {children}

        {/* 🧭 Debug helpers */}
        {debug.enabled && (
          <>
            <gridHelper args={[20, 20]} />
            <axesHelper args={[2]} />
          </>
        )}
      </Canvas>

      {/* 🧩 Debug readout overlay */}
      <div
        style={{
          position: "fixed",
          bottom: "8px",
          right: "12px",
          padding: "6px 10px",
          background: "rgba(0,0,0,0.6)",
          color: "#0f0",
          fontFamily: "monospace",
          fontSize: "12px",
          borderRadius: "6px",
          zIndex: 9999,
          userSelect: "none",
        }}
      >
        <div>FOV: {fovDisplay.toFixed(2)}°</div>
        <div>Aspect: {aspect.toFixed(3)}</div>
        <div>BG Width: {bgWidth.toFixed(2)}</div>
      </div>
    </>
  );
}
