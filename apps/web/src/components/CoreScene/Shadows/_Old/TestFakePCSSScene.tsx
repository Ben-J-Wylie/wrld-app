// TestFakePCSSScene.tsx
import * as THREE from "three";
import React, { useMemo } from "react";
import { StackedObject } from "./StackedObject";

export function TestFakePCSSScene() {
  const cardTex = useMemo(
    () => new THREE.TextureLoader().load("/card.png"),
    []
  );

  const shadowTex = useMemo(
    () => new THREE.TextureLoader().load("/soft_shadow.png"),
    []
  );

  // Light goes downward & toward the camera
  const lightDir = new THREE.Vector3(0.2, -1, -0.3);

  // Create refs for casters
  const casters: React.RefObject<THREE.Object3D | null>[] = Array.from(
    { length: 4 },
    () => React.createRef<THREE.Object3D>()
  );

  return (
    <group position={[0, 0, 0]}>
      {/* Add ground so shadows are visible */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial color="#dddddd" />
      </mesh>

      {/* Add directional light for reference */}
      <directionalLight position={[2, 4, 2]} intensity={1} />

      {/* Stack objects vertically along Y, not Z */}
      <StackedObject
        ref={casters[0]}
        texture={cardTex}
        shadowTexture={shadowTex}
        position={[0, 1, 0]}
        lightDir={lightDir}
        allCasters={casters}
      />

      <StackedObject
        ref={casters[1]}
        texture={cardTex}
        shadowTexture={shadowTex}
        position={[0, 0.5, 0]}
        lightDir={lightDir}
        allCasters={casters}
      />

      <StackedObject
        ref={casters[2]}
        texture={cardTex}
        shadowTexture={shadowTex}
        position={[0, 0, 0]}
        lightDir={lightDir}
        allCasters={casters}
      />

      <StackedObject
        ref={casters[3]}
        texture={cardTex}
        shadowTexture={shadowTex}
        position={[0, -0.5, 0]}
        lightDir={lightDir}
        allCasters={casters}
      />
    </group>
  );
}
