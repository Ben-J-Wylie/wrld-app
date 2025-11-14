// @ts-nocheck

import { create } from "zustand";
import * as THREE from "three";

/**
 * ThreeStore
 * -----------------------------------------------------------------------------
 * Holds references to the active Three.js Scene and Camera from the R3F context.
 * Used for overlays, inspectors, and external rendering utilities.
 */
interface ThreeStoreState {
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  setScene: (scene: THREE.Scene) => void;
  setCamera: (camera: THREE.Camera) => void;
}

export const useThreeStore = create<ThreeStoreState>((set) => ({
  scene: null,
  camera: null,
  setScene: (scene) => set({ scene }),
  setCamera: (camera) => set({ camera }),
}));
