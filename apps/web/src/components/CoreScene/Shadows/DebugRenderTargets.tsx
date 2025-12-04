// DebugRenderTargets.tsx — world-space previews
import React from "react";
import * as THREE from "three";
import { FakeShadowContext } from "./FakeShadowContext";

/**
 * Displays each receiver’s shadowRT as a plane in WORLD SPACE.
 * OrbitControls will work normally.
 */
export function DebugRenderTargets() {
  const { receivers } = React.useContext(FakeShadowContext);

  return (
    <group position={[7, 4, 0]} rotation={[0, 0, 0]}>
      {receivers.map((r, i) => {
        if (!r.shadowRT) return null;

        return (
          <mesh key={r.id} position={[0, i * -1.2, 0]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={r.shadowRT.texture}
              transparent
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
