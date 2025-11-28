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
    label: "GlobalLive",
    parentId: undefined,
    state: "off",
  },

  CameraLive: {
    id: "CameraLive",
    label: "CameraLive",
    parentId: "GlobalLive",
    state: "off",
  },

  CameraFeature: {
    id: "CameraFeature",
    label: "CameraFeature",
    parentId: "CameraLive",
    state: "off",
  },

  AudioLive: {
    id: "AudioLive",
    label: "AudioLive",
    parentId: "GlobalLive",
    state: "off",
  },
};
