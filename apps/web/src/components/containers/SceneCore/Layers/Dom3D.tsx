// src/components/containers/SceneCore/Layers/Dom3D.tsx

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { CSS3DObject } from "three-stdlib";

import { useStage } from "../Stage/useStage";
import type { StageAPI } from "../Stage/StageSystem";
import { useParent } from "../Utilities/ParentContext";

/**
 * Dom3D – CSS3DObject Version (REAL 3D)
 * -------------------------------------
 * - Uses Three's CSS3DObject + CSS3DRenderer
 * - DOM exists in true 3D space with real camera projection
 * - Full perspective foreshortening (far edge smaller)
 * - Local transform is relative to ParentContext object
 * - Invisible WebGL plane under DOM receives/casts shadows
 *
 * Default: rotation=[0,0,0] → plane lies on XY, facing +Z (local space)
 */

export interface Dom3DProps {
  children: React.ReactNode;

  /** Local offset from parent (in world units). */
  position?: [number, number, number];

  /** Local rotation (radians) relative to parent. */
  rotation?: [number, number, number];

  /** Controls how big the DOM feels at 1m distance. */
  baseScaleDistance?: number;
  minScale?: number;
  maxScale?: number;

  /** Visibility based on camera distance. */
  minDistance?: number;
  maxDistance?: number;

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

  className,
  style,
}) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  const cssObjRef = useRef<CSS3DObject | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);

  const stage = useStage() as StageAPI;
  const parent = useParent();

  // Pre-allocated math objects
  const localPos = new THREE.Vector3(...position);
  const localEuler = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
  const localQuat = new THREE.Quaternion().setFromEuler(localEuler);

  const parentWorldMat = new THREE.Matrix4();
  const localMat = new THREE.Matrix4();
  const worldMat = new THREE.Matrix4();

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();

  // --------------------------------------------------------
  // Shadow plane – invisible but casts/receives shadows
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
    mesh.receiveShadow = true;

    shadowMeshRef.current = mesh;
    stage.addObject(mesh, parent);

    return () => {
      stage.removeObject(mesh);
      geo.dispose();
      mat.dispose();
    };
  }, [stage, parent]);

  // --------------------------------------------------------
  // CSS3DObject setup
  // --------------------------------------------------------
  useEffect(() => {
    if (!stage || !elRef.current) return;

    // Let this element actually receive pointer events
    // (CSS renderer root has pointerEvents: none)
    elRef.current.style.pointerEvents = "auto";
    elRef.current.style.transformStyle = "preserve-3d";

    const cssObj = new CSS3DObject(elRef.current);
    cssObjRef.current = cssObj;

    stage.addCSSObject(cssObj);

    return () => {
      stage.removeCSSObject(cssObj);
    };
  }, [stage]);

  // --------------------------------------------------------
  // Main update loop – sync CSS3D + shadow to world
  // --------------------------------------------------------
  useEffect(() => {
    let frameId: number | null = null;

    const update = () => {
      const camera = stage.getCamera();
      const cssObj = cssObjRef.current;
      const shadow = shadowMeshRef.current;

      if (!camera || !cssObj || !parent) {
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
      // Compute world transform = parent * local
      // ---------------------------------------------
      parent.updateWorldMatrix(true, false);
      parentWorldMat.copy(parent.matrixWorld);

      localPos.set(position[0], position[1], position[2]);
      localEuler.set(rotation[0], rotation[1], rotation[2]);
      localQuat.setFromEuler(localEuler);

      localMat.compose(
        localPos,
        localQuat,
        new THREE.Vector3(1, 1, 1) // local scale (can be parameterized later)
      );

      worldMat.multiplyMatrices(parentWorldMat, localMat);
      worldMat.decompose(worldPos, worldQuat, worldScale);

      // Apply to CSS3D object
      cssObj.position.copy(worldPos);
      cssObj.quaternion.copy(worldQuat);

      // ---------------------------------------------
      // Distance-based visibility + near/far culling
      // ---------------------------------------------
      const distance = camera.position.distanceTo(worldPos);
      const occluded = distance < minDistance || distance > maxDistance;

      const domEl = elRef.current;
      if (domEl) {
        if (occluded) {
          domEl.style.opacity = "0";
          domEl.style.pointerEvents = "none";
        } else {
          domEl.style.opacity = "1";
          domEl.style.pointerEvents = "auto";
        }
      }

      // ---------------------------------------------
      // Scale feeling (roughly constant screen size)
      // ---------------------------------------------
      cssObj.scale.set(1, 1, 1);

      // ---------------------------------------------
      // Shadow sync – STATIC plane sized 1:1 with DOM pixels
      // ---------------------------------------------
      if (shadow && domEl) {
        // Compute pixel size once (1 world unit = 1 pixel)
        if (!shadow.userData.pixelSized) {
          const rect = domEl.getBoundingClientRect();

          // 1 world unit = 1 pixel
          const worldW = rect.width;
          const worldH = rect.height;

          shadow.scale.set(worldW * 1.13, worldH * 1.13, 1);

          shadow.userData.pixelSized = true;
        }

        // Follow DOM world transform (no foreshortening)
        shadow.position.copy(worldPos);
        shadow.quaternion.copy(worldQuat);
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    stage,
    parent,
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
