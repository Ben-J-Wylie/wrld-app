// StackedObject.tsx
import * as THREE from "three";
import React, { forwardRef, useRef } from "react";
import { FakePCSSShadow } from "./FakePCSSShadow";
import { ReceiverShadow } from "./ReceiverShadow";

interface StackedObjectProps {
  texture: THREE.Texture;
  shadowTexture: THREE.Texture;
  position: [number, number, number];
  lightDir: THREE.Vector3;
  allCasters: React.RefObject<THREE.Object3D | null>[];
}

export const StackedObject = forwardRef<THREE.Object3D, StackedObjectProps>(
  ({ texture, shadowTexture, position, lightDir, allCasters }, ref) => {
    const groupRef = ref as React.RefObject<THREE.Object3D | null>;
    const shadowRef = useRef<THREE.Mesh | null>(null);

    return (
      <group ref={groupRef} position={position}>
        <mesh rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[2, 1]} /> // make it bigger to see
          <meshBasicMaterial map={texture} transparent />
        </mesh>

        <FakePCSSShadow
          casterRef={groupRef}
          texture={shadowTexture}
          lightDir={lightDir}
        />

        {allCasters.map((caster, i) =>
          caster === groupRef ? null : (
            <ReceiverShadow
              key={i}
              casterRef={caster}
              receiverRef={groupRef}
              shadowRef={shadowRef}
            />
          )
        )}
      </group>
    );
  }
);
