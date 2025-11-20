// src/components/containers/SceneCore/Layers/ScreenGroup.tsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import { ParentContext } from "./ParentContext";

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
  console.log("%c[ScreenGroup] render()", "color: cyan");

  const stage = useStage();
  const cameraRoot = stage.getCameraRoot();
  const groupRef = useRef<THREE.Group | null>(null);

  const [mountedGroup, setMountedGroup] = useState<THREE.Group | null>(null);

  // ---------------------------------------------------
  // CREATE + ATTACH GROUP
  // ---------------------------------------------------
  useEffect(() => {
    console.log(
      "%c[ScreenGroup] useEffect → creating THREE.Group()",
      "color: yellow"
    );

    const group = new THREE.Group();
    groupRef.current = group;

    group.position.set(...position);
    group.rotation.set(...rotation);
    group.scale.set(...scale);

    console.log("[ScreenGroup] initial transforms:", {
      position,
      rotation,
      scale,
    });
    console.log("[ScreenGroup] cameraRoot =", cameraRoot);

    cameraRoot.add(group);
    console.log(
      "%c[ScreenGroup] group added to cameraRoot",
      "color: lightgreen"
    );

    setMountedGroup(group);

    return () => {
      console.log("%c[ScreenGroup] cleanup → removing group", "color: red");
      cameraRoot.remove(group);
    };
  }, []); // run once

  // ---------------------------------------------------
  // UPDATE TRANSFORMS
  // ---------------------------------------------------
  useEffect(() => {
    const g = groupRef.current;
    if (!g) {
      console.log(
        "%c[ScreenGroup] transform update skipped → no groupRef",
        "color: red"
      );
      return;
    }

    console.log("%c[ScreenGroup] updating transforms", "color: yellow", {
      newPosition: position,
      newRotation: rotation,
      newScale: scale,
    });

    g.position.set(...position);
    g.rotation.set(...rotation);
    g.scale.set(...scale);

    g.updateMatrixWorld(true);

    console.log("[ScreenGroup] world matrix:", g.matrixWorld.elements);
  }, [position, rotation, scale]);

  // ---------------------------------------------------
  // CHILDREN READY?
  // ---------------------------------------------------
  useEffect(() => {
    if (!mountedGroup) {
      console.log("%c[ScreenGroup] children not mounted yet", "color: gray");
    } else {
      console.log(
        "%c[ScreenGroup] children mounted, ParentContext active",
        "color: lightgreen"
      );
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
