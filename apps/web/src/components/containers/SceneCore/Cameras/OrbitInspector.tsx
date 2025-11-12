import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";

/**
 * OrbitInspector
 * --------------------------------------------------
 * Debug orbit camera (Shift + V) with Stage camera helper.
 * Renders a bottom-right PiP view of the active scene.
 */
export function OrbitInspector() {
  const { gl, size, scene, camera: stageCam } = useThree();
  const [active, setActive] = useState(false);

  const observerCam = useRef<THREE.PerspectiveCamera>(null!);
  const helper = useRef<THREE.CameraHelper | null>(null);
  const controlsRef = useRef<any>(null);

  // 🔹 Toggle visibility with Shift + V
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "v") setActive((a) => !a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 🔹 Manage Stage camera helper
  useEffect(() => {
    if (!active) return;
    const h = new THREE.CameraHelper(stageCam);
    scene.add(h);
    helper.current = h;
    return () => {
      scene.remove(h);
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
      helper.current = null;
    };
  }, [active, scene, stageCam]);

  // 🔹 Per-frame rendering of PiP view
  useFrame(() => {
    if (!active || !observerCam.current) return;
    controlsRef.current?.update();
    helper.current?.update();

    const insetW = size.width / 4;
    const insetH = size.height / 4;
    const x = size.width - insetW - 20;
    const y = 20;

    gl.clearDepth();
    gl.setViewport(x, y, insetW, insetH);
    gl.setScissor(x, y, insetW, insetH);
    gl.setScissorTest(true);
    gl.render(scene, observerCam.current);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
  });

  return (
    <>
      <PerspectiveCamera
        ref={observerCam}
        fov={50}
        near={0.1}
        far={500}
        position={[10, 6, 10]}
      />
      <OrbitControls
        ref={controlsRef}
        camera={observerCam.current}
        enabled={active}
        enableDamping
        dampingFactor={0.05}
        enablePan
        enableZoom
        target={[0, 0, 0]}
      />
    </>
  );
}
