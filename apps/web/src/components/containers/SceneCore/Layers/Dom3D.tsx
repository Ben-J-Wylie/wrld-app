// src/components/containers/SceneCore/Layers/Dom3D.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { CSS3DObject } from "three-stdlib";

import { useStage } from "../Stage/useStage";
import type { StageAPI } from "../Stage/StageSystem";
import { useParent } from "../Utilities/ParentContext";

import {
  createShadowCasterPlane,
  createSilhouetteTexture,
} from "./ShadowCaster";

export interface Dom3DProps {
  children: React.ReactNode;

  position?: [number, number, number];
  rotation?: [number, number, number];

  baseScaleDistance?: number;
  minScale?: number;
  maxScale?: number;

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
  const lastShadowWidth = useRef(0);
  const lastShadowHeight = useRef(0);

  const stage = useStage() as StageAPI;
  const parent = useParent();

  // local math objects
  const localPos = new THREE.Vector3(...position);
  const localEuler = new THREE.Euler(...rotation);
  const localQuat = new THREE.Quaternion().setFromEuler(localEuler);

  const parentWorldMat = new THREE.Matrix4();
  const localMat = new THREE.Matrix4();
  const worldMat = new THREE.Matrix4();

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();

  // --------------------------------------------------------
  // Create shadow plane (static world orientation)
  // --------------------------------------------------------
  useEffect(() => {
    if (!stage || !parent) return;

    const mesh = createShadowCasterPlane();
    shadowMeshRef.current = mesh;

    // Static orientation: ALWAYS face +Z (no rotation)
    mesh.quaternion.set(0, 0, 0, 1);

    // Invisible but shadow-casting
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.transparent = true;
    mat.opacity = 1;
    mat.alphaTest = 0.5;
    mat.depthWrite = false;
    mat.colorWrite = false;

    mesh.castShadow = true;
    mesh.receiveShadow = false;

    stage.addObject(mesh, parent);

    return () => {
      stage.removeObject(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [stage, parent]);

  // --------------------------------------------------------
  // Build CSS 3D object
  // --------------------------------------------------------
  useEffect(() => {
    if (!stage || !elRef.current) return;

    elRef.current.style.pointerEvents = "auto";
    elRef.current.style.transformStyle = "preserve-3d";

    const cssObj = new CSS3DObject(elRef.current);
    cssObjRef.current = cssObj;

    stage.addCSSObject(cssObj);

    return () => stage.removeCSSObject(cssObj);
  }, [stage]);

  // --------------------------------------------------------
  // MutationObserver → rebake silhouette (static SVG mask)
  // --------------------------------------------------------
  useEffect(() => {
    const el = elRef.current;
    const shadow = shadowMeshRef.current;
    if (!el || !shadow) return;

    let baking = false;
    let scheduled = false;

    const requestBake = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        bake();
      });
    };

    async function bake() {
      if (baking) return;
      baking = true;

      const domEl = elRef.current;
      const shadowMesh = shadowMeshRef.current;
      if (!domEl || !shadowMesh) {
        baking = false;
        return;
      }

      const rect = domEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        baking = false;
        return;
      }

      const mat = shadowMesh.material as THREE.MeshStandardMaterial;
      const oldMap = mat.alphaMap || null;

      const newTex = await createSilhouetteTexture(domEl);

      if (newTex && shadowMeshRef.current === shadowMesh) {
        // Plane size = DOM size in world units (1:1)
        shadowMesh.scale.set(rect.width, rect.height, 1);
        lastShadowWidth.current = rect.width;
        lastShadowHeight.current = rect.height;

        mat.alphaMap = newTex;
        mat.needsUpdate = true;

        if (oldMap && oldMap !== newTex) oldMap.dispose();
      }

      baking = false;
    }

    requestBake();

    const observer = new MutationObserver(() => {
      requestBake();
    });

    observer.observe(el, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  // --------------------------------------------------------
  // Update loop — CSS3D tracks full 3D transform,
  // Shadow plane ONLY tracks world position (not rotation)
  // --------------------------------------------------------
  useEffect(() => {
    if (!stage || !parent) return;

    let frameId: number | null = null;

    const update = () => {
      const camera = stage.getCamera();
      const cssObj = cssObjRef.current;
      const domEl = elRef.current;
      const shadow = shadowMeshRef.current;

      if (!camera || !cssObj || !domEl || !shadow) {
        frameId = requestAnimationFrame(update);
        return;
      }

      // Parent world matrix → local → full world
      parent.updateWorldMatrix(true, false);
      parentWorldMat.copy(parent.matrixWorld);

      localPos.set(...position);
      localEuler.set(...rotation);
      localQuat.setFromEuler(localEuler);
      localMat.compose(localPos, localQuat, new THREE.Vector3(1, 1, 1));

      worldMat.multiplyMatrices(parentWorldMat, localMat);
      worldMat.decompose(worldPos, worldQuat, worldScale);

      //
      // CSS3D — true 3D transform
      //
      cssObj.position.copy(worldPos);
      cssObj.quaternion.copy(worldQuat);

      const dist = camera.position.distanceTo(worldPos);
      const isHidden = dist < minDistance || dist > maxDistance;

      domEl.style.opacity = isHidden ? "0" : "1";
      domEl.style.pointerEvents = isHidden ? "none" : "auto";

      //
      // SHADOW PLANE — STATIC WORLD ORIENTATION
      //
      shadow.position.copy(worldPos);

      // Lock orientation to identity (always face +Z)
      shadow.quaternion.set(0, 0, 0, 1);

      // Use DOM size only, never camera
      // (Size updated during bake only)
      shadow.scale.set(lastShadowWidth.current, lastShadowHeight.current, 1);

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
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
    minDistance,
    maxDistance,
  ]);

  return (
    <div ref={elRef} className={className} style={style}>
      {children}
    </div>
  );
};
