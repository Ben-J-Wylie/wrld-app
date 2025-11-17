// src/components/containers/SceneCore/Cameras/CameraRig.ts
// -----------------------------------------------------------------------------
// CameraRig — Production Version
// -----------------------------------------------------------------------------
// Responsibilities:
//  - Calculate camera movement bounds from:
//      • sceneWidth / sceneHeight (backdrop)
//      • camera FOV (dynamic, adaptive FOV)
//      • camera aspect ratio
//      • cameraZ position
//  - Clamp camera movement so we *never* expose outside backdrop
//  - Update limits on:
//      • backdrop dimension changes
//      • viewport resize
//      • camera FOV changes (smooth updates every frame)
// -----------------------------------------------------------------------------
// Output API:
//    rig.setOffset(x, y)     → clamps and applies movement
//    rig.onFovOrResize()     → recalculates movement limits
//    rig.getLimits()         → ScrollController pulls this each frame
// -----------------------------------------------------------------------------

import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  cameraZ: number
) {
  // Current movement limits — updated by updateLimits()
  let maxX = 0;
  let maxY = 0;

  // Cache to avoid redundant math
  let prevFov = camera.fov;
  let prevAspect = camera.aspect;
  let prevSceneWidth = 0;
  let prevSceneHeight = 0;

  /**
   * --------------------------------------------------------------------------
   * updateLimits()
   * - Central math that clamps camera movement to stay inside backdrop.
   * - Called on:
   *     • Resize
   *     • Scene dimension changes
   *     • FOV changes (smooth updates)
   * --------------------------------------------------------------------------
   */
  const updateLimits = () => {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();

    if (!W || !H) {
      maxX = maxY = 0;
      return;
    }

    // Camera's vertical FOV in radians
    const vFov = THREE.MathUtils.degToRad(camera.fov);

    // Frustum height/width at distance Z
    const frustumHalfHeight = Math.tan(vFov / 2) * cameraZ;
    const frustumHalfWidth = frustumHalfHeight * camera.aspect;

    // Amount of background area available past the camera frustum
    maxX = Math.max(0, W / 2 - frustumHalfWidth);
    maxY = Math.max(0, H / 2 - frustumHalfHeight);

    // Cache for next frame
    prevFov = camera.fov;
    prevAspect = camera.aspect;
    prevSceneWidth = W;
    prevSceneHeight = H;
  };

  // Initial computation
  updateLimits();

  /**
   * Detect whether anything changed that requires a limit recompute.
   * Called every frame via rig.onFrameUpdate()
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

  /**
   * PUBLIC API
   */
  return {
    /**
     * setOffset(x, y)
     * Applies movement (clamped within allowed range)
     */
    setOffset(x: number, y: number) {
      const cx = THREE.MathUtils.clamp(x, -maxX, maxX);
      const cy = THREE.MathUtils.clamp(y, -maxY, maxY);

      camera.position.x = cx;
      camera.position.y = cy;
    },

    /**
     * onResizeOrFovChange()
     * Called externally when:
     *  - window resize
     *  - backdrop dimension changes
     *  - manual FOV updates
     */
    onResizeOrFovChange() {
      updateLimits();
    },

    /**
     * onFrameUpdate()
     * Called once per animation frame.
     * - Detects smooth FOV changes from adaptive SceneCamera
     * - Keeps limits perfectly in sync
     */
    onFrameUpdate() {
      if (needsRecalc()) {
        updateLimits();
      }
    },

    /**
     * getLimits()
     * Used by ScrollController every frame
     */
    getLimits() {
      return { maxX, maxY };
    },
  };
}
