// What it does:
// - Acts as the shared memory for the system.
// - Stores:
//      - scroll: normalized scroll progress between 0–1.
//      - viewport: width and height.
// - Exposes setters so other components can update or use this data.

// Controls & effects:
// - Anything that changes scroll (user scrolling, custom animation) will drive parallax.
// - Updating the viewport dimensions lets camera or content respond to resizing.

// src/parallax/ParallaxStore.ts
// src/parallax/ParallaxStore.ts
import { create } from "zustand";

interface ParallaxState {
  scroll: number;
  viewport: { w: number; h: number };
  backgroundWidth: number;
  backgroundHeight: number;
  setScroll: (v: number) => void;
  setViewport: (w: number, h: number) => void;
  setBackgroundWidth: (width: number) => void;
  setBackgroundHeight: (height: number) => void;
}

export const useParallaxStore = create<ParallaxState>((set) => ({
  scroll: 0,
  viewport: { w: window.innerWidth, h: window.innerHeight },
  backgroundWidth: 10, // default composition width
  backgroundHeight: 0, // updated once BackgroundPlane mounts

  // setters
  setScroll: (v) => set({ scroll: v }),
  setViewport: (w, h) => set({ viewport: { w, h } }),
  setBackgroundWidth: (width) => set({ backgroundWidth: width }),
  setBackgroundHeight: (height) => set({ backgroundHeight: height }),
}));
