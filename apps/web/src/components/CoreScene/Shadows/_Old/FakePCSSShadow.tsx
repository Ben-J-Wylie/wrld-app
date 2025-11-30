// FakePCSSShadow.tsx
import * as THREE from "three";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

interface FakePCSSShadowProps {
  casterRef: React.RefObject<THREE.Object3D | null>;
  texture: THREE.Texture;
  lightDir: THREE.Vector3;
  baseOpacity?: number;
  offsetAmount?: number;
}

export function FakePCSSShadow({
  casterRef,
  texture,
  lightDir,
  baseOpacity = 0.35,
  offsetAmount = 0.1,
}: FakePCSSShadowProps) {
  const shadowRef = useRef<THREE.Mesh>(null!);

  const dir = useMemo(() => lightDir.clone().normalize(), [lightDir]);

  useFrame(() => {
    const caster = casterRef.current;
    const shadow = shadowRef.current;
    if (!caster || !shadow) return;

    shadow.position.copy(caster.position);
    shadow.position.x += dir.x * offsetAmount;
    shadow.position.y += dir.y * offsetAmount;
    shadow.position.z += dir.z * offsetAmount - 0.01;

    shadow.rotation.x = -Math.PI / 2; // still correct for floor
    shadow.rotation.z = 0;
    shadow.scale.set(1, 1, 1);
  });

  return (
    <mesh ref={shadowRef} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={baseOpacity}
        depthWrite={false}
      />
    </mesh>
  );
}
