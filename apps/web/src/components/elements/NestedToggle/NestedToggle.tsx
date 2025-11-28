// NestedToggleScene.tsx

import { Backdrop } from "../../containers/SceneCore/Layers/Backdrop";
import { Stage } from "../../containers/SceneCore/Stage";
import { Group } from "../../containers/SceneCore/Layers/Group";
import { ThreeStateToggle } from "../../elements/NestedToggle/ThreeStateToggle";

// import { ToggleTree } from "../../elements/NestedToggle/ToggleTree";

const backdropSizes = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

export function NestedToggle() {
  return (
    <Stage backdrop={backdropSizes}>
      {/* Wrapping group for convenience */}
      <Group
        name="NestedToggleGroup"
        position={{
          mobile: [0, 0, 50],
          tablet: [0, 0, 50],
          desktop: [0, 0, 50],
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
        {/* ============================================================ */}
        {/* ROOT TOGGLE (level 1) */}
        {/* ============================================================ */}
        <ThreeStateToggle
          id="GlobalLive"
          name="Global Live"
          position={{
            mobile: [0, 200, 0],
            tablet: [0, 200, 0],
            desktop: [0, 200, 0],
          }}
        />

        {/* ============================================================ */}
        {/* LEVEL 2 CHILDREN OF ROOT */}
        {/* ============================================================ */}
        <ThreeStateToggle
          id="CameraLive"
          parentId="GlobalLive"
          name="Camera Live"
          position={{
            mobile: [0, 80, 0],
            tablet: [0, 80, 0],
            desktop: [0, 80, 0],
          }}
        />

        <ThreeStateToggle
          id="AudioLive"
          parentId="GlobalLive"
          name="Audio Live"
          position={{
            mobile: [0, -40, 0],
            tablet: [0, -40, 0],
            desktop: [0, -40, 0],
          }}
        />

        {/* ============================================================ */}
        {/* LEVEL 3 — Child of CameraLive */}
        {/* ============================================================ */}
        <ThreeStateToggle
          id="CameraFeature"
          parentId="CameraLive"
          name="Camera Feature"
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
