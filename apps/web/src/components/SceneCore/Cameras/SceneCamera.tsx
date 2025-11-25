// SceneCamera.tsx
import * as THREE from "three";
import React, { forwardRef, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useSceneStore } from "../Store/SceneStore";

const CAMERA_Z = 1000;

export const SceneCamera = forwardRef<THREE.PerspectiveCamera>((props, ref) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!);
  const helperRef = useRef<THREE.CameraHelper | null>(null);

  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const { sceneWidth, sceneHeight } = useSceneStore();

  // --------------------------------------------
  // Compute adaptive FOV
  // --------------------------------------------
  function computeAdaptiveFov() {
    const W = sceneWidth;
    const H = sceneHeight;
    const aspect = size.width / size.height;

    if (W <= 0 || H <= 0) return cameraRef.current.fov;

    const bgAspect = W / H;

    let fovYRad: number;

    if (aspect >= bgAspect) {
      // Fit WIDTH
      const fovX = 2 * Math.atan(W / 2 / CAMERA_Z);
      fovYRad = 2 * Math.atan(Math.tan(fovX / 2) / aspect);
    } else {
      // Fit HEIGHT
      fovYRad = 2 * Math.atan(H / 2 / CAMERA_Z);
    }

    return THREE.MathUtils.radToDeg(fovYRad);
  }

  // --------------------------------------------
  // Setup initial camera + helper
  // --------------------------------------------
  useEffect(() => {
    const cam = cameraRef.current;
    cam.position.set(0, 0, CAMERA_Z);

    // Initial FOV
    cam.fov = computeAdaptiveFov();
    cam.aspect = size.width / size.height;
    cam.updateProjectionMatrix();

    // Add CameraHelper to the scene
    const helper = new THREE.CameraHelper(cam);
    helperRef.current = helper;
    scene.add(helper);

    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.geometry.dispose();
        (helperRef.current.material as any)?.dispose?.();
      }
    };
  }, []);

  // --------------------------------------------
  // Smooth FOV Updates Each Frame
  // --------------------------------------------
  useFrame(() => {
    const cam = cameraRef.current;
    const helper = helperRef.current;
    if (!cam) return;

    const targetFov = computeAdaptiveFov();

    // Smooth interpolation
    cam.fov += (targetFov - cam.fov) * 1;

    cam.aspect = size.width / size.height;
    cam.updateProjectionMatrix();

    if (helper) helper.update();
  });

  return (
    <perspectiveCamera
      ref={(node) => {
        cameraRef.current = node!;
        if (typeof ref === "function") ref(node!);
        else if (ref) (ref as any).current = node!;
      }}
      fov={45}
      near={1}
      far={1010}
      {...props}
    />
  );
});

SceneCamera.displayName = "SceneCamera";
