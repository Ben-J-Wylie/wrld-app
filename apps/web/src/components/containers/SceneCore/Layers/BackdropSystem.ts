// BackdropSystem.ts
import * as THREE from "three";
import {
  initializeBackdrop,
  resizeBackdrop,
  BackdropDimensions,
} from "./Backdrop";

interface BackdropSystemOptions {
  scene: THREE.Scene;
  presetSizes: BackdropDimensions;
  updateSceneCamera?: () => void;
  cameraRig?: { onResizeOrFovChange?: () => void };
  position?: [number, number, number];
  color?: THREE.ColorRepresentation;
}

/**
 * Wraps the backdrop with a stable, predictable API for StageSystem.
 * Provides:
 * - mesh reference
 * - resize(width, height)
 * - cleanup()
 */
export function applyBackdropSystem({
  scene,
  presetSizes,
  updateSceneCamera,
  cameraRig,
  position = [0, 0, 0],
  color,
}: BackdropSystemOptions) {
  // ---------------------------------------
  // CREATE BACKDROP MESH
  // ---------------------------------------
  const mesh = initializeBackdrop(scene, presetSizes, color);
  mesh.position.set(...position);

  // ---------------------------------------
  // INITIAL CAMERA SYNC
  // ---------------------------------------
  updateSceneCamera?.();
  cameraRig?.onResizeOrFovChange?.();

  // ---------------------------------------
  // RESIZE HANDLER (public API)
  // ---------------------------------------
  function resize(width: number, height: number) {
    resizeBackdrop(mesh, width, height);

    updateSceneCamera?.();
    cameraRig?.onResizeOrFovChange?.();
  }

  // ---------------------------------------
  // CLEANUP
  // ---------------------------------------
  function cleanup() {
    scene.remove(mesh);

    mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) {
      mat.forEach((m) => m.dispose());
    } else {
      mat.dispose();
    }

    // Remove resize listener from initializeBackdrop()
    (mesh as any)._dispose?.();
  }

  // ---------------------------------------
  // RETURN PUBLIC API
  // ---------------------------------------
  return {
    mesh,
    resize,
    cleanup,
  };
}
