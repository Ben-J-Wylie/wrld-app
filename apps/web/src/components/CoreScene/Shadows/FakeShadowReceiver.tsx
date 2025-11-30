// FakeShadowReceiver.tsx
import React, { useEffect } from "react";
import * as THREE from "three";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowReceiverProps {
  id: string;
  meshRef: React.RefObject<THREE.Object3D>;
}

/**
 * Registers a mesh as a shadow receiver.
 * Any FakeShadowCaster will project onto all registered receivers.
 */
export function FakeShadowReceiver({ id, meshRef }: FakeShadowReceiverProps) {
  const { registerReceiver, unregisterReceiver } =
    React.useContext(FakeShadowContext);

  useEffect(() => {
    registerReceiver({ id, meshRef });
    return () => unregisterReceiver(id);
  }, [id, meshRef, registerReceiver, unregisterReceiver]);

  return null;
}
