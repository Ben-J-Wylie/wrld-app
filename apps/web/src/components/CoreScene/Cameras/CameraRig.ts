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

  // Initial placement flag
  let hasPlacedInitially = false;

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

    // One-time initial placement based on scrollable axis
    if (!hasPlacedInitially) {
      const verticalOnly = maxY > 1e-6 && maxX < 1e-6;
      const horizontalOnly = maxX > 1e-6 && maxY < 1e-6;

      if (verticalOnly) {
        // Tall scene → start at TOP
        camera.position.x = 0;
        camera.position.y = maxY;
      } else if (horizontalOnly) {
        // Wide scene → start at LEFT
        camera.position.x = -maxX;
        camera.position.y = 0;
      } else {
        // Mixed or no scroll → center
        camera.position.x = 0;
        camera.position.y = 0;
      }

      hasPlacedInitially = true;
    }

    // Always clamp after limits update
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxX, maxX);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, -maxY, maxY);

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

    // Optional external trigger (not strictly required anymore)
    onResizeOrFovChange() {
      computeLimits();
    },

    // Called every frame by SceneCore engine loop
    onFrameUpdate() {
      if (needsRecalc()) {
        computeLimits();
      }
    },

    getLimits() {
      return { maxX, maxY };
    },
  };
}
