// NestedToggleScene.tsx

import { Backdrop } from "../../../CoreScene/Layers/Backdrop";
import { Stage } from "../../../CoreScene/Stage";
import { Group } from "../../../CoreScene/Layers/Group";
import { NestedToggle } from "../../NestedToggle/NestedToggle";

import { StreamingSync } from "../StreamingSync";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";
import { useRef, useEffect } from "react";

import { CameraFeedPlane } from "../Camera/CameraFeedPlane";

const backdropSizes = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

export function AppScene() {
  // --------------------------------------------
  // Persistent MediaSoup client
  // --------------------------------------------
  const mscRef = useRef<MediaSoupClient | null>(null);

  if (!mscRef.current) {
    mscRef.current = new MediaSoupClient();
  }

  // --------------------------------------------
  // Sync toggles → camera/mic/screenShare
  // --------------------------------------------
  StreamingSync(mscRef.current);

  return (
    <Stage backdrop={backdropSizes}>
      <Group
        name="NestedToggleGroup"
        position={{
          mobile: [0, 0, 10],
          tablet: [0, 0, 10],
          desktop: [0, 0, 10],
        }}
        rotation={{ mobile: [0, 0, 0], tablet: [0, 0, 0], desktop: [0, 0, 0] }}
        scale={{ mobile: [1, 1, 1], tablet: [1, 1, 1], desktop: [1, 1, 1] }}
        anchor={[0.5, 0.5, 0]}
        visible={true}
      >
        {/* ============================================================ */}
        {/* ROOT TOGGLE */}
        {/* ============================================================ */}
        <NestedToggle
          id="GlobalLive"
          name="Global Live"
          position={{
            mobile: [0, 200, 0],
            tablet: [0, 200, 0],
            desktop: [0, 200, 0],
          }}
        />

        {/* ============================================================ */}
        {/* LEVEL 2 */}
        {/* ============================================================ */}
        <NestedToggle
          id="CameraLive"
          parentId="GlobalLive"
          name="Camera Live"
          position={{
            mobile: [0, 80, 0],
            tablet: [0, 80, 0],
            desktop: [0, 80, 0],
          }}
        />

        <NestedToggle
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
        {/* LEVEL 3 */}
        {/* ============================================================ */}
        <NestedToggle
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

      {/* -------------------------------------------- */}
      {/* OPTIONAL: Place camera feed on an image plane */}
      {/* -------------------------------------------- */}

      <CameraFeedPlane
        msc={mscRef.current}
        peerId="self"
        name="CameraFeed"
        width={{ mobile: 200, tablet: 220, desktop: 260 }}
        height={{ mobile: 120, tablet: 140, desktop: 160 }}
        position={{
          mobile: [0, -320, 0],
          tablet: [0, -320, 0],
          desktop: [0, -320, 0],
        }}
        cornerRadius={{ mobile: 20, tablet: 20, desktop: 20 }}
        castShadow
        receiveShadow
      />

      <Backdrop />
    </Stage>
  );
}
