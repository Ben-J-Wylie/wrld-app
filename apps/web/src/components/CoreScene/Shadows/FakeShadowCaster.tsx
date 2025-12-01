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
  alphaMap?: THREE.Texture | null; // silhouette PNG
}

export function FakeShadowCaster({
  id,
  targetRef,
  lightRef,
  shadowOpacity = 0.4,
  alphaMap,
}: FakeShadowCasterProps) {
  const { receivers, registerCaster, unregisterCaster } =
    React.useContext(FakeShadowContext);

  // Shadow planes per receiver
  const shadowRefs = useRef(new Map<string, THREE.Mesh>());
  const setShadowRef = (receiverId: string) => (mesh: THREE.Mesh | null) => {
    if (mesh) shadowRefs.current.set(receiverId, mesh);
    else shadowRefs.current.delete(receiverId);
  };

  // Register this caster
  useEffect(() => {
    registerCaster({ id, targetRef });
    return () => unregisterCaster(id);
  }, [id, registerCaster, unregisterCaster, targetRef]);

  // Base UVs and local quad corners
  const baseCasterUVs = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(1, 0),
  ];

  const localCorners = [
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
  ];

  // Scratch variables
  const worldCorners = Array.from({ length: 4 }, () => new THREE.Vector3());
  const hitPoints = Array.from({ length: 4 }, () => new THREE.Vector3());
  const tValues = [0, 0, 0, 0];

  const lightPos = new THREE.Vector3();
  const lightTarget = new THREE.Vector3();
  const lightDir = new THREE.Vector3();

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

  const localVec = new THREE.Vector3();
  const offsetVec = new THREE.Vector3();

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

    // Caster world transform and corners
    caster.updateWorldMatrix(true, false);
    caster.getWorldPosition(casterWorldPos);

    for (let i = 0; i < 4; i++) {
      worldCorners[i].copy(localCorners[i]).applyMatrix4(caster.matrixWorld);
    }

    // Per receiver
    for (const r of receivers) {
      if (r.id === id) continue;

      const receiver = r.meshRef.current as THREE.Mesh | null;
      const shadowMesh = shadowRefs.current.get(r.id);
      if (!receiver || !shadowMesh) continue;

      receiver.updateWorldMatrix(true, false);
      receiver.getWorldPosition(planePoint);
      receiver.getWorldDirection(planeNormal).normalize();

      // Force plane normal to face the light
      if (planeNormal.dot(lightDir) > 0) planeNormal.negate();

      const denom = rayDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        shadowMesh.visible = false;
        continue;
      }

      // Intersect caster corners with receiver plane
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

      // Fix winding
      const casterUVs = baseCasterUVs.map((v) => v.clone());
      edge1.subVectors(hitPoints[1], hitPoints[0]);
      edge2.subVectors(hitPoints[2], hitPoints[0]);
      quadNormal.crossVectors(edge1, edge2).normalize();
      if (quadNormal.dot(planeNormal) < 0) {
        hitPoints.reverse();
        tValues.reverse();
        casterUVs.reverse();
      }

      // Compute centroid
      centroid.set(0, 0, 0);
      for (let i = 0; i < 4; i++) centroid.add(hitPoints[i]);
      centroid.multiplyScalar(0.25);

      // Tangent basis
      const up =
        Math.abs(planeNormal.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      tangentU.crossVectors(up, planeNormal).normalize();
      tangentV.crossVectors(planeNormal, tangentU).normalize();

      // Receiver extents in world space
      rx0.set(-0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      rx1.set(0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      const halfWidth = 0.5 * rx0.distanceTo(rx1);

      ry0.set(0, -0.5, 0).applyMatrix4(receiver.matrixWorld);
      ry1.set(0, 0.5, 0).applyMatrix4(receiver.matrixWorld);
      const halfHeight = 0.5 * ry0.distanceTo(ry1);

      // BUFFER UPDATES
      const geom = shadowMesh.geometry as THREE.BufferGeometry;
      const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
      const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute;
      const receiverUvAttr = geom.getAttribute(
        "receiverUv"
      ) as THREE.BufferAttribute;

      for (let i = 0; i < 4; i++) {
        // Position in plane local space
        localVec.subVectors(hitPoints[i], centroid);
        const u = localVec.dot(tangentU);
        const v = localVec.dot(tangentV);
        posAttr.setXYZ(i, u, v, 0);

        // Caster UV
        uvAttr.setXY(i, casterUVs[i].x, casterUVs[i].y);

        // Receiver mask UV
        offsetVec.subVectors(hitPoints[i], planePoint);
        const uPlane = offsetVec.dot(tangentU);
        const vPlane = offsetVec.dot(tangentV);
        const uNorm = halfWidth > 1e-5 ? uPlane / (halfWidth * 2) + 0.5 : 0.5;
        const vNorm = halfHeight > 1e-5 ? vPlane / (halfHeight * 2) + 0.5 : 0.5;
        receiverUvAttr.setXY(i, uNorm, vNorm);
      }

      posAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;
      receiverUvAttr.needsUpdate = true;

      // Position & orientation
      shadowMesh.position.copy(centroid);
      shadowMesh.position.addScaledVector(planeNormal, 0.001);
      shadowMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        planeNormal
      );

      // ORDERING
      receiver.getWorldPosition(receiverWorldPos);
      const worldZ = receiverWorldPos.z;
      (receiver as any).renderOrder = worldZ * 2;
      shadowMesh.renderOrder = worldZ * 2 + 1;

      // DISTANCE-BASED EFFECTS
      const avgDist =
        (tValues[0] + tValues[1] + tValues[2] + tValues[3]) * 0.25;

      // ----- IMPORTANT -----
      // No mesh scaling. Mask must remain exact.
      // shadowMesh.scale.set(1, 1, 1);

      // Blur grows with distance (this acts like softness)
      const blur = 0.005 + avgDist * 0.001;
      (
        (shadowMesh.material as THREE.ShaderMaterial).uniforms.blurRadius as any
      ).value = blur;

      // Opacity fade
      const finalOpacity = Math.max(0, shadowOpacity - avgDist * 0.03);
      (
        (shadowMesh.material as THREE.ShaderMaterial).uniforms
          .shadowOpacity as any
      ).value = finalOpacity;

      shadowMesh.visible = finalOpacity > 0.001;
    }
  });

  // CREATE SHADOW PLANES FOR EACH RECEIVER
  return (
    <>
      {receivers
        .filter((r) => r.id !== id)
        .map((r) => {
          const geom = (() => {
            const g = new THREE.BufferGeometry();
            g.setIndex([0, 1, 2, 0, 2, 3]);
            g.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(new Float32Array(12), 3)
            );
            g.setAttribute(
              "uv",
              new THREE.Float32BufferAttribute(new Float32Array(8), 2)
            );
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
                depthWrite={false}
                depthTest={true}
                uniforms={{
                  alphaMap: { value: alphaMap || null },
                  receiverAlphaMap: { value: r.alphaMap || null },
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
                    gl_Position =
                      projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
                    // --- Blur silhouette ---
                    float a = 0.0;
                    float total = 0.0;

                    for (float x = -4.0; x <= 4.0; x++) {
                      for (float y = -4.0; y <= 4.0; y++) {
                        vec2 off = vec2(x,y) * blurRadius;
                        float w = exp(-(x*x + y*y) / 16.0);
                        a += texture2D(alphaMap, vUv + off).a * w;
                        total += w;
                      }
                    }
                    float casterAlpha = a / max(total, 1e-4);

                    // --- Receiver mask ---
                    if (useReceiverMask) {
                      if (vReceiverUv.x < 0.0 || vReceiverUv.x > 1.0 ||
                          vReceiverUv.y < 0.0 || vReceiverUv.y > 1.0) discard;

                      float m = texture2D(receiverAlphaMap, vReceiverUv).a;
                      casterAlpha *= m;
                    }

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
