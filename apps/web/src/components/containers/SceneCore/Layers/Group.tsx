// SceneCore/Layers/Group.tsx
import { useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useStage } from "@/components/containers/SceneCore/Stage/useStage";

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
  const groupRef = useRef<THREE.Group | null>(null);
  const stage = useStage();
  const [injectedChildren, setInjectedChildren] =
    useState<React.ReactNode>(null);

  // -------------------------------------------------------------
  // MOUNT GROUP
  // -------------------------------------------------------------
  useLayoutEffect(() => {
    const group = new THREE.Group();

    group.position.set(position[0], position[1], position[2] + z);
    group.rotation.set(rotation[0], rotation[1], rotation[2]);
    group.scale.set(scale[0], scale[1], scale[2]);

    groupRef.current = group;

    // Register it with the stage as a parent
    stage.addObject(group);
    stage.pushParent(group);

    return () => {
      stage.popParent();
      stage.removeObject(group);
    };
  }, []);

  // -------------------------------------------------------------
  // CHILD INJECTION
  // -------------------------------------------------------------
  useLayoutEffect(() => {
    if (!groupRef.current) return;

    const injected = stage.injectChildrenInto(groupRef, children);
    setInjectedChildren(injected);
  }, [children]);

  // -------------------------------------------------------------
  // TRANSFORMS
  // -------------------------------------------------------------
  useLayoutEffect(() => {
    if (!groupRef.current) return;

    groupRef.current.position.set(position[0], position[1], position[2] + z);
    groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    groupRef.current.scale.set(scale[0], scale[1], scale[2]);
  }, [position, rotation, scale, z]);

  return <>{injectedChildren}</>;
}
