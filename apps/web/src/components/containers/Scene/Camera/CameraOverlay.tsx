import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";

function ObserverScene({
  sharedScene,
  stageCamera,
}: {
  sharedScene: THREE.Scene;
  stageCamera: THREE.Camera;
}) {
  const observerCam = useRef<THREE.PerspectiveCamera>(null!);
  const helper = useRef<THREE.CameraHelper | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    const h = new THREE.CameraHelper(stageCamera);
    scene.add(h);
    helper.current = h;
    return () => {
      scene.remove(h);
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
    };
  }, [scene, stageCamera]);

  useFrame(() => helper.current?.update());

  return (
    <>
      <PerspectiveCamera
        ref={observerCam}
        makeDefault
        position={[8, 5, 8]}
        fov={50}
      />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <primitive object={sharedScene} />
    </>
  );
}

/**
 * CameraOverlay
 * --------------------------------------------------
 * Standalone PiP overlay window showing Stage scene + camera helper.
 */
export function CameraOverlay({
  stageScene,
  stageCamera,
}: {
  stageScene: THREE.Scene;
  stageCamera: THREE.Camera;
}) {
  return (
    <Canvas
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        width: "25vw",
        height: "25vh",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: "8px",
        background: "rgba(0,0,0,0.1)",
        pointerEvents: "auto",
      }}
    >
      <ObserverScene sharedScene={stageScene} stageCamera={stageCamera} />
    </Canvas>
  );
}
