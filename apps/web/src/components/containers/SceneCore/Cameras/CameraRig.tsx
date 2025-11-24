// @ts-nocheck

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

  const sceneHeight =
    useSceneStore((s) => s.sceneHeight) ??
    SceneConfig.scene.background.sceneHeight;

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
    const halfScene = sceneHeight / 2;

    if (sceneHeight <= visibleH) {
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
    const fullTravel = sceneHeight - visibleH;
    let targetY = halfScene - halfVis - s * fullTravel;

    const minY = -halfScene + halfVis;
    const maxY = halfScene - halfVis;
    targetY = THREE.MathUtils.clamp(targetY, minY, maxY);

    currentY.current +=
      (targetY - currentY.current) * SceneConfig.scroll.smoothness;
    (camera as THREE.PerspectiveCamera).position.y = currentY.current;
    camera.lookAt(0, currentY.current, 0);
  });

  return null;
}
