// SceneStore.ts
import { create } from "zustand";

export type Breakpoint = "mobile" | "tablet" | "desktop";

interface SceneState {
  sceneWidth: number;
  sceneHeight: number;

  breakpoint: Breakpoint;

  setSceneSize: (w: number, h: number) => void;
  setBreakpoint: (bp: Breakpoint) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  sceneWidth: 10,
  sceneHeight: 10,

  // Default: desktop
  breakpoint: "desktop",

  setSceneSize: (w, h) => set({ sceneWidth: w, sceneHeight: h }),

  setBreakpoint: (bp) => set({ breakpoint: bp }),
}));
