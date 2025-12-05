// NestedToggleScene.tsx

import { Backdrop } from "../../../CoreScene/Layers/Backdrop";
import { Stage } from "../../../CoreScene/Stage";
import { Group } from "../../../CoreScene/Layers/Group";

import { ImagePlane } from "../../../CoreScene/Geometry/ImagePlane";
import { NestedToggle } from "../../NestedToggle/NestedToggle";

import { StreamingSync } from "../../../CoreStream/StreamingSync";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";
import { useRef, useEffect } from "react";

import { AudioFeedPlane } from ".//AudioFeedPlane";

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
          name="GlobalLive"
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
          id="AudioLive"
          name="AudioLive"
          position={{
            mobile: [0, 80, 0],
            tablet: [0, 80, 0],
            desktop: [0, 80, 0],
          }}
        />
      </Group>

      {/* -------------------------------------------- */}
      {/* OPTIONAL: Place camera feed on an image plane */}
      {/* -------------------------------------------- */}

      <AudioFeedPlane
        msc={mscRef.current}
        peerId="self"
        name="CameraFeed"
        width={{ mobile: 200, tablet: 220, desktop: 260 }}
        height={{ mobile: 120, tablet: 140, desktop: 160 }}
        position={{
          mobile: [0, -80, 50],
          tablet: [0, -80, 50],
          desktop: [0, -80, 50],
        }}
      />

      <Backdrop />
    </Stage>
  );
}
