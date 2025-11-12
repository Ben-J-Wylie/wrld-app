import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { SceneConfig, useSceneStore } from "@/components/containers/SceneCore";

/**
 * CameraRig
 * Handles vertical scroll-linked camera movement with smooth interpolation.
 */
export function CameraRig() {
  const { camera } = useThree();
  const scrollNorm = useSceneStore((s) => s.scroll);

  const worldHeight =
    useSceneStore((s) => s.worldHeight) ??
    SceneConfig.scene.background.worldHeight;

  const bgDepth = SceneConfig.scene.background.depth ?? 0;
  const camToBg = Math.abs(
    (camera as THREE.PerspectiveCamera).position.z - bgDepth
  );
  const currentY = useRef((camera as THREE.PerspectiveCamera).position.y);

  useFrame(() => {
    const vFov = THREE.MathUtils.degToRad(
      (camera as THREE.PerspectiveCamera).fov
    );
    const visibleH = 2 * Math.tan(vFov / 2) * camToBg;
    const halfVis = visibleH / 2;
    const halfWorld = worldHeight / 2;

    if (worldHeight <= visibleH) {
      const targetY = 0;
      currentY.current +=
        (targetY - currentY.current) * SceneConfig.scroll.smoothness;
      (camera as THREE.PerspectiveCamera).position.y = currentY.current;
      camera.lookAt(0, currentY.current, 0);
      useSceneStore.setState({ scroll: 0 });
      document.body.style.overflow = "hidden";
      return;
    }

    document.body.style.overflow = "auto";
    const s = THREE.MathUtils.clamp(scrollNorm, 0, 1);
    const fullTravel = worldHeight - visibleH;
    let targetY = halfWorld - halfVis - s * fullTravel;

    const minY = -halfWorld + halfVis;
    const maxY = halfWorld - halfVis;
    targetY = THREE.MathUtils.clamp(targetY, minY, maxY);

    currentY.current +=
      (targetY - currentY.current) * SceneConfig.scroll.smoothness;
    (camera as THREE.PerspectiveCamera).position.y = currentY.current;
    camera.lookAt(0, currentY.current, 0);
  });

  return null;
}

// import * as THREE from "three";
// import { useThree, useFrame } from "@react-three/fiber";
// import { useRef } from "react";
// import { SceneConfig, useSceneStore } from "@/components/containers/SceneCore";

// /**
//  * CameraRig
//  * -----------------------------------------------------------------------------
//  * Scroll-linked vertical camera motion.
//  * Reactively adjusts to current worldHeight (per-scene) and visible height.
//  */
// export function CameraRig() {
//   const { camera } = useThree();

//   // 🔹 Reactive scroll & world size
//   const scrollNorm = useSceneStore((s) => s.scroll);
//   const worldHeight =
//     useSceneStore((s) => s.worldHeight) ??
//     SceneConfig.scene.background.heightWorld;

//   // 🔹 Derived constants
//   const bgDepth = SceneConfig.scene.background.depth ?? 0;
//   const camToBg = Math.abs(
//     (camera as THREE.PerspectiveCamera).position.z - bgDepth
//   );
//   const currentY = useRef((camera as THREE.PerspectiveCamera).position.y);

//   useFrame(() => {
//     const cam = camera as THREE.PerspectiveCamera;
//     const vFov = THREE.MathUtils.degToRad(cam.fov);
//     const visibleH = 2 * Math.tan(vFov / 2) * camToBg;
//     const halfVis = visibleH / 2;
//     const halfWorld = worldHeight / 2;

//     // 🧠 If world smaller than view, keep centered
//     if (worldHeight <= visibleH) {
//       const targetY = 0;
//       currentY.current +=
//         (targetY - currentY.current) * SceneConfig.scroll.smoothness;
//       cam.position.y = currentY.current;
//       cam.lookAt(0, currentY.current, 0);
//       useSceneStore.setState({ scroll: 0 });
//       document.body.style.overflow = "hidden";
//       return;
//     }

//     // 🌍 Normal scrolling
//     document.body.style.overflow = "auto";
//     const s = THREE.MathUtils.clamp(scrollNorm, 0, 1);
//     const fullTravel = worldHeight - visibleH;

//     // scrollNorm = 0 → top, scrollNorm = 1 → bottom
//     let targetY = halfWorld - halfVis - s * fullTravel;

//     const minY = -halfWorld + halfVis;
//     const maxY = halfWorld - halfVis;
//     targetY = THREE.MathUtils.clamp(targetY, minY, maxY);

//     currentY.current +=
//       (targetY - currentY.current) * SceneConfig.scroll.smoothness;
//     cam.position.y = currentY.current;
//     cam.lookAt(0, currentY.current, 0);
//   });

//   return null;
// }
