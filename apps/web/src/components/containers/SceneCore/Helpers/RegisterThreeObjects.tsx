// @ts-nocheck

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { useThreeStore } from "./ThreeStore";

export function RegisterThreeObjects() {
  const { scene, camera } = useThree();
  const setScene = useThreeStore((s) => s.setScene);
  const setCamera = useThreeStore((s) => s.setCamera);

  useEffect(() => {
    setScene(scene);
    setCamera(camera);
  }, [scene, camera, setScene, setCamera]);

  return null;
}
