// src/components/containers/SceneCore/Layers/Dom3D.tsx

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import type { StageAPI } from "../Stage/StageSystem";

export interface Dom3DProps {
  children: React.ReactNode;

  /** World-space position (same units as your backdrop / ImagePlane) */
  position?: [number, number, number];

  /** World-space rotation in radians (applied visually to the DOM element) */
  rotation?: [number, number, number];

  /**
   * Distance at which scale ≈ 1.0.
   * Farther than this → smaller, closer → bigger.
   */
  baseScaleDistance?: number;

  /** Clamp the scale so things never get too tiny or huge. */
  minScale?: number;
  maxScale?: number;

  /** Hide / disable pointer events outside this distance range. */
  minDistance?: number;
  maxDistance?: number;

  className?: string;
  style?: React.CSSProperties;
}

/**
 * Dom3D
 * -----
 * - Keeps children as real DOM (crisp, interactive).
 * - Projects a 3D position through the active camera in Stage.
 * - Applies CSS transforms for position + rotation + perspective scale.
 * - Distance-based "occlusion": fades out when too near/far or off-screen.
 */
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
  const stage = useStage() as StageAPI;

  useEffect(() => {
    const el = elRef.current;
    if (!el || !stage) return;

    // Basic DOM setup – parent <div> from Stage.tsx is already position:relative
    el.style.position = "absolute";
    el.style.top = "0";
    el.style.left = "0";
    el.style.transformOrigin = "center center";
    el.style.willChange = "transform, opacity";

    const ndc = new THREE.Vector3();
    const worldPos = new THREE.Vector3();

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

      // World-space position
      worldPos.set(position[0], position[1], position[2]);

      // World → NDC (-1..+1)
      ndc.copy(worldPos).project(camera);

      // If behind camera or far outside clip space, just hide
      const offscreen =
        ndc.z < -1 ||
        ndc.z > 1 ||
        ndc.x < -2 ||
        ndc.x > 2 ||
        ndc.y < -2 ||
        ndc.y > 2;

      // Distance for scaling / distance-occlusion
      const distance = camera.position.distanceTo(worldPos);

      const distanceOccluded =
        distance < minDistance || distance > maxDistance || offscreen;

      if (distanceOccluded) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      } else {
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      }

      // NDC → screen pixels
      const screenX = (ndc.x * 0.5 + 0.5) * viewportWidth;
      const screenY = (ndc.y * -0.5 + 0.5) * viewportHeight;

      // Perspective-ish scaling: farther → smaller
      const rawScale = baseScaleDistance / distance;
      const clampedScale = Math.max(
        minScale,
        Math.min(maxScale, isFinite(rawScale) ? rawScale : 1)
      );

      // Apply CSS transform: center, then move into place, then rotate + scale
      el.style.transform = `
        translate(-50%, -50%)
        translate(${screenX}px, ${screenY}px)
        rotateX(${rotation[0]}rad)
        rotateY(${rotation[1]}rad)
        rotateZ(${rotation[2]}rad)
        scale(${clampedScale})
      `;

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
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
