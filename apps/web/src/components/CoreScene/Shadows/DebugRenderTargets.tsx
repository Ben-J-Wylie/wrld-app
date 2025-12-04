// DebugRenderTargets.tsx — world-space RT previews

import React from "react";
import * as THREE from "three";
import { FakeShadowContext } from "./FakeShadowContext";

export function DebugRenderTargets() {
  const { receivers } = React.useContext(FakeShadowContext);

  // Put previews off to the right of the scene
  return (
    <group position={[7, 4, 0]}>
      {receivers.map((r, i) => {
        const rt = r.shadowRT;
        if (!rt) return null;

        return (
          <mesh key={r.id} position={[0, i * -1.2, 0]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={rt.texture}
              transparent
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
