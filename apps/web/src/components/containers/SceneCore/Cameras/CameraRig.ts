// src/components/containers/SceneCore/Cameras/CameraRig.ts
// -----------------------------------------------------------------------------
// CameraRig — clamps camera movement so the frustum never exposes backdrop edges
// -----------------------------------------------------------------------------

import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  cameraZ: number
) {
  // Limits
  let maxX = 0;
  let maxY = 0;

  // Cached values
  let prevFov = camera.fov;
  let prevAspect = camera.aspect;
  let prevW = 0;
  let prevH = 0;

  // Initial placement logic
  let readyForInitialPlacement = false;
  let hasPlacedInitially = false;
  let placementPasses = 0;

  // ----------------------------------------------------
  // computeLimits() — core math
  // ----------------------------------------------------
  function computeLimits() {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();

    if (!W || !H) {
      maxX = maxY = 0;
      return;
    }

    // Vertical FOV in radians
    const vFov = THREE.MathUtils.degToRad(camera.fov);

    // Half-visual size at depth cameraZ
    const halfHeight = Math.tan(vFov / 2) * cameraZ;
    const halfWidth = halfHeight * camera.aspect;

    // Backdrop constraints
    maxX = Math.max(0, W / 2 - halfWidth);
    maxY = Math.max(0, H / 2 - halfHeight);

    // Two passes → stable values (because FOV is easing)
    const nonZero = maxX > 1e-6 || maxY > 1e-6;
    if (nonZero) placementPasses++;
    if (placementPasses >= 2) readyForInitialPlacement = true;

    // If we've already placed once, keep camera clamped
    if (hasPlacedInitially) {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxX, maxX);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, -maxY, maxY);
    }

    // Cache
    prevFov = camera.fov;
    prevAspect = camera.aspect;
    prevW = W;
    prevH = H;
  }

  // ----------------------------------------------------
  // needsRecalc()
  // ----------------------------------------------------
  function needsRecalc() {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();
    return (
      W !== prevW ||
      H !== prevH ||
      camera.fov !== prevFov ||
      camera.aspect !== prevAspect
    );
  }

  // ----------------------------------------------------
  // initialPlacement()
  // ----------------------------------------------------
  function initialPlacement() {
    if (!readyForInitialPlacement || hasPlacedInitially) return;

    const verticalOnly = maxY > 1e-6 && maxX < 1e-6;
    const horizontalOnly = maxX > 1e-6 && maxY < 1e-6;

    if (verticalOnly) {
      // We scroll vertically → start at TOP
      camera.position.x = 0;
      camera.position.y = maxY;
    } else if (horizontalOnly) {
      // Horizontal scroller → start at LEFT
      camera.position.x = -maxX;
      camera.position.y = 0;
    } else {
      // Mixed or no scroll → center
      camera.position.x = 0;
      camera.position.y = 0;
    }

    hasPlacedInitially = true;
  }

  // ----------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------
  return {
    // Called by your ScrollController
    setOffset(x: number, y: number) {
      camera.position.x = THREE.MathUtils.clamp(x, -maxX, maxX);
      camera.position.y = THREE.MathUtils.clamp(y, -maxY, maxY);
    },

    getOffset() {
      return {
        x: camera.position.x,
        y: camera.position.y,
      };
    },

    // Triggered by resize + FOV change
    onResizeOrFovChange() {
      computeLimits();
      initialPlacement();
    },

    // Called every frame by SceneCore engine loop
    onFrameUpdate() {
      if (needsRecalc()) {
        computeLimits();
        initialPlacement();
      }
    },

    getLimits() {
      return { maxX, maxY };
    },
  };
}
