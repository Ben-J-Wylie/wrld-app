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

// --------------------------------------------------------
// Global CSS override for mirror clones (Option C)
// --------------------------------------------------------
let mirrorGlobalStyleInjected = false;

function ensureMirrorGlobalStyle() {
  if (mirrorGlobalStyleInjected) return;
  if (typeof document === "undefined") return;

  const style = document.createElement("style");
  style.textContent = `
    /* Scope only to offscreen shadow mirrors */
    .dom3d-shadow-mirror * {
      transform: none !important;
      transform-style: flat !important;
      perspective: none !important;
      perspective-origin: 0 0 !important;
      backface-visibility: visible !important;
      will-change: auto !important;
    }
  `;
  document.head.appendChild(style);
  mirrorGlobalStyleInjected = true;
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
  // Visible CSS3D DOM node (controlled by Stage + CSS3DRenderer)
  const elRef = useRef<HTMLDivElement | null>(null);

  // Offscreen "flat" mirror root (we manage this manually)
  const mirrorContainerRef = useRef<HTMLDivElement | null>(null);

  // CSS3DObject wrapper
  const cssObjRef = useRef<CSS3DObject | null>(null);

  // Shadow plane + last known size
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
  // Shadow plane (static world orientation, invisible)
  // --------------------------------------------------------
  useEffect(() => {
    if (!stage || !parent) return;

    const mesh = createShadowCasterPlane();
    shadowMeshRef.current = mesh;

    // Static orientation: always face +Z (no rotation)
    mesh.quaternion.set(0, 0, 0, 1);

    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.transparent = true;
    mat.opacity = 1;
    mat.alphaTest = 0.5;
    mat.depthWrite = false;
    mat.colorWrite = false; // invisible in color pass

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
  // Visible CSS3D object
  // --------------------------------------------------------
  useEffect(() => {
    if (!stage || !elRef.current) return;

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
  // Create / manage the offscreen mirror container
  // --------------------------------------------------------
  function ensureMirrorContainer(): HTMLDivElement | null {
    if (typeof document === "undefined") return null;

    ensureMirrorGlobalStyle();

    if (!mirrorContainerRef.current) {
      const div = document.createElement("div");
      div.className = "dom3d-shadow-mirror";
      div.style.position = "absolute";
      div.style.left = "-10000px";
      div.style.top = "-10000px";
      div.style.pointerEvents = "none";
      div.style.opacity = "0";
      div.style.zIndex = "-1";
      div.style.width = "auto";
      div.style.height = "auto";
      document.body.appendChild(div);
      mirrorContainerRef.current = div;
    }

    return mirrorContainerRef.current;
  }

  // --------------------------------------------------------
  // Build a "flat" mirror clone of the visible DOM for silhouette baking
  // (clone is styled with CSS transforms forcibly disabled via Option C)
  // --------------------------------------------------------
  function buildMirrorClone(): HTMLElement | null {
    const domEl = elRef.current;
    if (!domEl) return null;

    const mirror = ensureMirrorContainer();
    if (!mirror) return null;

    // Clear previous content
    mirror.innerHTML = "";

    // Deep clone of the current DOM subtree
    const clone = domEl.cloneNode(true) as HTMLElement;

    // Strip CSS3D / transform-related inline styles from the clone tree
    const stack: HTMLElement[] = [clone];
    while (stack.length > 0) {
      const node = stack.pop()!;
      const style = node.style;

      style.transform = "";
      style.transformOrigin = "";
      style.perspective = "";
      style.transformStyle = "";
      style.willChange = "";
      style.backfaceVisibility = "";

      Array.from(node.children).forEach((child) => {
        if (child instanceof HTMLElement) stack.push(child);
      });
    }

    mirror.appendChild(clone);
    return clone;
  }

  // --------------------------------------------------------
  // MutationObserver — re-bake silhouette using the mirror
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
        void bake();
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

      // Build flat, untransformed mirror clone
      const mirrorRoot = buildMirrorClone();
      if (!mirrorRoot) {
        baking = false;
        return;
      }

      // Measure the *mirror* root (raw React layout, no CSS3D)
      const rect = mirrorRoot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        baking = false;
        return;
      }

      const mat = shadowMesh.material as THREE.MeshStandardMaterial;
      const oldMap = mat.alphaMap || null;

      // Build silhouette from the mirror (root + descendants, data-shadow-shape, etc.)
      const newTex = await createSilhouetteTexture(mirrorRoot);

      if (newTex && shadowMeshRef.current === shadowMesh) {
        // Plane size = DOM size in world units (1:1, derived from RAW React layout)
        shadowMesh.scale.set(rect.width, rect.height, 1);
        lastShadowWidth.current = rect.width;
        lastShadowHeight.current = rect.height;

        mat.alphaMap = newTex;
        mat.needsUpdate = true;

        if (oldMap && oldMap !== newTex) {
          oldMap.dispose();
        }
      }

      baking = false;
    }

    // Initial bake
    requestBake();

    // Observe the visible DOM for *content* changes only.
    // IMPORTANT: do NOT watch style changes to avoid CSS3D renderer spam.
    const observer = new MutationObserver(() => {
      requestBake();
    });

    observer.observe(el, {
      attributes: true,
      attributeFilter: ["class", "data-shadow-shape"],
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();

      // Cleanup mirror container if it exists
      const mirror = mirrorContainerRef.current;
      if (mirror && mirror.parentNode) {
        mirror.parentNode.removeChild(mirror);
      }
      mirrorContainerRef.current = null;
    };
  }, []);

  // --------------------------------------------------------
  // Update loop — CSS3D follows full 3D transform,
  // shadow plane follows *only* world position (static orientation)
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

      // Parent world → local → full world
      parent.updateWorldMatrix(true, false);
      parentWorldMat.copy(parent.matrixWorld);

      localPos.set(...position);
      localEuler.set(...rotation);
      localQuat.setFromEuler(localEuler);
      localMat.compose(localPos, localQuat, new THREE.Vector3(1, 1, 1));

      worldMat.multiplyMatrices(parentWorldMat, localMat);
      worldMat.decompose(worldPos, worldQuat, worldScale);

      //
      // CSS3D — real 3D orientation
      //
      cssObj.position.copy(worldPos);
      cssObj.quaternion.copy(worldQuat);

      // Optional: distance-based DOM scaling (kept here if you want it later)
      const dist = camera.position.distanceTo(worldPos);
      const isHidden = dist < minDistance || dist > maxDistance;

      domEl.style.opacity = isHidden ? "0" : "1";
      domEl.style.pointerEvents = isHidden ? "none" : "auto";

      //
      // Shadow plane — static orientation, only position moves
      //
      shadow.position.copy(worldPos);

      // Lock rotation so it never skews/foreshortens with camera
      shadow.quaternion.set(0, 0, 0, 1);

      // Size is fixed from last bake (DOM px → world units)
      shadow.scale.set(
        lastShadowWidth.current || 0,
        lastShadowHeight.current || 0,
        1
      );

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
    minDistance,
    maxDistance,
  ]);

  return (
    <div ref={elRef} className={className} style={style}>
      {children}
    </div>
  );
};
