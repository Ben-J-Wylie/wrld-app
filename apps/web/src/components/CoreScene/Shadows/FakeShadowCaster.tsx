// FakeShadowCaster.tsx (fixed & working)
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

  // scratch objects
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

  const lightDir = new THREE.Vector3();
  const lightPos = new THREE.Vector3();
  const lightTarget = new THREE.Vector3();

  const planePoint = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const rayDir = new THREE.Vector3();

  const centroid = new THREE.Vector3();

  useFrame(() => {
    const caster = targetRef.current;
    const light = lightRef.current;
    if (!caster || !light) return;

    // compute real light direction
    light.getWorldPosition(lightPos);
    light.target.getWorldPosition(lightTarget);
    lightDir.subVectors(lightTarget, lightPos).normalize();
    rayDir.copy(lightDir);

    caster.updateWorldMatrix(true, false);

    // compute world corners of caster plane
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

      const denom = rayDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        shadowMesh.visible = false;
        continue;
      }

      let valid = true;
      for (let i = 0; i < 4; i++) {
        const corner = worldCorners[i];
        tmp.subVectors(planePoint, corner);
        const t = tmp.dot(planeNormal) / denom;

        if (t <= 0) {
          valid = false;
          break;
        }

        hitPoints[i].copy(corner).addScaledVector(rayDir, t);
      }

      if (!valid) {
        shadowMesh.visible = false;
        continue;
      }

      // --- FIX: ensure the quad faces the receiver plane ---
      // Compute quad normal:
      const edge1 = tmp.copy(hitPoints[1]).sub(hitPoints[0]);
      const edge2 = new THREE.Vector3().copy(hitPoints[2]).sub(hitPoints[0]);
      const quadNormal = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize();

      // Check alignment with receiver normal:
      if (quadNormal.dot(planeNormal) < 0) {
        // Reverse the hit points so winding matches the receiver
        hitPoints.reverse();
      }

      shadowMesh.visible = true;

      // compute centroid of the quad
      centroid.set(0, 0, 0);
      for (let i = 0; i < 4; i++) centroid.add(hitPoints[i]);
      centroid.multiplyScalar(0.25);

      // build geometry in LOCAL space relative to centroid
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

      for (let i = 0; i < 4; i++) {
        const p = hitPoints[i];
        pos.setXYZ(i, p.x - centroid.x, p.y - centroid.y, p.z - centroid.z);
      }

      pos.needsUpdate = true;

      // position shadowMesh at centroid
      shadowMesh.position.copy(centroid);

      // orient mesh to receiver plane
      shadowMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        planeNormal
      );
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
