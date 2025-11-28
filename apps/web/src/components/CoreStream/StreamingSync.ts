// apps/web/src/wrld/CoreStream/StreamingSync.ts

import { useEffect } from "react";
import { ToggleNode } from "../Elements/NestedToggle/ToggleNode";
import { useStreamingStore } from "./StreamingStore";
import { CameraCapability } from "../Elements/Streaming/Camera/CameraCapability";
import { MediaSoupClient } from "../../lib/mediasoupClient";

export function StreamingSync(msc: MediaSoupClient) {
  const { state: cameraState } = ToggleNode("CameraLive");
  const streaming = useStreamingStore();

  useEffect(() => {
    console.log("🎛 StreamingSync: CameraLive state changed →", cameraState);

    const camera = CameraCapability(msc);

    if (cameraState === "on" || cameraState === "cued") {
      console.log("🎛 StreamingSync: enabling camera feature");
      streaming.setFeature("camera", true);
      camera.onEnable().catch((err) => {
        console.error("🎛 StreamingSync: camera.onEnable failed", err);
      });
    } else if (cameraState === "off") {
      console.log("🎛 StreamingSync: disabling camera feature");
      streaming.setFeature("camera", false);
      camera.onDisable().catch((err) => {
        console.error("🎛 StreamingSync: camera.onDisable failed", err);
      });
    }
  }, [cameraState]);
}
