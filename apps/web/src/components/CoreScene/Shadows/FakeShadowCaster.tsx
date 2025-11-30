// FakeShadowCaster.tsx — with distance-based softness & opacity falloff
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowCasterProps {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
  lightRef: React.RefObject<THREE.DirectionalLight>;
  shadowOpacity?: number;
}

export function FakeShadowCaster({
  id,
  targetRef,
  lightRef,
  shadowOpacity = 0.4,
}: FakeShadowCasterProps) {
  const { receivers, registerCaster, unregisterCaster } =
    React.useContext(FakeShadowContext);

  const shadowRefs = useRef(new Map<string, THREE.Mesh>());
  const setShadowRef = (receiverId: string) => (mesh: THREE.Mesh | null) => {
    if (mesh) shadowRefs.current.set(receiverId, mesh);
    else shadowRefs.current.delete(receiverId);
  };

  useEffect(() => {
    registerCaster({ id, targetRef });
    return () => unregisterCaster(id);
  }, [id, registerCaster, unregisterCaster, targetRef]);

  // static caster corners in local space
  const localCorners = [
    new THREE.Vector3(-0.5, -0.5, 0),
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
  ];

  // scratch
  const worldCorners = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  const hitPoints = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  const tValues = [0, 0, 0, 0]; // <— new for softness

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

  useFrame(() => {
    const caster = targetRef.current;
    const light = lightRef.current;
    if (!caster || !light) return;

    // Light direction
    light.getWorldPosition(lightPos);
    light.target.getWorldPosition(lightTarget);
    lightDir.subVectors(lightTarget, lightPos).normalize();
    rayDir.copy(lightDir);

    caster.updateWorldMatrix(true, false);

    // corners in world space
    for (let i = 0; i < 4; i++) {
      worldCorners[i].copy(localCorners[i]).applyMatrix4(caster.matrixWorld);
    }

    // for each receiver
    for (const { id: receiverId, meshRef } of receivers) {
      if (receiverId === id) continue;

      const receiver = meshRef.current;
      const shadowMesh = shadowRefs.current.get(receiverId);
      if (!receiver || !shadowMesh) continue;

      receiver.getWorldPosition(planePoint);
      receiver.getWorldDirection(planeNormal).normalize();

      // Make the receiver normal face against the light direction
      if (planeNormal.dot(lightDir) > 0) {
        planeNormal.negate();
      }

      const denom = rayDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        shadowMesh.visible = false;
        continue;
      }

      let valid = true;

      // Ray-plane intersections for all 4 corners
      for (let i = 0; i < 4; i++) {
        const corner = worldCorners[i];
        tmp.subVectors(planePoint, corner);
        const t = tmp.dot(planeNormal) / denom;

        if (t <= 0) {
          valid = false;
          break;
        }

        tValues[i] = t; // <— store corner distance
        hitPoints[i].copy(corner).addScaledVector(rayDir, t);
      }

      if (!valid) {
        shadowMesh.visible = false;
        continue;
      }

      // Winding correction
      edge1.subVectors(hitPoints[1], hitPoints[0]);
      edge2.subVectors(hitPoints[2], hitPoints[0]);
      quadNormal.crossVectors(edge1, edge2).normalize();

      if (quadNormal.dot(planeNormal) < 0) {
        hitPoints.reverse();
        tValues.reverse();
      }

      shadowMesh.visible = true;

      // Centroid
      centroid.set(0, 0, 0);
      for (let i = 0; i < 4; i++) centroid.add(hitPoints[i]);
      centroid.multiplyScalar(0.25);

      // local basis on receiver plane
      const up =
        Math.abs(planeNormal.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);

      tangentU.crossVectors(up, planeNormal).normalize();
      tangentV.crossVectors(planeNormal, tangentU).normalize();

      // quad geometry
      let geom = shadowMesh.geometry;
      if (!geom || (geom.getAttribute("position")?.count ?? 0) !== 4) {
        geom = new THREE.BufferGeometry();
        geom.setIndex([0, 1, 2, 0, 2, 3]);
        geom.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(new Float32Array(12), 3)
        );
        shadowMesh.geometry = geom;
      }

      const pos = geom.getAttribute("position") as THREE.BufferAttribute;

      // Fill local (u,v) vertex positions
      for (let i = 0; i < 4; i++) {
        const worldOffset = tmp.subVectors(hitPoints[i], centroid);
        const u = worldOffset.dot(tangentU);
        const v = worldOffset.dot(tangentV);
        pos.setXYZ(i, u, v, 0);
      }

      pos.needsUpdate = true;

      // Position + small offset above receiver
      shadowMesh.position.copy(centroid);
      shadowMesh.position.addScaledVector(planeNormal, 0.001);

      // Orient so +Z points along plane normal
      shadowMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        planeNormal
      );

      // ------------------------------------------------------------
      // ⭐ Distance-based softness & opacity
      // ------------------------------------------------------------
      const avgDist =
        (tValues[0] + tValues[1] + tValues[2] + tValues[3]) * 0.25;

      // Softening: shadows get bigger with distance
      const softnessBase = 1.0;
      const softnessFactor = 0.1; // tweak to control blur growth
      const softness = softnessBase + avgDist * softnessFactor;

      shadowMesh.scale.set(softness, softness, 1);

      // Opacity falloff
      const baseOpacity = shadowOpacity ?? 0.4;
      const opacityFalloff = 0.05; // tweak
      const finalOpacity = Math.max(0, baseOpacity - avgDist * opacityFalloff);

      (shadowMesh.material as THREE.MeshBasicMaterial).opacity = finalOpacity;
      // ------------------------------------------------------------
    }
  });

  return (
    <>
      {receivers
        .filter((r) => r.id !== id)
        .map((r) => (
          <mesh key={r.id} ref={setShadowRef(r.id)}>
            <meshBasicMaterial
              color="black"
              transparent
              opacity={shadowOpacity}
              depthWrite={false}
            />
          </mesh>
        ))}
    </>
  );
}
