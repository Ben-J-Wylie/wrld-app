// FakeShadowCaster.tsx — unified blur system,
// PNG casters + analytic rectangle casters behave identically,
// procedural silhouette is evaluated in caster-space UV (no rotation).

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowCasterProps {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
  lightRef: React.RefObject<THREE.DirectionalLight>;
  alphaMap?: THREE.Texture | null; // PNG silhouette (optional)
  globalShadowOpacity?: number;
}

export function FakeShadowCaster({
  id,
  targetRef,
  lightRef,
  alphaMap,
  globalShadowOpacity = 0.5,
}: FakeShadowCasterProps) {
  const { receivers, registerCaster, unregisterCaster } =
    React.useContext(FakeShadowContext);

  const shadowRefs = useRef(new Map<string, THREE.Mesh>());
  const setShadowRef = (receiverId: string) => (mesh: THREE.Mesh | null) => {
    if (mesh) shadowRefs.current.set(receiverId, mesh);
    else shadowRefs.current.delete(receiverId);
  };

  // Register / unregister
  useEffect(() => {
    registerCaster({ id, targetRef });
    return () => unregisterCaster(id);
  }, [id, registerCaster, unregisterCaster, targetRef]);

  // Static caster UVs (caster-space, fixed)
  const casterUVs = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(1, 0),
  ];

  // Local caster quad
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

  const lightPos = new THREE.Vector3();
  const lightTarget = new THREE.Vector3();
  const lightDir = new THREE.Vector3();

  const planePoint = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();

  const tmp = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  const tangentU = new THREE.Vector3();
  const tangentV = new THREE.Vector3();

  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();

  const casterWorldPos = new THREE.Vector3();
  const receiverWorldPos = new THREE.Vector3();

  const offsetVec = new THREE.Vector3();
  const localVec = new THREE.Vector3();

  const rx0 = new THREE.Vector3();
  const rx1 = new THREE.Vector3();
  const ry0 = new THREE.Vector3();
  const ry1 = new THREE.Vector3();

  // ==========================
  // FRAME LOOP
  // ==========================
  useFrame(() => {
    const caster = targetRef.current;
    const light = lightRef.current;
    if (!caster || !light) return;

    // Light direction
    light.getWorldPosition(lightPos);
    light.target.getWorldPosition(lightTarget);
    lightDir.subVectors(lightTarget, lightPos).normalize();

    // Caster transform
    caster.updateWorldMatrix(true, false);
    caster.getWorldPosition(casterWorldPos);

    // Caster quad → world space
    for (let i = 0; i < 4; i++) {
      worldCorners[i].copy(localCorners[i]).applyMatrix4(caster.matrixWorld);
    }

    // ======================================================
    // For each receiver
    // ======================================================
    for (const r of receivers) {
      if (r.id === id) continue;

      const receiver = r.meshRef.current as THREE.Mesh | null;
      const shadowMesh = shadowRefs.current.get(r.id);
      if (!receiver || !shadowMesh) continue;

      receiver.updateWorldMatrix(true, false);
      receiver.getWorldPosition(planePoint);
      receiver.getWorldDirection(planeNormal).normalize();

      // Normal facing caster
      if (planeNormal.dot(lightDir) > 0) planeNormal.negate();

      const denom = lightDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        shadowMesh.visible = false;
        continue;
      }

      // Project caster corners onto receiver plane
      let valid = true;
      for (let i = 0; i < 4; i++) {
        tmp.subVectors(planePoint, worldCorners[i]);
        const t = tmp.dot(planeNormal) / denom;
        if (t <= 0) {
          valid = false;
          break;
        }
        tValues[i] = t;
        hitPoints[i].copy(worldCorners[i]).addScaledVector(lightDir, t);
      }
      if (!valid) {
        shadowMesh.visible = false;
        continue;
      }

      // Fix winding
      const casterUvs = casterUVs.map((v) => v.clone());
      edge1.subVectors(hitPoints[1], hitPoints[0]);
      edge2.subVectors(hitPoints[2], hitPoints[0]);
      const quadNormal = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize();
      if (quadNormal.dot(planeNormal) < 0) {
        hitPoints.reverse();
        tValues.reverse();
        casterUvs.reverse();
      }

      // Centroid
      centroid.set(0, 0, 0);
      for (let p of hitPoints) centroid.add(p);
      centroid.multiplyScalar(0.25);

      // Tangents (plane-local axes)
      const up =
        Math.abs(planeNormal.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      tangentU.crossVectors(up, planeNormal).normalize();
      tangentV.crossVectors(planeNormal, tangentU).normalize();

      // Receiver extents
      rx0.set(-0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      rx1.set(0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      const halfWidth = 0.5 * rx0.distanceTo(rx1);

      ry0.set(0, -0.5, 0).applyMatrix4(receiver.matrixWorld);
      ry1.set(0, 0.5, 0).applyMatrix4(receiver.matrixWorld);
      const halfHeight = 0.5 * ry0.distanceTo(ry1);

      // Update geometry
      const geom = shadowMesh.geometry as THREE.BufferGeometry;
      const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
      const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute;
      const receiverUvAttr = geom.getAttribute(
        "receiverUv"
      ) as THREE.BufferAttribute;

      for (let i = 0; i < 4; i++) {
        // Projected quad coords (receiver-space)
        localVec.subVectors(hitPoints[i], centroid);
        const u = localVec.dot(tangentU);
        const v = localVec.dot(tangentV);
        posAttr.setXYZ(i, u, v, 0);

        // Caster-space UVs (static)
        uvAttr.setXY(i, casterUvs[i].x, casterUvs[i].y);

        // Receiver mask UVs
        offsetVec.subVectors(hitPoints[i], planePoint);
        const uPlane = offsetVec.dot(tangentU);
        const vPlane = offsetVec.dot(tangentV);
        receiverUvAttr.setXY(
          i,
          uPlane / (halfWidth * 2) + 0.5,
          vPlane / (halfHeight * 2) + 0.5
        );
      }

      posAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;
      receiverUvAttr.needsUpdate = true;

      // Position/orient shadow mesh
      shadowMesh.position.copy(centroid);
      shadowMesh.position.addScaledVector(planeNormal, 0.001);
      shadowMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        planeNormal
      );

      // Render order
      receiver.getWorldPosition(receiverWorldPos);
      const worldZ = receiverWorldPos.z;
      (receiver as any).renderOrder = worldZ * 2;
      shadowMesh.renderOrder = worldZ * 2 + 1;

      // Distance-based blur
      const avgDist =
        (tValues[0] + tValues[1] + tValues[2] + tValues[3]) * 0.25;
      const blur = 0.001 + avgDist * 0.005;
      (shadowMesh.material as THREE.ShaderMaterial).uniforms.blurRadius.value =
        blur;

      // Global opacity
      (
        shadowMesh.material as THREE.ShaderMaterial
      ).uniforms.globalShadowOpacity.value = globalShadowOpacity;

      shadowMesh.visible = true;
    }
  });

  // ======================================================
  // BUILD SHADOW GEOMETRY
  // ======================================================
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

            // IMPORTANT: caster-space UVs (prevents rotation)
            g.setAttribute(
              "uv",
              new THREE.Float32BufferAttribute(
                new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
                2
              )
            );

            g.setAttribute(
              "receiverUv",
              new THREE.Float32BufferAttribute(new Float32Array(8), 2)
            );

            return g;
          })();

          return (
            <mesh key={r.id} ref={setShadowRef(r.id)} geometry={geom}>
              <shaderMaterial
                transparent
                depthWrite={false}
                depthTest={true}
                uniforms={{
                  alphaMap: { value: alphaMap || null },
                  receiverAlphaMap: { value: r.alphaMap || null },
                  useCasterMap: { value: !!alphaMap },
                  useReceiverMask: { value: !!r.alphaMap },
                  blurRadius: { value: 0.01 },
                  globalShadowOpacity: { value: globalShadowOpacity },
                }}
                vertexShader={`
                  attribute vec2 receiverUv;
                  varying vec2 vCasterUv;
                  varying vec2 vReceiverUv;

                  void main() {
                    // uv is caster-space UV because of attribute we set
                    vCasterUv = uv;
                    vReceiverUv = receiverUv;
                    gl_Position = projectionMatrix *
                                  modelViewMatrix *
                                  vec4(position, 1.0);
                  }
                `}
                fragmentShader={`
                  varying vec2 vCasterUv;
                  varying vec2 vReceiverUv;

                  uniform sampler2D alphaMap;
                  uniform sampler2D receiverAlphaMap;

                  uniform bool useCasterMap;
                  uniform bool useReceiverMask;

                  uniform float blurRadius;
                  uniform float globalShadowOpacity;

                  // Analytic rectangle alpha (caster-space), no rotation
                  float rectBaseAlpha(vec2 uv) {
                    if (uv.x < 0.0 || uv.x > 1.0 ||
                        uv.y < 0.0 || uv.y > 1.0) return 0.0;

                    vec2 edgeDist = min(uv, 1.0 - uv);
                    float d = min(edgeDist.x, edgeDist.y);

                    // tiny feather to avoid aliasing
                    return smoothstep(0.0, 0.002, d);
                  }

                  void main() {
                    float casterAlpha = 0.0;

                    float a = 0.0;
                    float total = 0.0;

                    // Gaussian blur - same for PNG & no-PNG
                    for (float x = -4.0; x <= 4.0; x++) {
                      for (float y = -4.0; y <= 4.0; y++) {
                        vec2 off = vec2(x, y) * blurRadius;
                        float w = exp(-(x*x + y*y) / 16.0);

                        float s = 0.0;
                        if (useCasterMap) {
                          s = texture2D(alphaMap, vCasterUv + off).a;
                        } else {
                          s = rectBaseAlpha(vCasterUv + off);
                        }

                        a += s * w;
                        total += w;
                      }
                    }

                    casterAlpha = a / max(total, 1e-4);

                    // Receiver masking
                    if (useReceiverMask) {
                      if (vReceiverUv.x < 0.0 || vReceiverUv.x > 1.0 ||
                          vReceiverUv.y < 0.0 || vReceiverUv.y > 1.0)
                        discard;

                      casterAlpha *= texture2D(receiverAlphaMap, vReceiverUv).a;
                    }

                    if (casterAlpha <= 0.001) discard;

                    gl_FragColor = vec4(
                      0.0, 0.0, 0.0,
                      casterAlpha * globalShadowOpacity
                    );
                  }
                `}
              />
            </mesh>
          );
        })}
    </>
  );
}
