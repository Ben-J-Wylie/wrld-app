// FakeShadowCaster.tsx — silhouette shadows with correct projected UVs
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowCasterProps {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
  lightRef: React.RefObject<THREE.DirectionalLight>;
  shadowOpacity?: number;
  alphaMap?: THREE.Texture; // silhouette PNG (alpha is used)
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

  const shadowRefs = useRef(new Map<string, THREE.Mesh>());
  const setShadowRef = (receiverId: string) => (mesh: THREE.Mesh | null) => {
    if (mesh) shadowRefs.current.set(receiverId, mesh);
    else shadowRefs.current.delete(receiverId);
  };

  // register caster
  useEffect(() => {
    registerCaster({ id, targetRef });
    return () => unregisterCaster(id);
  }, [id, registerCaster, unregisterCaster, targetRef]);

  // Caster plane's original UV layout
  const casterUVs = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(1, 0),
  ];

  // local plane corners
  const localCorners = [
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
  ];

  // scratch
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

  useFrame(() => {
    const caster = targetRef.current;
    const light = lightRef.current;
    if (!caster || !light) return;

    // Light direction
    light.getWorldPosition(lightPos);
    light.target.getWorldPosition(lightTarget);
    lightDir.subVectors(lightTarget, lightPos).normalize();
    rayDir.copy(lightDir);

    // Caster transform
    caster.updateWorldMatrix(true, false);
    caster.getWorldPosition(casterWorldPos);

    // Transform caster corners to world space
    for (let i = 0; i < 4; i++) {
      worldCorners[i].copy(localCorners[i]).applyMatrix4(caster.matrixWorld);
    }

    // For each receiver
    for (const { id: receiverId, meshRef } of receivers) {
      if (receiverId === id) continue;

      const receiver = meshRef.current;
      const shadowMesh = shadowRefs.current.get(receiverId);
      if (!receiver || !shadowMesh) continue;

      receiver.getWorldPosition(planePoint);
      receiver.getWorldDirection(planeNormal).normalize();

      // Make receiver face toward light
      if (planeNormal.dot(lightDir) > 0) {
        planeNormal.negate();
      }

      const denom = rayDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        shadowMesh.visible = false;
        continue;
      }

      // Ray-plane intersections
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
      edge1.subVectors(hitPoints[1], hitPoints[0]);
      edge2.subVectors(hitPoints[2], hitPoints[0]);
      quadNormal.crossVectors(edge1, edge2).normalize();
      if (quadNormal.dot(planeNormal) < 0) {
        hitPoints.reverse();
        tValues.reverse();
        casterUVs.reverse();
      }

      // Centroid
      centroid.set(0, 0, 0);
      for (let i = 0; i < 4; i++) centroid.add(hitPoints[i]);
      centroid.multiplyScalar(0.25);

      // Local basis on receiver
      const up =
        Math.abs(planeNormal.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      tangentU.crossVectors(up, planeNormal).normalize();
      tangentV.crossVectors(planeNormal, tangentU).normalize();

      // Create quad geometry if needed
      let geom = shadowMesh.geometry;
      if (
        !geom ||
        !geom.getAttribute("position") ||
        geom.getAttribute("position").count !== 4
      ) {
        geom = new THREE.BufferGeometry();
        geom.setIndex([0, 1, 2, 0, 2, 3]);

        geom.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(new Float32Array(12), 3)
        );

        // UVs (filled dynamically)
        geom.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(new Float32Array(8), 2)
        );

        shadowMesh.geometry = geom;
      }

      const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
      const uvAttr = geom.getAttribute("uv") as THREE.BufferAttribute;

      // Update quad positions + caster UVs
      for (let i = 0; i < 4; i++) {
        // receiver-plane local coords
        const w = tmp.subVectors(hitPoints[i], centroid);
        const u = w.dot(tangentU);
        const v = w.dot(tangentV);
        posAttr.setXYZ(i, u, v, 0);

        // Use *original caster plane UVs*
        uvAttr.setXY(i, casterUVs[i].x, casterUVs[i].y);
      }

      posAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;

      // Position quad above receiver
      shadowMesh.position.copy(centroid);
      shadowMesh.position.addScaledVector(planeNormal, 0.01);

      shadowMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        planeNormal
      );

      // Softness & opacity falloff
      const avgDist =
        (tValues[0] + tValues[1] + tValues[2] + tValues[3]) * 0.25;

      const softness = 1 + avgDist * 0.1;
      shadowMesh.scale.set(softness, softness, 1);

      const finalOpacity = Math.max(0, shadowOpacity - avgDist * 0.05);
      (
        shadowMesh.material as THREE.ShaderMaterial
      ).uniforms.shadowOpacity.value = finalOpacity;
    }
  });

  // ------------------------------------------------------------
  // SHADOW MESHES + custom inverted-alpha shader
  // ------------------------------------------------------------
  return (
    <>
      {receivers
        .filter((r) => r.id !== id)
        .map((r) => (
          <mesh key={r.id} ref={setShadowRef(r.id)}>
            <shaderMaterial
              transparent
              depthWrite={false}
              uniforms={{
                alphaMap: { value: alphaMap },
                shadowOpacity: { value: shadowOpacity },
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

  void main() {
    float a = texture2D(alphaMap, vUv).a;
    float mask = a;  // ❗️ correct orientation
    gl_FragColor = vec4(0.0, 0.0, 0.0, mask * shadowOpacity);
  }
`}
            />
          </mesh>
        ))}
    </>
  );
}
