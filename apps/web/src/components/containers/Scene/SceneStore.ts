import { create } from "zustand";

/**
 * SceneStore
 * -----------------------------------------------------------------------------
 * Global reactive state for scene and camera properties.
 * Manages scroll, viewport, world dimensions, FOV, and visible height.
 */

interface SceneStoreState {
  // 🔹 Scroll position (0–1 normalized)
  scroll: number;
  setScroll: (value: number) => void;

  // 🔹 Viewport dimensions
  viewportWidth: number;
  viewportHeight: number;
  setViewport: (w: number, h: number) => void;

  // 🔹 Camera FOV (updated dynamically)
  fov: number;
  setFov: (f: number) => void;

  // 🔹 Visible height (changes with aspect/FOV)
  visibleHeight: number;
  setVisibleHeight: (h: number) => void;

  // 🔹 Background / world size
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

  fov: 0,
  setFov: (f) => set({ fov: f }),

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
