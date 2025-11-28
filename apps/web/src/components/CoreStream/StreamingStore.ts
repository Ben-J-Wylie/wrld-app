import { create } from "zustand";

export type StreamingStore =
  | "camera"
  | "frontCamera"
  | "backCamera"
  | "mic"
  | "screenShare"
  | "gyro"
  | "accelerometer"
  | "compass"
  | "torch"
  | "chat";

export interface StreamingState {
  features: Record<StreamingStore, boolean>;
  setFeature: (key: StreamingStore, value: boolean) => void;
  toggleFeature: (key: StreamingStore) => void;
}

const defaultFeatures: Record<StreamingStore, boolean> = {
  camera: false,
  frontCamera: false,
  backCamera: false,
  mic: false,
  screenShare: false,
  gyro: false,
  accelerometer: false,
  compass: false,
  torch: false,
  chat: false,
};

export const useStreamingStore = create<StreamingState>((set) => ({
  features: defaultFeatures,
  setFeature: (key, value) =>
    set((s) => ({ features: { ...s.features, [key]: value } })),

  toggleFeature: (key) =>
    set((s) => ({
      features: { ...s.features, [key]: !s.features[key] },
    })),
}));
