import { create } from "zustand";

type ParallaxState = {
  scroll: number;
  viewport: { w: number; h: number };
  damping: number;
  setScroll: (v: number) => void;
  setViewport: (w: number, h: number) => void;
  setDamping: (v: number) => void;
};

export const useParallaxStore = create<ParallaxState>((set) => ({
  scroll: 0,
  damping: 0.1,
  viewport: { w: 1, h: 1 },
  setScroll: (scroll) => set({ scroll }),
  setViewport: (w, h) => set({ viewport: { w, h } }),
  setDamping: (v) => set({ damping: v }),
}));
