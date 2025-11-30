// CoreScene/Shadows/FakePCSSShadowPlane.tsx
import * as THREE from "three";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

interface Props {
  casterRef: React.RefObject<THREE.Object3D>;
  receiverRef: React.RefObject<THREE.Object3D>;
  texture: THREE.Texture;
  lightDir: THREE.Vector3;

  baseSize: number; // base blob size in world units
  softness: number; // how fast size grows with distance
  maxDistance: number; // max ray distance to receive shadow
  baseOpacity: number; // opacity at distance 0
}

const _vCaster = new THREE.Vector3();
const _vPlane = new THREE.Vector3();
const _vNormal = new THREE.Vector3();
const _vLightDir = new THREE.Vector3();
const _vIntersection = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export function FakePCSSShadowPlane({
  casterRef,
  receiverRef,
  texture,
  lightDir,
  baseSize,
  softness,
  maxDistance,
  baseOpacity,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const caster = casterRef.current;
    const receiver = receiverRef.current;
    const mesh = meshRef.current;

    if (!caster || !receiver || !mesh) return;

    // Don’t cast onto self
    if (caster === receiver) {
      mesh.visible = false;
      return;
    }

    // World positions
    caster.getWorldPosition(_vCaster);
    receiver.getWorldPosition(_vPlane);

    // Receiver plane normal (local +Z transformed to world)
    receiver.getWorldQuaternion(_quat);
    _vNormal.set(0, 0, 1).applyQuaternion(_quat).normalize();

    // Ray direction from caster opposite to light direction
    _vLightDir.copy(lightDir).normalize(); // d = -L

    const denom = _vLightDir.dot(_vNormal);
    if (Math.abs(denom) < 1e-4) {
      // Ray nearly parallel to plane → no intersection
      mesh.visible = false;
      return;
    }

    const t = _vPlane.clone().sub(_vCaster).dot(_vNormal) / denom;

    if (t <= 0) {
      // Intersection is behind caster along the ray → no shadow
      mesh.visible = false;
      return;
    }

    if (t > maxDistance) {
      mesh.visible = false;
      return;
    }

    // Intersection point in world space
    _vIntersection.copy(_vCaster).addScaledVector(_vLightDir, t);

    // Convert intersection into receiver-local coordinates
    const localPos = receiver.worldToLocal(_vIntersection.clone());
    mesh.position.copy(localPos);
    mesh.position.z += 0.001; // tiny lift to avoid z-fighting

    // Penumbra scaling and fading based on distance
    const dist = t; // since _vLightDir is normalized
    const scale = baseSize + dist * softness;

    mesh.scale.set(scale, scale, 1);

    const mat = mesh.material as THREE.MeshBasicMaterial;
    const fade = 1 - THREE.MathUtils.clamp(dist / maxDistance, 0, 1);
    mat.opacity = baseOpacity * fade;

    mesh.visible = mat.opacity > 0.001;
  });

  return (
    <mesh ref={meshRef} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest={true}
      />
    </mesh>
  );
}
