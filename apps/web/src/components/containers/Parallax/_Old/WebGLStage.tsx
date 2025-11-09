import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useResponsiveContext } from "../Responsive/ResponsiveContext";
import { useParallaxLight } from "./ParallaxLight";
import { useParallaxScene } from "./ParallaxScene";

/** Fullscreen fixed GL canvas that uses pixel units via ortho camera. */
type WebGLStageProps = { children: React.ReactNode };

export function WebGLStage({ children }: WebGLStageProps) {
  const { vw, vh } = useParallaxScene(); // you already expose these
  useResponsiveContext(); // touch context so rerenders follow scale
  const halfW = vw / 2;
  const halfH = vh / 2;

  const camera = useMemo(
    () => (
      <OrthographicCamera
        makeDefault
        left={-halfW}
        right={halfW}
        top={halfH}
        bottom={-halfH}
        near={-2000}
        far={2000}
        position={[0, 0, 10]}
      />
    ),
    [vw, vh]
  );

  return (
    <Canvas
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none", // DOM keeps interaction
        zIndex: 0,
      }}
    >
      {camera}
      <Lights />
      {children}
    </Canvas>
  );
}

function Lights() {
  const { x, y, intensity } = useParallaxLight();
  return (
    <>
      <ambientLight intensity={0.4 * intensity} />
      <directionalLight
        position={[x * 300, -y * 300, 300]}
        intensity={0.6 * intensity}
      />
    </>
  );
}
