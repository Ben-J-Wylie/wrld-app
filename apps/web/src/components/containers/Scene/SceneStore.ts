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
  setBackgroundSize: (w: number, h: number) => void;

  worldWidth?: number;
  worldHeight?: number;
  setWorldWidth: (w: number) => void;
  setWorldHeight: (h: number) => void;
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
  setBackgroundSize: (w, h) => set({ backgroundWidth: w, backgroundHeight: h }),

  worldWidth: undefined,
  worldHeight: undefined,
  setWorldWidth: (w) => set({ worldWidth: w }),
  setWorldHeight: (h) => set({ worldHeight: h }),
}));
