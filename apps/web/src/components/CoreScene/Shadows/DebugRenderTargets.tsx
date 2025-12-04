// DebugRenderTargets.tsx — world-space RT previews

import React from "react";
import * as THREE from "three";
import { FakeShadowContext } from "./FakeShadowContext";

export function DebugRenderTargets() {
  const { receivers } = React.useContext(FakeShadowContext);

  return (
    <group position={[7, 4, 0]}>
      {receivers.map((r, i) => {
        const rt = r.shadowRT;
        if (!rt) return null;

        // Compute aspect ratio of RT
        const w = rt.width;
        const h = rt.height;
        const aspect = w / h;

        // Make preview height constant, scale width by aspect
        const previewHeight = 1;
        const previewWidth = previewHeight * aspect;

        return (
          <mesh
            key={r.id}
            position={[0, i * -1.2, 0]}
            scale={[previewWidth, previewHeight, 1]}
          >
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
