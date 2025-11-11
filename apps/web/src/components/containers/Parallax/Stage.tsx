// src/parallax/Stage.tsx
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, PerformanceMonitor } from "@react-three/drei";
import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxConfig } from "./ParallaxConfig";
import { FlyOnWallCamera } from "./FlyOnWallCamera";
import { FlyOnWallOverlay } from "./FlyOnWallOverlay";
import { RegisterThreeObjects } from "./RegisterThreeObjects";
import { useThreeStore } from "./threeStore";

/* ----------------------- FitPerspectiveCamera ----------------------- */
function FitPerspectiveCamera({
  onValuesChange,
}: {
  onValuesChange?: (vals: { fov: number; visibleHeight: number }) => void;
}) {
  const { camera, size } = useThree();
  const setViewport = useParallaxStore((s) => s.setViewport);
  const setVisibleHeight = useParallaxStore((s) => s.setVisibleHeight); // ✅ pulled once
  const bgWidth =
    useParallaxStore((s) => s.backgroundWidth) ??
    ParallaxConfig.scene.background.widthWorld;

  const fovTarget = useRef(ParallaxConfig.camera.baseFov);
  const initialized = useRef(false);

  useEffect(() => {
    setViewport(size.width, size.height);

    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const distance = ParallaxConfig.camera.positionZ;
    const fovDeg =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;

    fovTarget.current = fovDeg;
    cam.fov = fovDeg;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const visibleHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
    onValuesChange?.({ fov: cam.fov, visibleHeight });

    // ✅ store visible height once per mount/update
    setVisibleHeight(visibleHeight);
  }, [size, bgWidth, camera, setViewport, onValuesChange, setVisibleHeight]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const distance = ParallaxConfig.camera.positionZ;

    const fovDeg =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;

    fovTarget.current += (fovDeg - fovTarget.current) * 0.1;

    cam.fov = fovTarget.current;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const visibleHeight = 2 * distance * Math.tan((cam.fov * Math.PI) / 360);
    onValuesChange?.({ fov: cam.fov, visibleHeight });

    // ✅ use the same typed setter here
    setVisibleHeight(visibleHeight);
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

/* ----------------------------- CameraRig ---------------------------- */
function CameraRig() {
  const { camera } = useThree();
  const scrollNorm = useParallaxStore((s) => s.scroll);

  const worldHeight =
    useParallaxStore((s) => s.backgroundHeight) ??
    ParallaxConfig.scene.background.heightWorld;

  const bgDepth = ParallaxConfig.scene.background.depth ?? 0;
  const camToBg = Math.abs(
    (camera as THREE.PerspectiveCamera).position.z - bgDepth
  );

  const currentY = useRef((camera as THREE.PerspectiveCamera).position.y);

  useFrame(() => {
    // Use the LIVE camera FOV
    const vFov = THREE.MathUtils.degToRad(
      (camera as THREE.PerspectiveCamera).fov
    );
    const visibleH = 2 * Math.tan(vFov / 2) * camToBg;
    const halfVis = visibleH / 2;
    const halfWorld = worldHeight / 2;

    if (worldHeight <= visibleH) {
      // World fits → center vertically and lock scroll
      const targetY = 0;
      currentY.current +=
        (targetY - currentY.current) * ParallaxConfig.scroll.smoothness;
      (camera as THREE.PerspectiveCamera).position.y = currentY.current;
      camera.lookAt(0, currentY.current, 0);

      useParallaxStore.setState({ scroll: 0 });
      document.body.style.overflow = "hidden";
      return;
    }

    // World taller → allow scroll
    document.body.style.overflow = "auto";

    const s = THREE.MathUtils.clamp(scrollNorm, 0, 1);
    const fullTravel = worldHeight - visibleH;
    let targetY = halfWorld - halfVis - s * fullTravel;

    const minY = -halfWorld + halfVis;
    const maxY = halfWorld - halfVis;
    targetY = THREE.MathUtils.clamp(targetY, minY, maxY);

    currentY.current +=
      (targetY - currentY.current) * ParallaxConfig.scroll.smoothness;

    (camera as THREE.PerspectiveCamera).position.y = currentY.current;
    camera.lookAt(0, currentY.current, 0);
  });

  return null;
}

/* ------------------------------- Stage ------------------------------ */
export function Stage({ children }: PropsWithChildren) {
  const { lighting, debug } = ParallaxConfig;
  const [fovDisplay, setFovDisplay] = useState(ParallaxConfig.camera.baseFov);
  const [visHeight, setVisHeight] = useState(0);

  const worldWidth =
    useParallaxStore((s) => s.backgroundWidth) ??
    ParallaxConfig.scene.background.widthWorld;
  const worldHeight =
    useParallaxStore((s) => s.backgroundHeight) ??
    ParallaxConfig.scene.background.heightWorld;
  const setWorldHeight = useParallaxStore((s) => s.setWorldHeight);

  useEffect(() => setWorldHeight(worldHeight), [worldHeight, setWorldHeight]);

  // pull from store once (assuming Zustand)
  const { scene, camera } = useThreeStore.getState();

  return (
    <>
      {/* --- main Stage canvas --- */}
      <Canvas
        linear
        dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "fixed", inset: 0 }}
      >
        <PerformanceMonitor onDecline={() => null} />
        <RegisterThreeObjects /> {/* 👈 add this line */}
        <FitPerspectiveCamera
          onValuesChange={({ fov, visibleHeight }) => {
            setFovDisplay(fov);
            setVisHeight(visibleHeight);
          }}
        />
        <CameraRig />
        <ambientLight intensity={lighting.ambient} />
        <directionalLight
          position={lighting.directional.position as [number, number, number]}
          intensity={lighting.directional.intensity}
        />
        {children}
      </Canvas>

      {/* --- independent observer window --- */}
      {scene && camera && (
        <FlyOnWallOverlay stageScene={scene} stageCamera={camera} />
      )}

      {/* --- debug readout --- */}
      {debug.enabled && (
        <div className="debug-overlay">
          <div>FOV: {fovDisplay.toFixed(2)}°</div>
          <div>World Width: {worldWidth.toFixed(3)}</div>
          <div>World Height: {worldHeight.toFixed(3)}</div>
          <div>Visible Height: {visHeight.toFixed(3)}</div>
        </div>
      )}
    </>
  );
}
