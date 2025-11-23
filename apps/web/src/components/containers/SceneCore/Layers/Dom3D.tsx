// src/components/containers/SceneCore/Layers/Dom3D.tsx

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import type { StageAPI } from "../Stage/StageSystem";
import { useParent } from "../Utilities/ParentContext";

/**
 * Dom3D – Quaternion CSS3D Version
 * --------------------------------
 * - EXACT same logic used by @react-three/drei <Html transform>
 * - Uses full quaternion → CSS matrix3d projection (no Euler extraction)
 * - ZERO gimbal lock, ZERO flipping overhead
 * - DOM appears *exactly* fixed in world space like a PlaneGeometry
 * - Perfect match to camera orbit, FOV, and zoom
 *
 * Default: rotation=[0,0,0] → plane lies on XY, facing +Z
 */

export interface Dom3DProps {
  children: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];

  baseScaleDistance?: number;
  minScale?: number;
  maxScale?: number;
  minDistance?: number;
  maxDistance?: number;

  rotationDamping?: {
    x?: number;
    y?: number;
    z?: number;
  };

  className?: string;
  style?: React.CSSProperties;
}

export const Dom3D: React.FC<Dom3DProps> = ({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],

  baseScaleDistance = 600,
  minScale = 0.2,
  maxScale = 2.5,

  minDistance = 50,
  maxDistance = 4000,

  rotationDamping,

  className,
  style,
}) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);

  const stage = useStage() as StageAPI;
  const parent = useParent();

  // --------------------------------------------------------
  // Shadow plane – invisible but casts actual shadows
  // --------------------------------------------------------
  useEffect(() => {
    if (!stage || !parent) return;

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      opacity: 0,
      transparent: true,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    shadowMeshRef.current = mesh;
    stage.addObject(mesh, parent);

    return () => {
      stage.removeObject(mesh);
      geo.dispose();
      mat.dispose();
    };
  }, [stage, parent]);

  // --------------------------------------------------------
  // Main CSS3D loop
  // --------------------------------------------------------
  useEffect(() => {
    const el = elRef.current;
    if (!el || !stage) return;

    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    el.style.transformOrigin = "center center";
    el.style.willChange = "transform, opacity";

    const worldPos = new THREE.Vector3();
    const ndc = new THREE.Vector3();

    const objEuler = new THREE.Euler();
    const objQuat = new THREE.Quaternion();

    const camQuat = new THREE.Quaternion();
    const invCamQuat = new THREE.Quaternion();
    const relQuat = new THREE.Quaternion();

    const relMat4 = new THREE.Matrix4();

    let frameId: number | null = null;

    const update = () => {
      const camera = stage.getCamera();
      if (!camera) {
        frameId = requestAnimationFrame(update);
        return;
      }

      const viewportWidth = stage.getViewportWidth();
      const viewportHeight = stage.getViewportHeight();
      if (!viewportWidth || !viewportHeight) {
        frameId = requestAnimationFrame(update);
        return;
      }

      // ---------------------------------------------
      // CSS perspective from Three camera
      // ---------------------------------------------
      const container = document.getElementById("Dom3DContainer");
      if (container) {
        const fov = (camera.fov * Math.PI) / 180;
        const cssPerspective =
          (0.5 * viewportHeight) / (Math.tan(fov / 2) * camera.zoom);

        container.style.perspective = `${cssPerspective}px`;
        container.style.transformStyle = "preserve-3d";
        container.style.perspectiveOrigin = "50% 50%";
      }

      // ---------------------------------------------
      // WORLD → NDC → SCREEN
      // ---------------------------------------------
      worldPos.set(position[0], position[1], position[2]);
      ndc.copy(worldPos).project(camera);

      const offscreen =
        ndc.z < -1 ||
        ndc.z > 1 ||
        ndc.x < -1.5 ||
        ndc.x > 1.5 ||
        ndc.y < -1.5 ||
        ndc.y > 1.5;

      const screenX = (ndc.x * 0.5 + 0.5) * viewportWidth;
      const screenY = (ndc.y * -0.5 + 0.5) * viewportHeight;

      // ---------------------------------------------
      // VISIBILITY + SCALE
      // ---------------------------------------------
      const distance = camera.position.distanceTo(worldPos);
      const occluded =
        distance < minDistance || distance > maxDistance || offscreen;

      if (occluded) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        el.style.zIndex = "-1";
      } else {
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";

        const depth = (ndc.z + 1) / 2;
        el.style.zIndex = String(2_000_000 - Math.round(depth * 1_000_000));
      }

      const rawScale = (baseScaleDistance / distance) * camera.zoom;
      const scale = Math.min(maxScale, Math.max(minScale, rawScale));

      // ---------------------------------------------
      // QUATERNION ORIENTATION (NO EULERS)
      // relative = inverse(camera) * object
      // ---------------------------------------------
      objEuler.set(rotation[0], rotation[1], rotation[2]);
      objQuat.setFromEuler(objEuler);

      camQuat.copy(camera.quaternion);
      invCamQuat.copy(camQuat).invert();

      relQuat.copy(invCamQuat).multiply(objQuat);

      // ---------------------------------------------
      // OPTIONAL DAMPING (visual tuning)
      // ---------------------------------------------
      const dx = rotationDamping?.x ?? 1;
      const dy = rotationDamping?.y ?? 1;
      const dz = rotationDamping?.z ?? 1;

      const dampEuler = new THREE.Euler().setFromQuaternion(relQuat, "YXZ");
      dampEuler.x *= dx;
      dampEuler.y *= -dy;
      dampEuler.z *= -dz;

      relQuat.setFromEuler(dampEuler);

      // ---------------------------------------------
      // QUATERNION → CSS matrix3d
      // ---------------------------------------------
      relMat4.makeRotationFromQuaternion(relQuat);
      relMat4.scale(new THREE.Vector3(scale, scale, scale));

      const m = relMat4.elements;

      el.style.transform = `
        translate(-50%, -50%)
        translate(${screenX}px, ${screenY}px)
        matrix3d(
          ${m[0]},${m[1]},${m[2]},${m[3]},
          ${m[4]},${m[5]},${m[6]},${m[7]},
          ${m[8]},${m[9]},${m[10]},${m[11]},
          ${m[12]},${m[13]},${m[14]},${m[15]}
        )
      `;

      // ---------------------------------------------
      // SHADOW SYNC
      // ---------------------------------------------
      const shadow = shadowMeshRef.current;
      if (shadow) {
        const rect = el.getBoundingClientRect();

        const fovRad = (camera.fov * Math.PI) / 180;
        const vh = 2 * distance * Math.tan(fovRad / 2);
        const vw = vh * camera.aspect;

        shadow.position.copy(worldPos);
        shadow.rotation.set(rotation[0], rotation[1], rotation[2]);
        shadow.scale.set(
          rect.width * (vw / viewportWidth),
          rect.height * (vh / viewportHeight),
          1
        );
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    // ---------------------------------------------
    // CLEANUP (SAFE, TS-CORRECT)
    // ---------------------------------------------
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    stage,
    position[0],
    position[1],
    position[2],
    rotation[0],
    rotation[1],
    rotation[2],
    baseScaleDistance,
    minScale,
    maxScale,
    minDistance,
    maxDistance,
  ]);

  return (
    <div ref={elRef} className={className} style={style}>
      {children}
    </div>
  );
};
