// FakeShadowCaster.tsx — unified blur system,
// PNG casters + analytic rectangle casters behave identically,
// receiver mask now correctly follows receiver Z-rotation.

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
  globalShadowOpacity = 1,
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

  // Static caster UVs (caster-space, fixed per corner)
  const casterUVs = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(1, 0),
  ];

  // Local caster quad (unit square)
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

  // NEW: receiver basis (aligned with receiver's local X/Y)
  const receiverU = new THREE.Vector3();
  const receiverV = new THREE.Vector3();

  const basisMatrix = new THREE.Matrix4();

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

      // Centroid of projected quad
      centroid.set(0, 0, 0);
      for (let p of hitPoints) centroid.add(p);
      centroid.multiplyScalar(0.25);

      // --------------------------------------------------
      // Receiver basis: use receiver's own local X/Y axes
      // so the alpha mask rotates with the plane.
      // --------------------------------------------------
      rx0.set(-0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      rx1.set(0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      ry0.set(0, -0.5, 0).applyMatrix4(receiver.matrixWorld);
      ry1.set(0, 0.5, 0).applyMatrix4(receiver.matrixWorld);

      const halfWidth = 0.5 * rx0.distanceTo(rx1);
      const halfHeight = 0.5 * ry0.distanceTo(ry1);

      // X axis: receiver local +X in world, projected to plane
      receiverU.subVectors(rx1, rx0).normalize();
      // Ensure it's exactly in the plane
      receiverU
        .subVectors(
          receiverU,
          planeNormal.clone().multiplyScalar(receiverU.dot(planeNormal))
        )
        .normalize();

      // Y axis: from receiver local +Y in world, orthonormal to receiverU & planeNormal
      receiverV.subVectors(ry1, ry0).normalize();
      receiverV
        .subVectors(
          receiverV,
          planeNormal.clone().multiplyScalar(receiverV.dot(planeNormal))
        )
        .normalize();

      // If axes are degenerate, fall back to a generic orthonormal basis
      if (receiverU.lengthSq() < 1e-6 || receiverV.lengthSq() < 1e-6) {
        const up =
          Math.abs(planeNormal.y) < 0.9
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);

        receiverU.crossVectors(up, planeNormal).normalize();
        receiverV.crossVectors(planeNormal, receiverU).normalize();
      }

      // Update geometry: coordinates in receiver's local (U,V) basis
      const geom = shadowMesh.geometry as THREE.BufferGeometry;
      const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
      const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute;
      const receiverUvAttr = geom.getAttribute(
        "receiverUv"
      ) as THREE.BufferAttribute;

      for (let i = 0; i < 4; i++) {
        // Shadow quad coords in receiver space
        localVec.subVectors(hitPoints[i], centroid);
        const u = localVec.dot(receiverU);
        const v = localVec.dot(receiverV);
        posAttr.setXYZ(i, u, v, 0);

        // Caster-space UVs (texture space)
        uvAttr.setXY(i, casterUvs[i].x, casterUvs[i].y);

        // Receiver alpha mask UVs (0..1 across its width/height in its own basis)
        offsetVec.subVectors(hitPoints[i], planePoint);
        const uPlane = offsetVec.dot(receiverU);
        const vPlane = offsetVec.dot(receiverV);

        receiverUvAttr.setXY(
          i,
          uPlane / (halfWidth * 2) + 0.5,
          vPlane / (halfHeight * 2) + 0.5
        );
      }

      posAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;
      receiverUvAttr.needsUpdate = true;

      // Position + full orientation: X→receiverU, Y→receiverV, Z→planeNormal
      shadowMesh.position.copy(centroid);
      shadowMesh.position.addScaledVector(planeNormal, 0.001);

      basisMatrix.makeBasis(receiverU, receiverV, planeNormal);
      shadowMesh.quaternion.setFromRotationMatrix(basisMatrix);

      // Render order (keep shadow just above receiver)
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

            // caster-space UVs for PNG / analytic rect
            g.setAttribute(
              "uv",
              new THREE.Float32BufferAttribute(
                new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
                2
              )
            );

            // receiver-space UVs for per-receiver alpha mask
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

                  // Analytic rectangle alpha in caster UV space
                  float rectBaseAlpha(vec2 uv) {
                    if (uv.x < 0.0 || uv.x > 1.0 ||
                        uv.y < 0.0 || uv.y > 1.0) return 0.0;

                    vec2 edgeDist = min(uv, 1.0 - uv);
                    float d = min(edgeDist.x, edgeDist.y);

                    // small feather to avoid aliasing
                    return smoothstep(0.0, 0.002, d);
                  }

                  void main() {
                    float a = 0.0;
                    float total = 0.0;

                    // Gaussian blur in UV space (same for PNG and rect)
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

                    float casterAlpha = a / max(total, 1e-4);

                    // Receiver masking in its own rotated UV space
                    if (useReceiverMask) {
                      if (vReceiverUv.x < 0.0 || vReceiverUv.x > 1.0 ||
                          vReceiverUv.y < 0.0 || vReceiverUv.y > 1.0) {
                        discard;
                      }
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
