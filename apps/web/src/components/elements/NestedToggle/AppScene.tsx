// NestedToggleScene.tsx

import { useEffect } from "react";

import { Backdrop } from "../../CoreScene/Layers/Backdrop";
import { Stage } from "../../CoreScene/Stage";
import { Group } from "../../CoreScene/Layers/Group";
import { NestedToggle } from "./NestedToggle";

import { toggleRegistry } from "./ToggleRegistry";
import { ToggleTree } from "./ToggleTree";

export function AppScene() {
  // 🔥 Load the toggle hierarchy at startup
  useEffect(() => {
    toggleRegistry.clear();
    toggleRegistry.loadFromTree(ToggleTree);
  }, []);

  const backdropSizes = {
    mobile: { width: 720, height: 1920 },
    tablet: { width: 1280, height: 1280 },
    desktop: { width: 1920, height: 720 },
  };

  return (
    <Stage backdrop={backdropSizes}>
      <Group
        name="NestedToggleGroup"
        position={{
          mobile: [0, 0, 10],
          tablet: [0, 0, 10],
          desktop: [0, 0, 10],
        }}
        rotation={{
          mobile: [0, 0, 0],
          tablet: [0, 0, 0],
          desktop: [0, 0, 0],
        }}
        scale={{
          mobile: [1, 1, 1],
          tablet: [1, 1, 1],
          desktop: [1, 1, 1],
        }}
        anchor={[0.5, 0.5, 0]}
        visible={true}
      >
        {/* ---------------------------------------------------------------- */}
        {/*  Toggle hierarchy comes from ToggleTree, not the scene.          */}
        {/*  Scene ONLY places toggles visually.                             */}
        {/* ---------------------------------------------------------------- */}

        {/* ROOT TOGGLE */}
        <NestedToggle
          id="GlobalLive"
          position={{
            mobile: [0, 200, 0],
            tablet: [0, 200, 0],
            desktop: [0, 200, 0],
          }}
        />

        {/* CHILDREN */}
        <NestedToggle
          id="CameraLive"
          position={{
            mobile: [0, 80, 0],
            tablet: [0, 80, 0],
            desktop: [0, 80, 0],
          }}
        />

        <NestedToggle
          id="AudioLive"
          position={{
            mobile: [0, -40, 0],
            tablet: [0, -40, 0],
            desktop: [0, -40, 0],
          }}
        />

        {/* GRANDCHILD */}
        <NestedToggle
          id="CameraFeature"
          position={{
            mobile: [0, -160, 0],
            tablet: [0, -160, 0],
            desktop: [0, -160, 0],
          }}
        />
      </Group>

      <Backdrop />
    </Stage>
  );
}
