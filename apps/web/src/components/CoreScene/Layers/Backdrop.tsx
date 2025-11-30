// SceneCore/Layers/Backdrop.tsx

import * as THREE from "three";
import React, { forwardRef, useMemo, useRef } from "react";
import { useSceneStore } from "../Store/SceneStore";
import { useWrldTheme } from "../Themes/WrldThemeProvider";

// --- Fake shadow imports (new API) ---
import { FakeShadowReceiver } from "../Shadows/AttemptOne/FakeShadowReceiver";
import { useFakeShadowGlobals } from "../Shadows/AttemptOne/FakeShadowGlobals";

export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

interface BackdropProps {
  color?: THREE.ColorRepresentation;
  padding?: number; // uniform padding outward
}

export const Backdrop = forwardRef<THREE.Mesh, BackdropProps>(
  ({ color, padding = 100 }, forwardedRef) => {
    console.log("[RENDER] Backdrop");

    const theme = useWrldTheme();
    const width = useSceneStore((s) => s.sceneWidth);
    const height = useSceneStore((s) => s.sceneHeight);

    const planeRef = useRef<THREE.Mesh>(null!);
    const meshRef = (forwardedRef as React.RefObject<THREE.Mesh>) ?? planeRef;

    // Final background color: props → theme → fallback
    const finalColor = color ?? theme.colors.background ?? "#ffffff";

    // Expand Backdrop by padding (keeps fake shadows from clipping at edges)
    const { drawWidth, drawHeight } = useMemo(() => {
      const grow = padding * 2;
      return {
        drawWidth: width + grow,
        drawHeight: height + grow,
      };
    }, [width, height, padding]);

    // --------------------------------------------------
    // Fake shadow globals: shared texture + light direction
    // --------------------------------------------------
    const { shadowTexture, lightDir } = useFakeShadowGlobals();

    // Backdrop-specific fake shadow tuning
    const baseShadowSize = Math.max(drawWidth, drawHeight) * 0.15; // base blob size
    const shadowSoftness = 1.0; // penumbra growth with distance
    const shadowMaxDistance = 3000; // how far shadows can project
    const shadowBaseOpacity = 0.45;

    return (
      <group
        name="BackdropGroup"
        position={[0, 0, -0.01]} // Slightly behind everything
      >
        {/* 
          BACKDROP PLANE 
          The actual backdrop surface onto which shadows will be projected.
        */}
        <mesh
          ref={meshRef}
          name="BackdropPlane"
          renderOrder={-1000}
          receiveShadow={false}
          castShadow={false}
        >
          <planeGeometry args={[drawWidth, drawHeight]} />
          <meshBasicMaterial
            color={finalColor}
            toneMapped={false}
            depthWrite={true}
          />
        </mesh>

        {/* 
          FAKE SHADOW RECEIVER
          Receives shadows from all FakeShadowCasters, projected along lightDir
        */}
        {shadowTexture && (
          <FakeShadowReceiver
            active={true}
            receiverRef={meshRef}
            texture={shadowTexture}
            lightDir={lightDir}
            baseSize={baseShadowSize}
            softness={shadowSoftness}
            maxDistance={shadowMaxDistance}
            baseOpacity={shadowBaseOpacity}
          />
        )}
      </group>
    );
  }
);

Backdrop.displayName = "Backdrop";
