// apps/web/src/wrld/CoreStream/StreamingSync.ts

import { useEffect } from "react";
import { ToggleNode } from "../Elements/NestedToggle/ToggleNode";
import { useStreamingStore } from "./StreamingStore";

import { CameraCapability } from "../Elements/Streaming/Camera/CameraCapability";
import { AudioCapability } from "../Elements/Streaming/Audio/AudioCapability";

import { MediaSoupClient } from "../../lib/mediasoupClient";

export function StreamingSync(msc: MediaSoupClient) {
  const { state: cameraState } = ToggleNode("CameraLive");
  const { state: micState } = ToggleNode("AudioLive");
  const streaming = useStreamingStore();

  // -----------------------------
  // CAMERA SYNC
  // -----------------------------
  useEffect(() => {
    console.log("🎛 StreamingSync: CameraLive state changed →", cameraState);

    const camera = CameraCapability(msc);

    if (cameraState === "on" || cameraState === "cued") {
      streaming.setFeature("camera", true);
      camera
        .onEnable()
        .catch((err) => console.error("🎛 camera.onEnable failed", err));
    } else if (cameraState === "off") {
      streaming.setFeature("camera", false);
      camera
        .onDisable()
        .catch((err) => console.error("🎛 camera.onDisable failed", err));
    }
  }, [cameraState]);

  // -----------------------------
  // MIC SYNC
  // -----------------------------
  useEffect(() => {
    console.log("🎛 StreamingSync: AudioLive state changed →", micState);

    const mic = AudioCapability(msc);

    if (micState === "on" || micState === "cued") {
      streaming.setFeature("mic", true);
      mic
        .onEnable()
        .catch((err) => console.error("🎛 mic.onEnable failed", err));
    } else if (micState === "off") {
      streaming.setFeature("mic", false);
      mic
        .onDisable()
        .catch((err) => console.error("🎛 mic.onDisable failed", err));
    }
  }, [micState]);
}
