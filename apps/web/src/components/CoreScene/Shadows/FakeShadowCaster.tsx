// FakeShadowCaster.tsx — silhouette shadows with distance-blur, scale, and fade
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowCasterProps {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
  lightRef: React.RefObject<THREE.DirectionalLight>;
  shadowOpacity?: number;
  alphaMap?: THREE.Texture;
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

  // Base caster UVs
  const casterUVs = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(1, 0),
  ];

  // Local caster quad corners
  const localCorners = [
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
  ];

  // Scratch
  const worldCorners = Array.from({ length: 4 }, () => new THREE.Vector3());
  const hitPoints = Array.from({ length: 4 }, () => new THREE.Vector3());
  const tValues = [0, 0, 0, 0];

  const lightDir = new THREE.Vector3();
  const lightPos = new THREE.Vector3();
  const lightTarget = new THREE.Vector3();

  const planePoint = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const rayDir = new THREE.Vector3();

  const centroid = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const quadNormal = new THREE.Vector3();
  const tangentU = new THREE.Vector3();
  const tangentV = new THREE.Vector3();

  const casterWorldPos = new THREE.Vector3();
  const receiverWorldPos = new THREE.Vector3();

  useFrame(() => {
    const caster = targetRef.current;
    const light = lightRef.current;
    if (!caster || !light) return;

    // Light direction
    light.getWorldPosition(lightPos);
    light.target.getWorldPosition(lightTarget);
    lightDir.subVectors(lightTarget, lightPos).normalize();
    rayDir.copy(lightDir);

    // Caster world pos (in case you ever want to use it)
    caster.updateWorldMatrix(true, false);
    caster.getWorldPosition(casterWorldPos);

    // Transform caster corners into world space
    for (let i = 0; i < 4; i++) {
      worldCorners[i].copy(localCorners[i]).applyMatrix4(caster.matrixWorld);
    }

    // For each receiver: project quad, build shadow, assign renderOrder
    for (const { id: receiverId, meshRef } of receivers) {
      if (receiverId === id) continue; // skip self

      const receiver = meshRef.current;
      const shadowMesh = shadowRefs.current.get(receiverId);
      if (!receiver || !shadowMesh) continue;

      // Receiver plane
      receiver.updateWorldMatrix(true, false);
      receiver.getWorldPosition(planePoint);
      receiver.getWorldDirection(planeNormal).normalize();

      // Ensure plane faces light
      if (planeNormal.dot(lightDir) > 0) planeNormal.negate();

      const denom = rayDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        shadowMesh.visible = false;
        continue;
      }

      // Ray → plane intersections
      let valid = true;
      for (let i = 0; i < 4; i++) {
        tmp.subVectors(planePoint, worldCorners[i]);
        const t = tmp.dot(planeNormal) / denom;
        if (t <= 0) {
          valid = false;
          break;
        }
        tValues[i] = t;
        hitPoints[i].copy(worldCorners[i]).addScaledVector(rayDir, tValues[i]);
      }

      if (!valid) {
        shadowMesh.visible = false;
        continue;
      }

      // Fix winding if needed
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

      // Shadow quad in receiver-local UV-like space
      const geom = shadowMesh.geometry;
      const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
      const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute;

      for (let i = 0; i < 4; i++) {
        const w = tmp.subVectors(hitPoints[i], centroid);

        const u = w.dot(tangentU);
        const v = w.dot(tangentV);

        posAttr.setXYZ(i, u, v, 0);
        uvAttr.setXY(i, casterUVs[i].x, casterUVs[i].y);
      }

      posAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;

      // Place shadow on receiver plane, slightly in front to avoid z-fighting
      shadowMesh.position.copy(centroid);
      shadowMesh.position.addScaledVector(planeNormal, 0.001);

      shadowMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        planeNormal
      );

      // ------------------------------------------
      // CAMERA-INDEPENDENT LAYERING BY WORLD Z
      // ------------------------------------------
      // We sort by the RECEIVER'S world Z:
      //   receiver geometry  -> even  (2 * z)
      //   its shadow planes  -> odd   (2 * z + 1)
      // This yields:
      //   backdrop, backdrop shadows, next plane, its shadows, ...
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
      const finalOpacity = Math.max(0, shadowOpacity - avgDist * 0.01);
      (
        (shadowMesh.material as THREE.ShaderMaterial).uniforms
          .shadowOpacity as any
      ).value = finalOpacity;

      shadowMesh.visible = finalOpacity > 0.001;
    }
  });

  // ------------------------------------------------------------
  // SHADOW MESHES WITH CORRECT GEOMETRY + BLUR SHADER
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

            // 4 vertices * 2 components
            g.setAttribute(
              "uv",
              new THREE.Float32BufferAttribute(new Float32Array(8), 2)
            );

            return g;
          })();

          return (
            <mesh
              key={r.id}
              ref={setShadowRef(r.id)}
              geometry={geom}
              // depthTest stays true so foreground geometry occludes shadows behind
            >
              <shaderMaterial
                transparent
                depthWrite={false} // ← REQUIRED for correct alpha behavior
                depthTest={true} // ← Keep this ON so geometry still occludes properly
                uniforms={{
                  alphaMap: { value: alphaMap },
                  shadowOpacity: { value: shadowOpacity },
                  blurRadius: { value: 0.01 },
                }}
                vertexShader={`
                  varying vec2 vUv;
                  void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                  }
                `}
                fragmentShader={`
                  varying vec2 vUv;
                  uniform sampler2D alphaMap;
                  uniform float shadowOpacity;
                  uniform float blurRadius;

                  void main() {
                    float a = 0.0;
                    float total = 0.0;

                    // 9x9 Gaussian-ish blur kernel
                    for (float x = -4.0; x <= 4.0; x += 1.0) {
                      for (float y = -4.0; y <= 4.0; y += 1.0) {
                        vec2 offset = vec2(x, y) * blurRadius;
                        float w = exp(-(x*x + y*y) / 16.0);
                        a += texture2D(alphaMap, vUv + offset).a * w;
                        total += w;
                      }
                    }

                    a /= max(total, 1e-4);

                    gl_FragColor = vec4(0.0, 0.0, 0.0, a * shadowOpacity);
                  }
                `}
              />
            </mesh>
          );
        })}
    </>
  );
}
