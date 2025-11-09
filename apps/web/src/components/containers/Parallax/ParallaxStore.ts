// What it does:
// - Acts as the shared memory for the system.
// - Stores:
//      - scroll: normalized scroll progress between 0–1.
//      - viewport: width and height.
// - Exposes setters so other components can update or use this data.

// Controls & effects:
// - Anything that changes scroll (user scrolling, custom animation) will drive parallax.
// - Updating the viewport dimensions lets camera or content respond to resizing.

import { create } from "zustand";

type ParallaxState = {
  scroll: number;
  viewport: { w: number; h: number };
  setScroll: (v: number) => void;
  setViewport: (w: number, h: number) => void;
};

export const useParallaxStore = create<ParallaxState>((set) => ({
  scroll: 0,
  viewport: { w: 1, h: 1 },
  setScroll: (scroll) => set({ scroll }),
  setViewport: (w, h) => set({ viewport: { w, h } }),
}));