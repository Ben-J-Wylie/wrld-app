// CoreScene/Shadows/FakeShadowReceiver.tsx
import * as THREE from "three";
import React from "react";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";
import { FakePCSSShadowPlane } from "./FakePCSSShadowPlane";

interface Props {
  active: boolean;
  receiverRef: React.RefObject<THREE.Object3D>;

  texture: THREE.Texture;
  lightDir: THREE.Vector3;

  baseSize: number;
  softness: number;
  maxDistance: number;
  baseOpacity: number;
}

export function FakeShadowReceiver({
  active,
  receiverRef,
  texture,
  lightDir,
  baseSize,
  softness,
  maxDistance,
  baseOpacity,
}: Props) {
  const { casters } = React.useContext(FakeShadowContext);

  if (!active) return null;

  // Debug: verifies caster registration
  useFrame(() => {
    if (!receiverRef.current) return;
    console.log("FakeShadowReceiver sees casters:", casters.length);
  });

  return (
    <>
      {casters.map((caster) => (
        <FakePCSSShadowPlane
          key={caster.id}
          casterRef={caster.ref}
          receiverRef={receiverRef}
          texture={texture}
          lightDir={lightDir}
          baseSize={baseSize}
          softness={softness}
          maxDistance={maxDistance}
          baseOpacity={baseOpacity}
        />
      ))}
    </>
  );
}
