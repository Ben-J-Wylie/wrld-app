// ReceiverShadow.tsx
import * as THREE from "three";
import React, { useEffect } from "react";

interface ReceiverShadowProps {
  casterRef: React.RefObject<THREE.Object3D | null>;
  receiverRef: React.RefObject<THREE.Object3D | null>;
  shadowRef: React.RefObject<THREE.Mesh | null>;
  fadeRange?: number;
  penumbraFactor?: number;
}

export function ReceiverShadow({
  casterRef,
  receiverRef,
  shadowRef,
  fadeRange = 0.8,
  penumbraFactor = 0.25,
}: ReceiverShadowProps) {
  useEffect(() => {
    const caster = casterRef.current;
    const receiver = receiverRef.current;
    const shadow = shadowRef.current;

    if (!caster || !receiver || !shadow) return;

    const distance = receiver.position.z - caster.position.z;

    if (distance < 0) {
      shadow.visible = false;
      return;
    }

    const material = shadow.material as THREE.MeshBasicMaterial;
    const strength = 1 - THREE.MathUtils.clamp(distance / fadeRange, 0, 1);

    material.opacity = strength * material.opacity;

    const scale = 1 + distance * penumbraFactor;
    shadow.scale.set(scale, scale, 1);
  }, []);

  return null;
}
