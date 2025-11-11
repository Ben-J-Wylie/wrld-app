import { create } from "zustand";

/**
 * SceneStore
 * -----------------------------------------------------------------------------
 * Global reactive state for scene and camera properties.
 * Manages scroll, viewport, world dimensions, and visible height.
 */

interface SceneStoreState {
  scroll: number;
  setScroll: (value: number) => void;

  viewportWidth: number;
  viewportHeight: number;
  setViewport: (w: number, h: number) => void;

  visibleHeight: number;
  setVisibleHeight: (h: number) => void;

  backgroundWidth?: number;
  backgroundHeight?: number;
  setWorldHeight: (h: number) => void;
  setWorldWidth: (w: number) => void;
}

export const useSceneStore = create<SceneStoreState>((set) => ({
  scroll: 0,
  setScroll: (value) => set({ scroll: value }),

  viewportWidth: 0,
  viewportHeight: 0,
  setViewport: (w, h) => set({ viewportWidth: w, viewportHeight: h }),

  visibleHeight: 0,
  setVisibleHeight: (h) => set({ visibleHeight: h }),

  backgroundWidth: undefined,
  backgroundHeight: undefined,
  setWorldHeight: (h) => set({ backgroundHeight: h }),
  setWorldWidth: (w) => set({ backgroundWidth: w }),
}));
