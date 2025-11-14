// SceneCore/engine/camera/CameraRig.ts
import * as THREE from "three";
import { SceneConfig, useSceneStore } from "../../SceneCore";

interface CameraRigOptions {}

/**
 * applyCameraRig
 * ---------------------------------------------------------------------------
 * Vanilla Three.js version of the R3F CameraRig.
 *
 * Responsibilities:
 *  - Scroll-linked vertical camera motion
 *  - Smooth interpolation (SceneConfig.scroll.smoothness)
 *  - Uses visibleHeight & fov computed by FitPerspectiveCamera
 *  - Locks scroll when scene is smaller than viewport
 *  - Updates camera.lookAt each frame
 */
export function applyCameraRig(
  engine: {
    camera: THREE.PerspectiveCamera;
    loop: { add: (fn: () => void) => void };
  },
  _options: CameraRigOptions = {}
) {
  const camera = engine.camera;

  // Zustand values (read live each frame where needed)
  const getScroll = () => useSceneStore.getState().scroll;
  const getSceneHeight = () =>
    useSceneStore.getState().sceneHeight ??
    SceneConfig.scene.background.sceneHeight;

  const bgDepth = SceneConfig.scene.background.depth ?? 0;

  // distance from camera to background (same as R3F)
  const camToBg = Math.abs(camera.position.z - bgDepth);

  // persistent currentY for smoothing
  const currentY = { value: camera.position.y };

  // add per-frame camera update to engine loop
  engine.loop.add(() => {
    const scrollNorm = getScroll();
    const sceneHeight = getSceneHeight();

    // compute visible height from current fov
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleH = 2 * Math.tan(vFov / 2) * camToBg;

    const halfVis = visibleH / 2;
    const halfScene = sceneHeight / 2;

    // -------------------------------------------------------
    // CASE 1 — The scene fits fully inside viewport
    // -------------------------------------------------------
    if (sceneHeight <= visibleH) {
      const targetY = 0;

      currentY.value +=
        (targetY - currentY.value) * SceneConfig.scroll.smoothness;

      camera.position.y = currentY.value;
      camera.lookAt(0, currentY.value, 0);

      // lock scroll
      useSceneStore.setState({ scroll: 0 });
      document.body.style.overflow = "hidden";
      return;
    }

    // -------------------------------------------------------
    // CASE 2 — Scene is larger than viewport (scrollable)
    // -------------------------------------------------------
    document.body.style.overflow = "auto";

    const s = THREE.MathUtils.clamp(scrollNorm, 0, 1);

    // total vertical distance camera must travel
    const fullTravel = sceneHeight - visibleH;

    // convert normalized scroll into camera position
    let targetY = halfScene - halfVis - s * fullTravel;

    const minY = -halfScene + halfVis;
    const maxY = halfScene - halfVis;
    targetY = THREE.MathUtils.clamp(targetY, minY, maxY);

    // smoothing
    currentY.value +=
      (targetY - currentY.value) * SceneConfig.scroll.smoothness;

    camera.position.y = currentY.value;
    camera.lookAt(0, currentY.value, 0);
  });
}
