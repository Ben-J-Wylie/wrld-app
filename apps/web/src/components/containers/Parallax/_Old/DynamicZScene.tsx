import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

function FitZCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera; // 👈 cast
    const baseWidth = 1920;
    const aspect = size.width / size.height;
    const fovRadians = (cam.fov * Math.PI) / 180;
    const distance = baseWidth / (2 * Math.tan(fovRadians / 2) * aspect);
    cam.position.z = distance;
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
        <meshBasicMaterial color="#332244" />
      </mesh>
      <mesh position={[0, 0, -3]}>
        <planeGeometry args={[1600, 900]} />
        <meshBasicMaterial color="#664488" />
      </mesh>
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[1400, 788]} />
        <meshBasicMaterial color="#aa88cc" />
      </mesh>
    </>
  );
}

export default function DynamicZScene() {
  return (
    <Canvas>
      <PerspectiveCamera makeDefault fov={50} />
      <FitZCamera />
      <Layers />
    </Canvas>
  );
}
