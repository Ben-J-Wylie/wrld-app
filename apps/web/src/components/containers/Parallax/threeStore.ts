// src/parallax/threeStore.ts
import { create } from "zustand";
import * as THREE from "three";

interface ThreeState {
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  setScene: (s: THREE.Scene) => void;
  setCamera: (c: THREE.Camera) => void;
}

export const useThreeStore = create<ThreeState>((set) => ({
  scene: null,
  camera: null,
  setScene: (scene) => set({ scene }),
  setCamera: (camera) => set({ camera }),
}));
