import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createImagePlane } from "./ImagePlanePrimitive";
import { useStage } from "@/components/containers/SceneCore/Stage/useStage";

export interface ImagePlaneProps {
  src: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  z?: number;
  __parent?: THREE.Object3D | null;
}

export function ImagePlane({
  src,
  width,
  height,
  position = [0, 0, 0],
  z = 0,
  __parent = null, // <-- added
}: ImagePlaneProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const stage = useStage();

  useEffect(() => {
    const mesh = createImagePlane({ src, width, height, position });
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
