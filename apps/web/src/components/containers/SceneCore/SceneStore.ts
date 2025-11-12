import { create } from "zustand";

/**
 * SceneStore
 * -----------------------------------------------------------------------------
 * This store holds all the live, shared state for your 3D scene.
 *
 * Purpose:
 *   - Keep camera, scroll, and world dimensions in sync across components.
 *   - Provide a single source of truth for anything that changes in real time.
 *
 * Ownership:
 *   - The "external scene" (for example, DemoScene.tsx) is the **only writer**
 *     of the world dimensions.
 *   - The BackgroundPlane, Camera, and Scroll systems are **readers** that
 *     react to these values automatically.
 *
 * Hierarchy of truth:
 *   SceneConfig → (fallback defaults)
 *   External scene → (sets world size)
 *   SceneStore → (broadcasts values)
 *   BackgroundPlane / Camera / Scroll → (read reactively)
 */

interface SceneStoreState {
  /* ------------------------------------------------------------------------ */
  /* 🎢 Scroll                                                              */
  /* ------------------------------------------------------------------------ */
  // A normalized scroll position between 0–1.
  // Used by parallax layers or camera rigs to move through the scene.
  scroll: number;
  setScroll: (value: number) => void;

  /* ------------------------------------------------------------------------ */
  /* 🖥️ Viewport                                                            */
  /* ------------------------------------------------------------------------ */
  // The current pixel dimensions of the browser window or canvas.
  // Updated by resize events so camera projection stays correct.
  viewportWidth: number;
  viewportHeight: number;
  setViewport: (w: number, h: number) => void;

  /* ------------------------------------------------------------------------ */
  /* 🎥 Camera FOV                                                          */
  /* ------------------------------------------------------------------------ */
  // The camera's current field of view in degrees.
  // Updated automatically when world size or aspect ratio changes.
  fov: number;
  setFov: (f: number) => void;

  /* ------------------------------------------------------------------------ */
  /* 🪟 Visible Height                                                      */
  /* ------------------------------------------------------------------------ */
  // The height of the view frustum at the camera's current distance.
  // Used to scale scroll distance and depth correctly.
  visibleHeight: number;
  setVisibleHeight: (h: number) => void;

  /* ------------------------------------------------------------------------ */
  /* 🌍 World Dimensions (authoritative size of your 3D world)              */
  /* ------------------------------------------------------------------------ */
  // These represent the real-world width and height of the entire scene.
  // They are set once by the external scene (e.g. DemoScene.tsx)
  // and then read by everything else (BackgroundPlane, Camera, etc.)
  worldWidth?: number;
  worldHeight?: number;
  setWorldWidth: (w: number) => void;
  setWorldHeight: (h: number) => void;
}

/* -------------------------------------------------------------------------- */
/* 🧠 Implementation                                                         */
/* -------------------------------------------------------------------------- */
// Zustand's "create" builds a simple reactive store.
// Components can read values with `useSceneStore((s) => s.value)`
// and update values with the provided setter functions.

export const useSceneStore = create<SceneStoreState>((set) => ({
  /* ------------------------- Scroll state -------------------------------- */
  scroll: 0,
  setScroll: (value) => set({ scroll: value }),

  /* ------------------------- Viewport size ------------------------------- */
  viewportWidth: 0,
  viewportHeight: 0,
  setViewport: (w, h) => set({ viewportWidth: w, viewportHeight: h }),

  /* ------------------------- Camera FOV ---------------------------------- */
  fov: 0,
  setFov: (f) => set({ fov: f }),

  /* ------------------------- Visible height ------------------------------ */
  visibleHeight: 0,
  setVisibleHeight: (h) => set({ visibleHeight: h }),

  /* ------------------------- World dimensions ---------------------------- */
  worldWidth: undefined,
  worldHeight: undefined,
  setWorldWidth: (w) => set({ worldWidth: w }),
  setWorldHeight: (h) => set({ worldHeight: h }),
}));



// SceneConfig (defaults)
//        │
//        ▼
// External Scene (e.g. DemoScene.tsx)
//        │   sets
//        ▼
// SceneStore  ← single source of truth
//        │   (reactive subscription)
//        ▼
// BackgroundPlane / Camera / Scroll
//        │
//        ▼
// Rendered Scene (visually consistent)