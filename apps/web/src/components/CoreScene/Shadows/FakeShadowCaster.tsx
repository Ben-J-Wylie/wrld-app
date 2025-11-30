// FakeShadowCaster.tsx — silhouette shadows with distance-blur, scale/fade,
// AND per-receiver masking in plane space.

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowCasterProps {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
  lightRef: React.RefObject<THREE.DirectionalLight>;
  shadowOpacity?: number;

  /**
   * Silhouette of the CASTER (PNG with alpha).
   * This gets blurred and stretched with distance.
   */
  alphaMap?: THREE.Texture | null;
}

/**
 * NOTE: In FakeShadowContext, receivers should be:
 *
 * export interface ShadowReceiverEntry {
 *   id: string;
 *   meshRef: React.RefObject<THREE.Mesh>;
 *   alphaMap?: THREE.Texture | null; // PNG mask for that receiver plane
 * }
 *
 * export interface FakeShadowContextType {
 *   receivers: ShadowReceiverEntry[];
 *   registerCaster: (entry: { id: string; targetRef: React.RefObject<THREE.Object3D> }) => void;
 *   unregisterCaster: (id: string) => void;
 * }
 */

export function FakeShadowCaster({
  id,
  targetRef,
  lightRef,
  shadowOpacity = 0.4,
  alphaMap,
}: FakeShadowCasterProps) {
  const { receivers, registerCaster, unregisterCaster } =
    React.useContext(FakeShadowContext);

  // One shadow mesh per receiver
  const shadowRefs = useRef(new Map<string, THREE.Mesh>());
  const setShadowRef = (receiverId: string) => (mesh: THREE.Mesh | null) => {
    if (mesh) shadowRefs.current.set(receiverId, mesh);
    else shadowRefs.current.delete(receiverId);
  };

  // Register caster
  useEffect(() => {
    registerCaster({ id, targetRef });
    return () => unregisterCaster(id);
  }, [id, registerCaster, unregisterCaster, targetRef]);

  // Base caster UVs (static template)
  const baseCasterUVs = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(1, 0),
  ];

  // Local caster quad corners (unit quad centered on origin)
  const localCorners = [
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
  ];

  // Scratch data
  const worldCorners = Array.from({ length: 4 }, () => new THREE.Vector3());
  const hitPoints = Array.from({ length: 4 }, () => new THREE.Vector3());
  const tValues = [0, 0, 0, 0];

  const lightDir = new THREE.Vector3();
  const lightPos = new THREE.Vector3();
  const lightTarget = new THREE.Vector3();

  const planePoint = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const centroid = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const quadNormal = new THREE.Vector3();
  const tangentU = new THREE.Vector3();
  const tangentV = new THREE.Vector3();

  const casterWorldPos = new THREE.Vector3();
  const receiverWorldPos = new THREE.Vector3();

  // Extra scratch for masking / sizes
  const localVec = new THREE.Vector3(); // hitPoint − centroid
  const offsetVec = new THREE.Vector3(); // hitPoint − receiver center

  // For measuring receiver extents in world space
  const rx0 = new THREE.Vector3();
  const rx1 = new THREE.Vector3();
  const ry0 = new THREE.Vector3();
  const ry1 = new THREE.Vector3();

  useFrame(() => {
    const caster = targetRef.current;
    const light = lightRef.current;
    if (!caster || !light) return;

    // Light direction
    light.getWorldPosition(lightPos);
    light.target.getWorldPosition(lightTarget);
    lightDir.subVectors(lightTarget, lightPos).normalize();
    rayDir.copy(lightDir);

    // Caster world transform
    caster.updateWorldMatrix(true, false);
    caster.getWorldPosition(casterWorldPos);

    // Transform caster corners into world space
    for (let i = 0; i < 4; i++) {
      worldCorners[i].copy(localCorners[i]).applyMatrix4(caster.matrixWorld);
    }

    // For each receiver: project quad, build shadow, assign renderOrder & mask
    for (const r of receivers) {
      const receiverId = r.id;
      if (receiverId === id) continue; // skip self

      const receiver = r.meshRef.current as THREE.Mesh | null;
      const shadowMesh = shadowRefs.current.get(receiverId);
      if (!receiver || !shadowMesh) continue;

      // Receiver plane
      receiver.updateWorldMatrix(true, false);
      receiver.getWorldPosition(planePoint); // center
      receiver.getWorldDirection(planeNormal).normalize();

      // Ensure plane faces the light
      if (planeNormal.dot(lightDir) > 0) planeNormal.negate();

      const denom = rayDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        shadowMesh.visible = false;
        continue;
      }

      // Intersect rays (from caster corners) with receiver plane
      let valid = true;
      for (let i = 0; i < 4; i++) {
        tmp.subVectors(planePoint, worldCorners[i]);
        const t = tmp.dot(planeNormal) / denom;
        if (t <= 0) {
          valid = false;
          break;
        }
        tValues[i] = t;
        hitPoints[i].copy(worldCorners[i]).addScaledVector(rayDir, t);
      }

      if (!valid) {
        shadowMesh.visible = false;
        continue;
      }

      // Copy caster UVs per-receiver so we can safely reverse
      const casterUVs = baseCasterUVs.map((v) => v.clone());

      // Fix winding if needed so quadNormal matches planeNormal
      edge1.subVectors(hitPoints[1], hitPoints[0]);
      edge2.subVectors(hitPoints[2], hitPoints[0]);
      quadNormal.crossVectors(edge1, edge2).normalize();

      if (quadNormal.dot(planeNormal) < 0) {
        hitPoints.reverse();
        tValues.reverse();
        casterUVs.reverse();
      }

      // Centroid of projected quad
      centroid.set(0, 0, 0);
      for (let i = 0; i < 4; i++) centroid.add(hitPoints[i]);
      centroid.multiplyScalar(0.25);

      // Tangent basis on receiver plane
      const up =
        Math.abs(planeNormal.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      tangentU.crossVectors(up, planeNormal).normalize();
      tangentV.crossVectors(planeNormal, tangentU).normalize();

      // Measure receiver half-size in world space.
      // Assumes plane centered at origin in local space with extents ~[-0.5,0.5].
      rx0.set(-0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      rx1.set(0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      const halfWidth = 0.5 * rx0.distanceTo(rx1);

      ry0.set(0, -0.5, 0).applyMatrix4(receiver.matrixWorld);
      ry1.set(0, 0.5, 0).applyMatrix4(receiver.matrixWorld);
      const halfHeight = 0.5 * ry0.distanceTo(ry1);

      const geom = shadowMesh.geometry as THREE.BufferGeometry;
      const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
      const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute;
      const receiverUvAttr = geom.getAttribute(
        "receiverUv"
      ) as THREE.BufferAttribute;

      // Build positions and UVs
      for (let i = 0; i < 4; i++) {
        // Shadow quad vertex in plane-local coordinates (around centroid)
        localVec.subVectors(hitPoints[i], centroid);
        const u = localVec.dot(tangentU);
        const v = localVec.dot(tangentV);
        posAttr.setXYZ(i, u, v, 0);

        // CASTER UVs
        uvAttr.setXY(i, casterUVs[i].x, casterUVs[i].y);

        // RECEIVER UVs (mask space) — map hitPoint into [0,1]x[0,1] of receiver plane
        offsetVec.subVectors(hitPoints[i], planePoint); // relative to plane center
        const uPlane = offsetVec.dot(tangentU);
        const vPlane = offsetVec.dot(tangentV);

        const uNorm = halfWidth > 1e-5 ? uPlane / (halfWidth * 2.0) + 0.5 : 0.5;
        const vNorm =
          halfHeight > 1e-5 ? vPlane / (halfHeight * 2.0) + 0.5 : 0.5;

        receiverUvAttr.setXY(i, uNorm, vNorm);
      }

      posAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;
      receiverUvAttr.needsUpdate = true;

      // Place shadow on receiver plane, slightly offset to avoid z-fighting
      shadowMesh.position.copy(centroid);
      shadowMesh.position.addScaledVector(planeNormal, 0.001);

      // Orient quad to face the receiver plane
      shadowMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        planeNormal
      );

      // ------------------------------------------
      // CAMERA-INDEPENDENT LAYERING BY WORLD Z
      // ------------------------------------------
      receiver.getWorldPosition(receiverWorldPos);
      const worldZ = receiverWorldPos.z;

      // Geometry first
      (receiver as any).renderOrder = worldZ * 2;

      // All shadows for this receiver just above it
      shadowMesh.renderOrder = worldZ * 2 + 1;

      // ------------------------------------------
      // DISTANCE-BASED SHADOW CONTROLS
      // ------------------------------------------
      const avgDist =
        (tValues[0] + tValues[1] + tValues[2] + tValues[3]) * 0.25;

      // 1) Soft growth as shadow travels
      const softness = 1 + avgDist * 0.12;
      shadowMesh.scale.set(softness, softness, 1);

      // 2) Blur radius based on travel distance
      const blur = 0.0001 + avgDist * 0.01;
      (
        (shadowMesh.material as THREE.ShaderMaterial).uniforms.blurRadius as any
      ).value = blur;

      // 3) Opacity fade with distance
      const finalOpacity = Math.max(0, shadowOpacity - avgDist * 0.0);
      (
        (shadowMesh.material as THREE.ShaderMaterial).uniforms
          .shadowOpacity as any
      ).value = finalOpacity;

      shadowMesh.visible = finalOpacity > 0.001;
    }
  });

  // ------------------------------------------------------------
  // MESHES & SHADER (per-receiver plane mask)
  // ------------------------------------------------------------
  return (
    <>
      {receivers
        .filter((r) => r.id !== id)
        .map((r) => {
          // Build a quad geometry with UVs once per receiver
          const geom = (() => {
            const g = new THREE.BufferGeometry();

            // Two triangles: (0,1,2) and (0,2,3)
            g.setIndex([0, 1, 2, 0, 2, 3]);

            // 4 vertices * 3 components
            g.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(new Float32Array(12), 3)
            );

            // CASTER UVs
            g.setAttribute(
              "uv",
              new THREE.Float32BufferAttribute(new Float32Array(8), 2)
            );

            // RECEIVER UVs for masking
            g.setAttribute(
              "receiverUv",
              new THREE.Float32BufferAttribute(new Float32Array(8), 2)
            );

            return g;
          })();

          const hasReceiverMask = !!r.alphaMap;

          return (
            <mesh key={r.id} ref={setShadowRef(r.id)} geometry={geom}>
              <shaderMaterial
                transparent
                depthWrite={false} // correct alpha compositing
                depthTest={true} // geometry in front still occludes shadows behind
                uniforms={{
                  // CASTER silhouette
                  alphaMap: { value: alphaMap || null },

                  // RECEIVER mask (PNG used by that receiver)
                  receiverAlphaMap: {
                    value: r.alphaMap as THREE.Texture | null,
                  },
                  useReceiverMask: { value: hasReceiverMask },

                  shadowOpacity: { value: shadowOpacity },
                  blurRadius: { value: 0.01 },
                }}
                vertexShader={`
                  attribute vec2 receiverUv;

                  varying vec2 vUv;
                  varying vec2 vReceiverUv;

                  void main() {
                    vUv = uv;
                    vReceiverUv = receiverUv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                  }
                `}
                fragmentShader={`
                  varying vec2 vUv;
                  varying vec2 vReceiverUv;

                  uniform sampler2D alphaMap;
                  uniform sampler2D receiverAlphaMap;
                  uniform bool useReceiverMask;

                  uniform float shadowOpacity;
                  uniform float blurRadius;

                  void main() {
                    // --- 1. CASTER silhouette & blur ---
                    float casterAlpha = 1.0;
                    // If alphaMap is null, three.js still gives a sampler, but its contents may be zero;
                    // we treat zero as "no caster silhouette" only if a map exists.
                    // Here, we always sample and rely on provided texture.
                    float a = 0.0;
                    float total = 0.0;

                    // 9x9 Gaussian-ish blur kernel on caster's alpha
                    for (float x = -4.0; x <= 4.0; x += 1.0) {
                      for (float y = -4.0; y <= 4.0; y += 1.0) {
                        vec2 offset = vec2(x, y) * blurRadius;
                        float w = exp(-(x*x + y*y) / 16.0);
                        a += texture2D(alphaMap, vUv + offset).a * w;
                        total += w;
                      }
                    }
                    a /= max(total, 1e-4);
                    casterAlpha = a;

                    // --- 2. RECEIVER mask in plane UV space ---
                    if (useReceiverMask) {
                      // Outside [0,1] → nothing should appear on this receiver.
                      if (vReceiverUv.x < 0.0 || vReceiverUv.x > 1.0 ||
                          vReceiverUv.y < 0.0 || vReceiverUv.y > 1.0) {
                        discard;
                      }

                      float m = texture2D(receiverAlphaMap, vReceiverUv).a;
                      casterAlpha *= m;
                    }

                    // Final alpha
                    float finalAlpha = casterAlpha * shadowOpacity;
                    if (finalAlpha <= 0.001) discard;

                    gl_FragColor = vec4(0.0, 0.0, 0.0, finalAlpha);
                  }
                `}
              />
            </mesh>
          );
        })}
    </>
  );
}
