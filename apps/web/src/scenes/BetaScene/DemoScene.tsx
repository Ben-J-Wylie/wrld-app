// MyScene.tsx
import React from "react";

import { Stage } from "../../components/containers/SceneCore/Stage";
import { Backdrop } from "../../components/containers/SceneCore/Layers/Backdrop";
import { CameraPin } from "../../components/containers/SceneCore/Layers/CameraPin";
import { Group } from "../../components/containers/SceneCore/Layers/Group";
import { Toggle3D } from "../../components/elements/_Toggle3D/Toggle3D";

const backdropSizes = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

export function DemoScene() {
  return (
    <Stage backdrop={backdropSizes}>
      <CameraPin anchorX="center" anchorY="top" anchorZ={900} offsetY={-100}>
        <Toggle3D width={1000} height={200} />
      </CameraPin>

      <Group
        position={{
          mobile: [0, 0, 0],
          tablet: [0, 0, 0],
          desktop: [0, 0, 100],
        }}
      >
        <Toggle3D width={200} height={50} position={[-200, 10, 20]} />
        <Toggle3D width={200} height={50} position={[-200, 60, 50]} />
        <Toggle3D width={200} height={50} position={[-200, -50, 100]} />
      </Group>

      <Backdrop />
    </Stage>
  );
}
