// src/SceneStore.ts
import { create } from "zustand";

interface SceneState {
  sceneWidth: number;
  sceneHeight: number;

  setSceneWidth: (w: number) => void;
  setSceneHeight: (h: number) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  sceneWidth: 10, // default fallback
  sceneHeight: 10, // default fallback

  setSceneWidth: (w) => set({ sceneWidth: w }),
  setSceneHeight: (h) => set({ sceneHeight: h }),
}));
