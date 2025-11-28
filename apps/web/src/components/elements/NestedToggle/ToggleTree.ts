// toggleFamilyConfig.ts
import { ToggleState } from "./ToggleTypes";

export const ToggleTree = {
  GlobalLive: {
    id: "GlobalLive",
    label: "Global Live",
    parentId: undefined,
    state: "off" as ToggleState,
  },

  CameraLive: {
    id: "CameraLive",
    label: "Camera Live",
    parentId: "GlobalLive",
    state: "off" as ToggleState,
  },

  CameraFeature: {
    id: "CameraFeature",
    label: "Camera Feature",
    parentId: "CameraLive",
    state: "off" as ToggleState,
  },

  AudioLive: {
    id: "AudioLive",
    label: "Audio Live",
    parentId: "GlobalLive",
    state: "off" as ToggleState,
  },
};
