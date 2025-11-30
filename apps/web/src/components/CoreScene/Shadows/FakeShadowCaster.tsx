// FakeShadowCaster.tsx
import React, { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export interface FakeShadowCasterProps {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
  lightRef: React.RefObject<THREE.DirectionalLight>;
  shadowOpacity?: number;
}

export function FakeShadowCaster({
  id,
  targetRef,
  lightRef,
  shadowOpacity = 0.4,
}: FakeShadowCasterProps) {
  const shadowRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const target = targetRef.current;
    const shadow = shadowRef.current;
    const light = lightRef.current;
    if (!target || !shadow || !light) return;

    // Get live light direction
    const lightDir = new THREE.Vector3();
    light.getWorldDirection(lightDir);
    lightDir.normalize();

    // World position of caster
    const worldPos = new THREE.Vector3();
    target.getWorldPosition(worldPos);

    // Project onto plane Z = 0
    const planeZ = 0;
    const t = (planeZ - worldPos.z) / lightDir.z;
    const projected = worldPos.clone().add(lightDir.clone().multiplyScalar(t));

    // Set shadow position
    shadow.position.set(projected.x, projected.y, planeZ + 0.001);

    // Orient toward camera-ish
    shadow.lookAt(shadow.position.x, shadow.position.y, shadow.position.z + 1);

    // Scale shadow
    shadow.scale.set(1.2, 1.2, 1);
  });

  return (
    <mesh ref={shadowRef}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="black" transparent opacity={shadowOpacity} />
    </mesh>
  );
}
