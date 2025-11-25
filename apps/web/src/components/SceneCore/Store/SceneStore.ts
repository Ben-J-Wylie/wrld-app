// SceneStore.ts
import { create } from "zustand";

interface SceneState {
  sceneWidth: number;
  sceneHeight: number;

  setSceneSize: (w: number, h: number) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  sceneWidth: 10,
  sceneHeight: 10,

  setSceneSize: (w, h) => set({ sceneWidth: w, sceneHeight: h }),
}));
