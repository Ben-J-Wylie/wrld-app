// src/components/containers/SceneCore/Cameras/CameraRig.ts
// -----------------------------------------------------------------------------
// CameraRig — Final Corrected Version (prevents drift-right initialization)
// -----------------------------------------------------------------------------

import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  cameraZ: number
) {
  let maxX = 0;
  let maxY = 0;

  // Cached values to detect changes
  let prevFov = camera.fov;
  let prevAspect = camera.aspect;
  let prevSceneWidth = 0;
  let prevSceneHeight = 0;

  /**
   * updateLimits()
   * Recompute movement bounds based on:
   *  - FOV
   *  - aspect
   *  - sceneWidth / sceneHeight
   *  - cameraZ
   *
   * IMPORTANT FIX:
   *   Re-center or clamp camera after recomputing limits
   *   → prevents starting on right edge when X-scroll exists.
   */
  const updateLimits = () => {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();

    if (!W || !H) {
      maxX = maxY = 0;
      return;
    }

    // Camera's vertical FOV (radians)
    const vFov = THREE.MathUtils.degToRad(camera.fov);

    // Frustum footprint at cameraZ
    const frustumHalfHeight = Math.tan(vFov / 2) * cameraZ;
    const frustumHalfWidth = frustumHalfHeight * camera.aspect;

    // Max allowed movement before exposing backdrop edges
    maxX = Math.max(0, W / 2 - frustumHalfWidth);
    maxY = Math.max(0, H / 2 - frustumHalfHeight);

    // IMPORTANT FIX: clamp current camera pos to new bounds
    // This ensures the camera stays centered if possible.
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxX, maxX);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, -maxY, maxY);

    // Cache values
    prevFov = camera.fov;
    prevAspect = camera.aspect;
    prevSceneWidth = W;
    prevSceneHeight = H;
  };

  // Initial computation
  updateLimits();

  /**
   * Detect changes that require recalculation.
   */
  const needsRecalc = () => {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();

    return (
      W !== prevSceneWidth ||
      H !== prevSceneHeight ||
      camera.fov !== prevFov ||
      camera.aspect !== prevAspect
    );
  };

  // ------------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------------
  return {
    /**
     * Apply movement, clamped within allowed range.
     */
    setOffset(x: number, y: number) {
      const cx = THREE.MathUtils.clamp(x, -maxX, maxX);
      const cy = THREE.MathUtils.clamp(y, -maxY, maxY);

      camera.position.x = cx;
      camera.position.y = cy;
    },

    /**
     * Recompute limits (used in resize + instant updates).
     */
    onResizeOrFovChange() {
      updateLimits();
    },

    /**
     * Every frame: detect smooth FOV changes and update limits.
     */
    onFrameUpdate() {
      if (needsRecalc()) {
        updateLimits();
      }
    },

    /**
     * ScrollController uses this.
     */
    getLimits() {
      return { maxX, maxY };
    },
  };
}
