import * as THREE from "three";
import { initializeBackdrop } from "./Backdrop";

interface BackdropSystemOptions {
  scene: THREE.Scene;

  /** { mobile: {width,height}, tablet:{...}, desktop:{...} } */
  presetSizes: any;

  /** updateSceneCameraInstant or updateSceneCameraSmooth */
  updateSceneCamera?: () => void;

  /** cameraRigRef.current */
  cameraRig?: {
    onResizeOrFovChange?: () => void;
  };

  position?: [number, number, number];
}

export function applyBackdropSystem({
  scene,
  presetSizes,
  updateSceneCamera,
  cameraRig,
  position = [0, 0, 0],
}: BackdropSystemOptions) {
  const backdrop = initializeBackdrop(scene, presetSizes);

  backdrop.position.set(...position);

  // Update camera + rig once backdrop sets sceneWidth/sceneHeight
  updateSceneCamera?.();
  cameraRig?.onResizeOrFovChange?.();

  return {
    backdrop,
    cleanup: () => {
      scene.remove(backdrop);
      backdrop.geometry?.dispose();
      if (backdrop.material) {
        (backdrop.material as any).dispose?.();
      }
    },
  };
}
