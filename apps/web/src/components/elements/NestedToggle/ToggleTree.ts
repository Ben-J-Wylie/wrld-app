// ToggleTree.ts
import { ToggleState } from "./ToggleState";

export interface ToggleTree {
  id: string;
  label: string;
  parentId?: string;
  state: ToggleState;
}

export const ToggleTree: Record<string, ToggleTree> = {
  GlobalLive: {
    id: "GlobalLive",
    label: "Global Live",
    parentId: undefined,
    state: "off",
  },

  CameraLive: {
    id: "CameraLive",
    label: "Camera Live",
    parentId: "GlobalLive",
    state: "off",
  },

  CameraFeature: {
    id: "CameraFeature",
    label: "Camera Feature",
    parentId: "CameraLive",
    state: "off",
  },

  AudioLive: {
    id: "AudioLive",
    label: "Audio Live",
    parentId: "GlobalLive",
    state: "off",
  },
};
