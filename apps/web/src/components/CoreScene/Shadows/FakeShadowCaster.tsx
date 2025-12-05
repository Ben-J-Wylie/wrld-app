// FakeShadowCaster.tsx — dual shadow meshes per receiver
// - World shadow mesh in main scene
// - RT shadow mesh in each receiver's shadowScene (for RT previews / composites)
// - Distance-based blur identical for both
// - No receiver masking (yet)

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

const SHADOW_VERTEX_SHADER = `
  attribute vec2 receiverUv;
  varying vec2 vCasterUv;
  varying vec2 vReceiverUv;

  void main() {
    vCasterUv = uv;
    vReceiverUv = receiverUv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHADOW_FRAGMENT_SHADER = `
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

    // (Disabled) receiver masking in its own rotated UV space
    if (useReceiverMask) {
      if (vReceiverUv.x < 0.0 || vReceiverUv.x > 1.0 ||
          vReceiverUv.y < 0.0 || vReceiverUv.y > 1.0) {
        discard;
      }
      casterAlpha *= texture2D(receiverAlphaMap, vReceiverUv).a;
    }

    if (casterAlpha <= 0.001) discard;

    gl_FragColor = vec4(0.0, 0.0, 0.0, casterAlpha * globalShadowOpacity);
  }
`;

// Shared helper for geometry (4 verts, quad)
function createShadowGeometry() {
  const g = new THREE.BufferGeometry();
  g.setIndex([0, 1, 2, 0, 2, 3]);

  // positions will be filled each frame
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(12), 3)
  );

  // caster UVs (static)
  g.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
      2
    )
  );

  // receiver UVs (0..1) — filled each frame
  g.setAttribute(
    "receiverUv",
    new THREE.Float32BufferAttribute(new Float32Array(8), 2)
  );

  return g;
}

// Shared helper for material
function createShadowMaterial(
  alphaMap: THREE.Texture | null,
  globalShadowOpacity: number
) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      alphaMap: { value: alphaMap || null },
      receiverAlphaMap: { value: null },
      useCasterMap: { value: !!alphaMap },
      useReceiverMask: { value: false }, // disabled for now
      blurRadius: { value: 0.01 },
      globalShadowOpacity: { value: globalShadowOpacity },
    },
    vertexShader: SHADOW_VERTEX_SHADER,
    fragmentShader: SHADOW_FRAGMENT_SHADER,
  });
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

  // World shadow meshes (managed by R3F JSX)
  const worldShadowRefs = useRef(new Map<string, THREE.Mesh>());

  const setWorldShadowRef =
    (receiverId: string) => (mesh: THREE.Mesh | null) => {
      if (mesh) worldShadowRefs.current.set(receiverId, mesh);
      else worldShadowRefs.current.delete(receiverId);
    };

  // RT shadow meshes (imperatively added to receiver.shadowScene)
  const rtShadowRefs = useRef(new Map<string, THREE.Mesh>());

  // Register / unregister caster
  useEffect(() => {
    registerCaster({ id, targetRef });
    return () => {
      unregisterCaster(id);

      // cleanup RT meshes on unmount
      rtShadowRefs.current.forEach((mesh) => {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      rtShadowRefs.current.clear();
    };
  }, [id, registerCaster, unregisterCaster, targetRef]);

  // Ensure we have an RT shadow mesh in each receiver's shadowScene
  useEffect(() => {
    // Create missing
    for (const r of receivers) {
      if (r.id === id) continue;
      if (!r.shadowScene) continue;
      if (rtShadowRefs.current.has(r.id)) continue;

      const geom = createShadowGeometry();
      const mat = createShadowMaterial(alphaMap || null, globalShadowOpacity);

      // ⭐ Connect receiver mask
      mat.uniforms.receiverAlphaMap.value = r.alphaMap || null;
      mat.uniforms.useReceiverMask.value = true;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      r.shadowScene.add(mesh);
      rtShadowRefs.current.set(r.id, mesh);
    }

    // Remove stale
    rtShadowRefs.current.forEach((mesh, receiverId) => {
      const stillExists = receivers.some(
        (r) => r.id === receiverId && r.shadowScene
      );
      if (!stillExists) {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        rtShadowRefs.current.delete(receiverId);
      }
    });
  }, [receivers, id, alphaMap, globalShadowOpacity]);

  // Static caster UVs (0..1 square)
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

  const receiverU = new THREE.Vector3();
  const receiverV = new THREE.Vector3();

  const quadNormal = new THREE.Vector3();
  const basisMatrix = new THREE.Matrix4();

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

    // For each receiver
    for (const r of receivers) {
      if (r.id === id) continue;

      const receiver = r.meshRef.current as THREE.Mesh | null;
      const worldShadowMesh = worldShadowRefs.current.get(r.id) || null;
      const rtShadowMesh = rtShadowRefs.current.get(r.id) || null;

      if (!receiver || !worldShadowMesh) {
        if (rtShadowMesh) rtShadowMesh.visible = false;
        continue;
      }

      receiver.updateWorldMatrix(true, false);
      receiver.getWorldPosition(planePoint);
      receiver.getWorldDirection(planeNormal).normalize();

      // Normal facing caster
      if (planeNormal.dot(lightDir) > 0) planeNormal.negate();

      const denom = lightDir.dot(planeNormal);
      if (Math.abs(denom) < 1e-4) {
        worldShadowMesh.visible = false;
        if (rtShadowMesh) rtShadowMesh.visible = false;
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
        worldShadowMesh.visible = false;
        if (rtShadowMesh) rtShadowMesh.visible = false;
        continue;
      }

      // Fix winding
      const casterUvs = casterUVs.map((v) => v.clone());
      edge1.subVectors(hitPoints[1], hitPoints[0]);
      edge2.subVectors(hitPoints[2], hitPoints[0]);
      quadNormal.crossVectors(edge1, edge2).normalize();
      if (quadNormal.dot(planeNormal) < 0) {
        hitPoints.reverse();
        tValues.reverse();
        casterUvs.reverse();
      }

      // Centroid of projected quad
      centroid.set(0, 0, 0);
      for (let p of hitPoints) centroid.add(p);
      centroid.multiplyScalar(0.25);

      // Receiver basis (local X/Y axes in plane)
      rx0.set(-0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      rx1.set(0.5, 0, 0).applyMatrix4(receiver.matrixWorld);
      ry0.set(0, -0.5, 0).applyMatrix4(receiver.matrixWorld);
      ry1.set(0, 0.5, 0).applyMatrix4(receiver.matrixWorld);

      const halfWidth = 0.5 * rx0.distanceTo(rx1);
      const halfHeight = 0.5 * ry0.distanceTo(ry1);

      receiverU.subVectors(rx1, rx0).normalize();
      receiverU
        .subVectors(
          receiverU,
          planeNormal.clone().multiplyScalar(receiverU.dot(planeNormal))
        )
        .normalize();

      receiverV.subVectors(ry1, ry0).normalize();
      receiverV
        .subVectors(
          receiverV,
          planeNormal.clone().multiplyScalar(receiverV.dot(planeNormal))
        )
        .normalize();

      if (receiverU.lengthSq() < 1e-6 || receiverV.lengthSq() < 1e-6) {
        const up =
          Math.abs(planeNormal.y) < 0.9
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);
        receiverU.crossVectors(up, planeNormal).normalize();
        receiverV.crossVectors(planeNormal, receiverU).normalize();
      }

      // WORLD GEOMETRY ATTRIBUTES
      const worldGeom = worldShadowMesh.geometry as THREE.BufferGeometry;
      const worldPosAttr = worldGeom.getAttribute(
        "position"
      ) as THREE.BufferAttribute;
      const worldUvAttr = worldGeom.getAttribute("uv") as THREE.BufferAttribute;
      const worldReceiverUvAttr = worldGeom.getAttribute(
        "receiverUv"
      ) as THREE.BufferAttribute;

      // RT GEOMETRY ATTRIBUTES (if present)
      let rtPosAttr: THREE.BufferAttribute | null = null;
      let rtUvAttr: THREE.BufferAttribute | null = null;
      let rtReceiverUvAttr: THREE.BufferAttribute | null = null;
      if (rtShadowMesh) {
        const rtGeom = rtShadowMesh.geometry as THREE.BufferGeometry;
        rtPosAttr = rtGeom.getAttribute("position") as THREE.BufferAttribute;
        rtUvAttr = rtGeom.getAttribute("uv") as THREE.BufferAttribute;
        rtReceiverUvAttr = rtGeom.getAttribute(
          "receiverUv"
        ) as THREE.BufferAttribute;
      }

      const cam = r.shadowCamera || null;
      const camWidth = cam ? cam.right - cam.left : 1;
      const camHeight = cam ? cam.top - cam.bottom : 1;

      // Fill attributes
      for (let i = 0; i < 4; i++) {
        // world-space -> receiver basis
        localVec.subVectors(hitPoints[i], centroid);
        const u = localVec.dot(receiverU);
        const v = localVec.dot(receiverV);

        worldPosAttr.setXYZ(i, u, v, 0);
        worldUvAttr.setXY(i, casterUvs[i].x, casterUvs[i].y);

        // Receiver UVs (0..1)
        offsetVec.subVectors(hitPoints[i], planePoint);
        const uPlane = offsetVec.dot(receiverU);
        const vPlane = offsetVec.dot(receiverV);
        const rxUV = uPlane / (halfWidth * 2) + 0.5;
        const ryUV = vPlane / (halfHeight * 2) + 0.5;

        worldReceiverUvAttr.setXY(i, rxUV, ryUV);

        // RT geometry (same UVs, positions in RT-space)
        if (rtPosAttr && rtUvAttr && rtReceiverUvAttr) {
          rtUvAttr.setXY(i, casterUvs[i].x, casterUvs[i].y);
          rtReceiverUvAttr.setXY(i, rxUV, ryUV);

          // Map [0,1] receiver UVs to camera extents [-w/2, w/2], [-h/2, h/2]
          const x = (rxUV - 0.5) * camWidth;
          const y = (ryUV - 0.5) * camHeight;
          rtPosAttr.setXYZ(i, x, y, 0);
        }
      }

      worldPosAttr.needsUpdate = true;
      worldUvAttr.needsUpdate = true;
      worldReceiverUvAttr.needsUpdate = true;
      if (rtPosAttr && rtUvAttr && rtReceiverUvAttr) {
        rtPosAttr.needsUpdate = true;
        rtUvAttr.needsUpdate = true;
        rtReceiverUvAttr.needsUpdate = true;
      }

      // WORLD MESH TRANSFORM
      worldShadowMesh.position.copy(centroid);
      worldShadowMesh.position.addScaledVector(planeNormal, 0.001);
      basisMatrix.makeBasis(receiverU, receiverV, planeNormal);
      worldShadowMesh.quaternion.setFromRotationMatrix(basisMatrix);

      // Render order for world mesh
      receiver.getWorldPosition(receiverWorldPos);
      const worldZ = receiverWorldPos.z;
      (receiver as any).renderOrder = worldZ * 2;
      worldShadowMesh.renderOrder = worldZ * 2 + 1;

      // RT MESH TRANSFORM (in RT scene)
      if (rtShadowMesh) {
        rtShadowMesh.position.set(0, 0, 0);
        rtShadowMesh.quaternion.identity();
      }

      // Distance-based blur (same for both meshes)
      const avgDist =
        (tValues[0] + tValues[1] + tValues[2] + tValues[3]) * 0.25;
      const blur = 0.001 + avgDist * 0.005;

      const worldMat = worldShadowMesh.material as THREE.ShaderMaterial;
      worldMat.uniforms.blurRadius.value = blur;
      // Make WORLD shadow quads invisible (we only want RT-based shadows now)
      worldMat.uniforms.globalShadowOpacity.value = 0.0;

      if (rtShadowMesh) {
        const rtMat = rtShadowMesh.material as THREE.ShaderMaterial;
        rtMat.uniforms.blurRadius.value = blur;
        rtMat.uniforms.globalShadowOpacity.value = globalShadowOpacity;
      }

      worldShadowMesh.visible = true;
      if (rtShadowMesh) rtShadowMesh.visible = true;
    }
  });

  // R3F WORLD SHADOW MESHES
  return (
    <>
      {receivers
        .filter((r) => r.id !== id)
        .map((r) => {
          const geom = createShadowGeometry();
          return (
            <mesh key={r.id} ref={setWorldShadowRef(r.id)} geometry={geom}>
              <shaderMaterial
                transparent
                depthWrite={false}
                depthTest={true}
                uniforms={{
                  alphaMap: { value: alphaMap || null },
                  receiverAlphaMap: { value: r.alphaMap || null }, // ⭐ ADD THIS
                  useCasterMap: { value: !!alphaMap },
                  useReceiverMask: { value: true }, // ⭐ ENABLE MASKING
                  blurRadius: { value: 0.01 },
                  globalShadowOpacity: { value: globalShadowOpacity },
                }}
                vertexShader={SHADOW_VERTEX_SHADER}
                fragmentShader={SHADOW_FRAGMENT_SHADER}
              />
            </mesh>
          );
        })}
    </>
  );
}
