// src/components/containers/SceneCore/Layers/Group.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import { ParentContext, useParent } from "./ParentContext";

export interface GroupProps {
  children?: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  z?: number;
}

export function Group({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  z = 0,
}: GroupProps) {
  const stage = useStage();
  const parent = useParent();
  const groupRef = useRef(new THREE.Group());

  useEffect(() => {
    const g = groupRef.current;

    g.position.set(position[0], position[1], position[2] + z);
    g.rotation.set(rotation[0], rotation[1], rotation[2]);
    g.scale.set(scale[0], scale[1], scale[2]);

    stage.addObject(g, parent);

    return () => stage.removeObject(g);
  }, []);

  useEffect(() => {
    const g = groupRef.current;
    g.position.set(position[0], position[1], position[2] + z);
    g.rotation.set(rotation[0], rotation[1], rotation[2]);
    g.scale.set(scale[0], scale[1], scale[2]);
  }, [position, rotation, scale, z]);

  return (
    <ParentContext.Provider value={groupRef.current}>
      {children}
    </ParentContext.Provider>
  );
}
