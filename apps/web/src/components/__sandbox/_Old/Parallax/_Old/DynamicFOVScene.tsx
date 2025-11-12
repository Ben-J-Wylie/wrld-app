import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

function FitFOVCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera; // 👈 cast
    const baseWidth = 1920;
    const aspect = size.width / size.height;
    const fov =
      2 *
      Math.atan(baseWidth / (2 * cam.position.z * aspect)) *
      (180 / Math.PI);
    cam.fov = fov;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

function Layers() {
  return (
    <>
      <mesh position={[0, 0, -5]}>
        <planeGeometry args={[1920, 1080]} />
        <meshBasicMaterial color="#223344" />
      </mesh>
      <mesh position={[0, 0, -3]}>
        <planeGeometry args={[1600, 900]} />
        <meshBasicMaterial color="#446688" />
      </mesh>
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[1400, 788]} />
        <meshBasicMaterial color="#88aacc" />
      </mesh>
    </>
  );
}

export default function DynamicFOVScene() {
  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[0, 0, 1000]} />
      <FitFOVCamera />
      <Layers />
    </Canvas>
  );
}
