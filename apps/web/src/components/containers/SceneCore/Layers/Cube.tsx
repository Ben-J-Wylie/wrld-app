import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createBox } from "./CubePrimitive";
import { useStage } from "@/components/containers/SceneCore/Stage/useStage";

export interface CubeProps {
  size?: [number, number, number];
  color?: string | number;
  position?: [number, number, number];
  z?: number;
  __parent?: THREE.Object3D | null;
}

export function Cube({
  size = [1, 1, 1],
  color = "white",
  position = [0, 0, 0],
  z = 0,
  __parent = null, // <-- new
}: CubeProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const stage = useStage();

  useEffect(() => {
    const mesh = createBox({ size, color, position });
    mesh.position.z += z;

    meshRef.current = mesh;

    // NOW parent-aware
    stage.addObject(mesh, __parent);

    return () => {
      stage.removeObject(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;

    meshRef.current.position.set(position[0], position[1], position[2] + z);
  }, [position, z]);

  return null;
}
