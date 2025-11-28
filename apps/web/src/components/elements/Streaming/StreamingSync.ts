import { useEffect } from "react";
import { ToggleNode } from "../NestedToggle/ToggleNode";
import { useStreamingStore } from "./StreamingStore";
import { CameraCapability } from "./Camera/CameraCapability";
import { MediaSoupClient } from "../../../lib/mediasoupClient";

export function StreamingSync(msc: MediaSoupClient) {
  // Listen to CameraLive toggle
  const { state: cameraState } = ToggleNode("CameraLive");
  const streaming = useStreamingStore();

  useEffect(() => {
    const camera = CameraCapability(msc);

    if (cameraState === "on" || cameraState === "cued") {
      streaming.setFeature("camera", true);
      camera.onEnable();
    } else if (cameraState === "off") {
      streaming.setFeature("camera", false);
      camera.onDisable();
    }
  }, [cameraState]);
}
