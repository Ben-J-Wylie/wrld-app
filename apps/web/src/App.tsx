// App.tsx
import React, { useEffect } from "react";
import { Stage } from "./components/containers/SceneCore/Stage/Stage";
import { ImagePlane } from "./components/containers/SceneObjects/Geometry/ImagePlane";

import { Group } from "./components/containers/SceneCore/Layers/Group";
import { ScreenGroup } from "./components/containers/SceneCore/Layers/ScreenGroup";

import NestedToggle from "./components/elements/NestedToggle/NestedToggle";
import { toggleRegistry } from "./components/elements/NestedToggle/ToggleRegistry";
import { toggleFamilyConfig } from "./components/elements/NestedToggle/toggleConfig";
import { Dom3D } from "./components/containers/SceneCore/Layers/Dom3D";

export default function App() {
  useEffect(() => {
    Object.values(toggleFamilyConfig).forEach((node) => {
      toggleRegistry.register(node);
    });
  }, []);

  return (
    <Stage
      backdrop={{
        presetSizes: {
          mobile: { width: 750, height: 3000 },
          tablet: { width: 1024, height: 1024 },
          desktop: { width: 1920, height: 1080 },
        },
        position: [0, 0, 0],
      }}
    >
      <ScreenGroup z={500} anchorX="center" offsetY={-50} anchorY="top">
        <ImagePlane width={1500} height={400} />
      </ScreenGroup>
      {/* You can keep these for comparison if you like */}
      {/* <ImagePlane ... domContent={<NestedToggle id="GlobalLive" />} /> */}

      {/* 🔹 Root Toggle in 3D via Dom3D */}
      <Dom3D position={[0, 100, 100]} rotation={[0, 0, 0]}>
        <NestedToggle id="GlobalLive" />
      </Dom3D>

      {/* 🔹 Child Toggles */}
      <Dom3D position={[-100, 100, 60]}>
        <NestedToggle id="child1" />
      </Dom3D>

      <Dom3D position={[100, 100, 60]}>
        <NestedToggle id="child2" />
      </Dom3D>

      {/* 🔹 Grandchild */}
      <Dom3D position={[0, 0, 40]}>
        <NestedToggle id="grandchild" />
      </Dom3D>
    </Stage>
  );
}
