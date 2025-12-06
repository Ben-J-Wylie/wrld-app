// apps/web/src/wrld/CoreStream/StreamingSync.ts

import { useEffect } from "react";
import { ToggleNode } from "../Elements/NestedToggle/ToggleNode";
import { useStreamingStore } from "./StreamingStore";

import { CameraCapability } from "../Elements/Streaming/Camera/CameraCapability";
import { AudioCapability } from "../Elements/Streaming/Audio/AudioCapability";
import { ScreenFeedCapability } from "../Elements/Streaming/Screen/ScreenFeedCapability";

import { MediaSoupClient } from "../../lib/mediasoupClient";

export function StreamingSync(msc: MediaSoupClient) {
  const { state: cameraState } = ToggleNode("CameraLive");
  const { state: micState } = ToggleNode("AudioLive");
  const { state: screenState } = ToggleNode("ScreenLive");

  const streaming = useStreamingStore();

  // -----------------------------
  // CAMERA SYNC
  // -----------------------------
  useEffect(() => {
    console.log("🎛 StreamingSync: CameraLive state →", cameraState);

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
    console.log("🎛 StreamingSync: AudioLive state →", micState);

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

  // -----------------------------
  // SCREEN SHARE SYNC
  // -----------------------------
  useEffect(() => {
    console.log("🖥 🎛 StreamingSync: ScreenLive state →", screenState);

    const screen = ScreenFeedCapability(msc);

    if (screenState === "on" || screenState === "cued") {
      streaming.setFeature("screenShare", true);
      screen
        .onEnable()
        .catch((err) => console.error("🎛 screen.onEnable failed", err));
    } else if (screenState === "off") {
      streaming.setFeature("screenShare", false);
      screen
        .onDisable()
        .catch((err) => console.error("🎛 screen.onDisable failed", err));
    }
  }, [screenState]);
}
