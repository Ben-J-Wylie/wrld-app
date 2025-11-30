// FakeShadowCaster.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowCasterProps {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
  lightRef: React.RefObject<THREE.DirectionalLight>;
  shadowOpacity?: number;
}

/**
 * For each receiver in the FakeShadowContext, this component
 * creates a shadow plane and projects the caster onto it.
 */
export function FakeShadowCaster({
  id,
  targetRef,
  lightRef,
  shadowOpacity = 0.4,
}: FakeShadowCasterProps) {
  const { receivers, registerCaster, unregisterCaster } =
    React.useContext(FakeShadowContext);

  // one shadow plane mesh per receiverId
  const shadowRefs = useRef(new Map<string, THREE.Mesh>());

  const setShadowRef = (receiverId: string) => (mesh: THREE.Mesh | null) => {
    if (mesh) shadowRefs.current.set(receiverId, mesh);
    else shadowRefs.current.delete(receiverId);
  };

  // register this caster in the context (not strictly required
  // for projection, but useful if you ever want global introspection)
  useEffect(() => {
    registerCaster({ id, targetRef });
    return () => unregisterCaster(id);
  }, [id, targetRef, registerCaster, unregisterCaster]);

  // scratch objects to avoid allocations every frame
  const lightDir = useRef(new THREE.Vector3()).current;
  const casterPos = useRef(new THREE.Vector3()).current;
  const planePoint = useRef(new THREE.Vector3()).current;
  const planeNormal = useRef(new THREE.Vector3()).current;
  const hitPoint = useRef(new THREE.Vector3()).current;
  const rayDir = useRef(new THREE.Vector3()).current;

  useFrame(() => {
    const caster = targetRef.current;
    const light = lightRef.current;
    if (!caster || !light) return;

    // lightDir: direction from light TOWARD the scene
    light.getWorldDirection(lightDir).normalize();

    // caster world position
    caster.getWorldPosition(casterPos);

    for (const { id: receiverId, meshRef } of receivers) {
      // optional: skip self-shadow on same mesh
      if (receiverId === id) continue;

      const receiver = meshRef.current as THREE.Mesh | null;
      const shadowMesh = shadowRefs.current.get(receiverId);
      if (!receiver || !shadowMesh) continue;

      // receiver plane: point + normal
      receiver.getWorldPosition(planePoint);
      receiver.getWorldDirection(planeNormal); // for a plane mesh this is its normal

      // ray from caster opposite light direction
      rayDir.copy(lightDir).negate();

      const denom = rayDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) continue; // nearly parallel

      const t = planePoint.clone().sub(casterPos).dot(planeNormal) / denom;
      if (t < 0) continue; // intersection behind caster

      hitPoint.copy(casterPos).add(rayDir.multiplyScalar(t));

      // position shadow on receiver plane
      shadowMesh.position.copy(hitPoint);

      // align shadow orientation to receiver
      shadowMesh.quaternion.copy(receiver.quaternion);

      // basic scale fudge – you can make this depend on distance if you want
      shadowMesh.scale.set(1.2, 1.2, 1);
    }
  });

  return (
    <>
      {receivers
        // shadow plane per receiver (except self)
        .filter((r) => r.id !== id)
        .map((r) => (
          <mesh key={r.id} ref={setShadowRef(r.id)}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color="black"
              transparent
              opacity={shadowOpacity}
            />
          </mesh>
        ))}
    </>
  );
}
