// CameraRig.ts — Production Version
// Computes movement limits dynamically based on sceneWidth, sceneHeight,
// camera FOV, aspect ratio, and cameraZ.

import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  cameraZ: number
) {
  // Movement limits (updated whenever FOV/aspect changes)
  let maxX = 0;
  let maxY = 0;

  /**
   * ----------------------------------------------------------
   * updateLimits()
   * Recomputes the camera's allowed movement range.
   * Runs on:
   *  - backdrop initialization (sceneWidth/sceneHeight changes)
   *  - adaptive FOV changes
   *  - window resize
   * ----------------------------------------------------------
   */
  const updateLimits = () => {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();

    // If backdrop hasn’t been initialized yet
    if (!W || !H) {
      maxX = 0;
      maxY = 0;
      return;
    }

    // Compute frustum size at distance Z
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const frustumHalfHeight = Math.tan(vFov / 2) * cameraZ;
    const frustumHalfWidth = frustumHalfHeight * camera.aspect;

    // Determine available movement headroom
    maxX = Math.max(0, W / 2 - frustumHalfWidth);
    maxY = Math.max(0, H / 2 - frustumHalfHeight);
  };

  // Initial evaluation
  updateLimits();

  /**
   * PUBLIC API
   */
  return {
    /**
     * setOffset(x, y)
     * Applies clamped movement to the camera.
     */
    setOffset(x: number, y: number) {
      const cx = THREE.MathUtils.clamp(x, -maxX, maxX);
      const cy = THREE.MathUtils.clamp(y, -maxY, maxY);

      camera.position.x = cx;
      camera.position.y = cy;
    },

    /**
     * onResizeOrFovChange()
     * Should be called whenever:
     *  - camera FOV changes (adaptive FOV updates)
     *  - renderer resized (aspect changed)
     *  - backdrop size changed
     */
    onResizeOrFovChange() {
      updateLimits();
    },

    /**
     * getLimits()
     * ScrollController uses this every frame.
     */
    getLimits() {
      return { maxX, maxY };
    },
  };
}
