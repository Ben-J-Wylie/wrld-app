// src/components/containers/SceneCore/Layers/ScreenGroup.tsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import { ParentContext } from "../Utilities/ParentContext";

export interface ScreenGroupProps {
  children?: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export function ScreenGroup({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: ScreenGroupProps) {
  const stage = useStage();
  const cameraRoot = stage.getCameraRoot();
  const groupRef = useRef<THREE.Group | null>(null);

  const [mountedGroup, setMountedGroup] = useState<THREE.Group | null>(null);

  // ---------------------------------------------------
  // CREATE + ATTACH GROUP
  // ---------------------------------------------------
  useEffect(() => {
    const group = new THREE.Group();
    groupRef.current = group;

    group.position.set(...position);
    group.rotation.set(...rotation);
    group.scale.set(...scale);

    cameraRoot.add(group);

    setMountedGroup(group);

    return () => {
      cameraRoot.remove(group);
    };
  }, []); // run once

  // ---------------------------------------------------
  // UPDATE TRANSFORMS
  // ---------------------------------------------------
  useEffect(() => {
    const g = groupRef.current;
    if (!g) {
      return;
    }

    g.position.set(...position);
    g.rotation.set(...rotation);
    g.scale.set(...scale);

    g.updateMatrixWorld(true);
  }, [position, rotation, scale]);

  // ---------------------------------------------------
  // CHILDREN READY?
  // ---------------------------------------------------
  useEffect(() => {
    if (!mountedGroup) {
    } else {
    }
  }, [mountedGroup]);

  // ---------------------------------------------------
  // JSX RETURN — SAFE: no console.log inside JSX
  // ---------------------------------------------------
  return (
    <ParentContext.Provider value={mountedGroup}>
      {mountedGroup ? children : null}
    </ParentContext.Provider>
  );
}
