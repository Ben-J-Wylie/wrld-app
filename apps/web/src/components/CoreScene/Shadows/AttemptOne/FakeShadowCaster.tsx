// CoreScene/Shadows/FakeShadowCaster.tsx
import * as THREE from "three";
import React, { useEffect } from "react";
import { FakeShadowContext } from "./FakeShadowContext";

interface Props {
  active: boolean;
  meshRef: React.RefObject<THREE.Object3D>;
}

export function FakeShadowCaster({ active, meshRef }: Props) {
  const { registerCaster, unregisterCaster } =
    React.useContext(FakeShadowContext);

  useEffect(() => {
    if (!active || !meshRef.current) return;

    const entry = {
      id: meshRef.current.uuid,
      ref: meshRef as React.RefObject<THREE.Object3D>,
    };

    registerCaster(entry);
    return () => unregisterCaster(entry);
  }, [active, meshRef, registerCaster, unregisterCaster]);

  // No visual output; purely a logical registration
  return null;
}
