import { useEffect } from "react";
import { ToggleNode } from "../../NestedToggle/ToggleNode";
import { useStreamingStore } from "../StreamingStore";
import { CameraCapability } from "./CameraCapability";

export function useSyncCameraToggle(msc: any) {
  const { state } = ToggleNode("CameraLive");
  const streaming = useStreamingStore();

  useEffect(() => {
    const cap = CameraCapability(msc);

    if (state === "on" || state === "cued") {
      streaming.setFeature("camera", true);
      cap.onEnable();
    }

    if (state === "off") {
      streaming.setFeature("camera", false);
      cap.onDisable();
    }
  }, [state]);
}
