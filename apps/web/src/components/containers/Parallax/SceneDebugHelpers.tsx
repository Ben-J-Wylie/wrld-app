// src/parallax/SceneDebugHelpers.tsx
import { useThree } from "@react-three/fiber";
import { GridHelper, AxesHelper } from "three";
import { useEffect } from "react";

/**
 * Adds optional grid and axes helpers to visualize scale and depth.
 * Toggle by passing `visible={true}` in your Stage or Scene.
 */
export function SceneDebugHelpers({ visible = true }: { visible?: boolean }) {
  const { scene } = useThree();

  useEffect(() => {
    if (!visible) return;

    const grid = new GridHelper(50, 10, 0x444444, 0x222222); // size, divisions
    grid.position.y = -5; // move slightly below main scene
    scene.add(grid);

    const axes = new AxesHelper(10);
    axes.position.set(0, 0, 0);
    scene.add(axes);

    return () => {
      scene.remove(grid);
      scene.remove(axes);
    };
  }, [visible, scene]);

  return null;
}
