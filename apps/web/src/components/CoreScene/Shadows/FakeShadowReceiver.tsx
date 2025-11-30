// FakeShadowReceiver.tsx
import React, { useEffect } from "react";
import * as THREE from "three";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowReceiverProps {
  id: string;
  meshRef: React.RefObject<THREE.Mesh>;

  /**
   * Mask texture used to clip shadows on this receiver.
   * Usually the PNG used for this image plane.
   */
  alphaMap?: THREE.Texture | null;
}

export function FakeShadowReceiver({
  id,
  meshRef,
  alphaMap,
}: FakeShadowReceiverProps) {
  const { registerReceiver, unregisterReceiver } =
    React.useContext(FakeShadowContext);

  useEffect(() => {
    registerReceiver({ id, meshRef, alphaMap: alphaMap || null });
    return () => unregisterReceiver(id);
  }, [id, meshRef, alphaMap, registerReceiver, unregisterReceiver]);

  // Does not render anything
  return null;
}
