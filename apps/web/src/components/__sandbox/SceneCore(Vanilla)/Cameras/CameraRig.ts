// src/components/containers/SceneCore/Cameras/CameraRig.ts
// -----------------------------------------------------------------------------
// CameraRig — owns camera limits AND initial placement (corrected + stable)
// -----------------------------------------------------------------------------

import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  cameraZ: number
) {
  let maxX = 0;
  let maxY = 0;

  // Cached values
  let prevFov = camera.fov;
  let prevAspect = camera.aspect;
  let prevSceneWidth = 0;
  let prevSceneHeight = 0;

  // Initial placement flags
  let hasInitialPlacement = false;

  // We need to detect when limits stop shifting and become "real"
  let seenNonZeroLimits = false;
  let limitsStable = false;

  // --------------------------------------------------------------
  // updateLimits()
  // Called when FOV changes / scene size changes
  // --------------------------------------------------------------
  const updateLimits = () => {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();

    if (!W || !H) {
      maxX = maxY = 0;
      return;
    }

    // Camera vertical FOV (in radians)
    const vFov = THREE.MathUtils.degToRad(camera.fov);

    // Visible footprint at cameraZ
    const frustumHalfHeight = Math.tan(vFov / 2) * cameraZ;
    const frustumHalfWidth = frustumHalfHeight * camera.aspect;

    // Allowed camera movement before exposing backdrop edges
    maxX = Math.max(0, W / 2 - frustumHalfWidth);
    maxY = Math.max(0, H / 2 - frustumHalfHeight);

    const limitsNonZero = maxX > 1e-6 || maxY > 1e-6;

    // Pass #1: first non-zero values appear → not stable yet
    if (limitsNonZero && !seenNonZeroLimits) {
      seenNonZeroLimits = true;
    }
    // Pass #2: second non-zero limits → final FOV settled → stable
    else if (limitsNonZero && seenNonZeroLimits && !limitsStable) {
      limitsStable = true;
    }

    // Determine scroll direction robustly (float-safe)
    const isVerticalOnly = maxY > 1e-6 && maxX < 1e-6;
    const isHorizontalOnly = maxX > 1e-6 && maxY < 1e-6;

    // ----------------------------------------------------------
    // INITIAL PLACEMENT — only after limits are STABLE
    // ----------------------------------------------------------
    if (!hasInitialPlacement && limitsStable) {
      if (isVerticalOnly) {
        // Vertical scrolling → TOP
        camera.position.x = 0;
        camera.position.y = maxY;
      } else if (isHorizontalOnly) {
        // Horizontal scrolling → LEFT
        camera.position.x = -maxX;
        camera.position.y = 0;
      } else {
        // Mixed, diagonal, or no scroll → CENTER
        camera.position.x = 0;
        camera.position.y = 0;
      }

      hasInitialPlacement = true;
    }

    // After placement (or if placement is disabled), clamp
    if (hasInitialPlacement) {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxX, maxX);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, -maxY, maxY);
    }

    // Cache for detecting changes
    prevFov = camera.fov;
    prevAspect = camera.aspect;
    prevSceneWidth = W;
    prevSceneHeight = H;
  };

  // --------------------------------------------------------------
  // needsRecalc() — triggered when FOV/aspect/backdrop changes
  // --------------------------------------------------------------
  const needsRecalc = () => {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();

    return (
      W !== prevSceneWidth ||
      H !== prevSceneHeight ||
      camera.fov !== prevFov ||
      camera.aspect !== prevAspect
    );
  };

  // --------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------
  return {
    // Called from ScrollController to apply scroll offset
    setOffset(x: number, y: number) {
      const cx = THREE.MathUtils.clamp(x, -maxX, maxX);
      const cy = THREE.MathUtils.clamp(y, -maxY, maxY);

      camera.position.x = cx;
      camera.position.y = cy;
    },

    // Used by ScrollController to read the current cam position
    getOffset() {
      return { x: camera.position.x, y: camera.position.y };
    },

    // Triggered by SceneCamera and StageSystem (resize, FOV updates)
    onResizeOrFovChange() {
      updateLimits();
    },

    // Engine loop calls this — needed for smooth FOV lerp
    onFrameUpdate() {
      if (needsRecalc()) {
        updateLimits();
      }
    },

    // ScrollController needs these world-space limits
    getLimits() {
      return { maxX, maxY };
    },
  };
}
