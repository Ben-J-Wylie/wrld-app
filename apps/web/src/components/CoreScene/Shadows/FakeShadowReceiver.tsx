// FakeShadowReceiver.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowReceiverProps {
  id: string;
  meshRef: React.RefObject<THREE.Mesh>;
  alphaMap?: THREE.Texture | null;
}

export function FakeShadowReceiver({
  id,
  meshRef,
  alphaMap,
}: FakeShadowReceiverProps) {
  const { registerReceiver, unregisterReceiver } =
    React.useContext(FakeShadowContext);

  const { gl } = useThree();

  // Duplicate “canvas” mesh for composited shadows
  const canvasRef = useRef<THREE.Mesh>(null!);

  // Offscreen render target + scene + camera
  const rtRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const rtSceneRef = useRef<THREE.Scene | null>(null);
  const rtCameraRef = useRef<THREE.OrthographicCamera | null>(null);

  // Debug quad (optional)
  const debugQuadRef = useRef<THREE.Mesh | null>(null);

  // Canvas material
  const canvasMatRef = useRef<THREE.MeshBasicMaterial>(null!);

  // -------------------------------------------------------------
  // Create RenderTarget + Scene + Camera
  // -------------------------------------------------------------
  useEffect(() => {
    // Start tiny — will be resized dynamically
    const rt = new THREE.WebGLRenderTarget(4, 4, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    rt.texture.name = `ReceiverShadowRT_${id}`;

    // Offscreen scene
    const rtScene = new THREE.Scene();
    rtScene.background = new THREE.Color(0x000000);

    // Ortho camera (frustum replaced when sized)
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    cam.position.set(0, 0, 1);
    cam.lookAt(0, 0, 0);
    rtScene.add(cam);

    // Debug quad
    const quadGeom = new THREE.PlaneGeometry(1, 1);
    const quadMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const quad = new THREE.Mesh(quadGeom, quadMat);
    rtScene.add(quad);

    rtRef.current = rt;
    rtSceneRef.current = rtScene;
    rtCameraRef.current = cam;
    debugQuadRef.current = quad;

    // Assign RT texture
    if (canvasMatRef.current) {
      canvasMatRef.current.map = rt.texture;
      canvasMatRef.current.needsUpdate = true;
      canvasMatRef.current.transparent = true;
    }

    // Register receiver in global shadow context
    registerReceiver({
      id,
      meshRef,
      alphaMap: alphaMap || null,
      canvasRef,
      shadowRT: rt,
      shadowScene: rtScene,
      shadowCamera: cam,
    });

    return () => {
      unregisterReceiver(id);

      rt.dispose();
      quadGeom.dispose();
      quadMat.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, meshRef, alphaMap, gl, registerReceiver, unregisterReceiver]);

  // -------------------------------------------------------------
  // Clone geometry to canvas mesh
  // -------------------------------------------------------------
  useEffect(() => {
    const receiverMesh = meshRef.current;
    const canvasMesh = canvasRef.current;
    if (!receiverMesh || !canvasMesh) return;

    canvasMesh.geometry = receiverMesh.geometry.clone();
  }, [meshRef]);

  // -------------------------------------------------------------
  // Sync canvas transform to receiver
  // -------------------------------------------------------------
  useFrame(() => {
    const mesh = meshRef.current;
    const canvas = canvasRef.current;
    if (!mesh || !canvas) return;

    mesh.updateWorldMatrix(true, false);

    canvas.position.setFromMatrixPosition(mesh.matrixWorld);
    canvas.quaternion.setFromRotationMatrix(mesh.matrixWorld);
    canvas.scale.copy(mesh.scale);

    // Nudge forward
    const normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(canvas.quaternion)
      .multiplyScalar(0.002);
    canvas.position.add(normal);
  });

  // -------------------------------------------------------------
  // CORRECT RT SIZING BASED ON GEOMETRY BOUNDS × SCALE
  // -------------------------------------------------------------
  const PIXELS_PER_WORLD_UNIT = 128;

  useFrame(() => {
    const receiver = meshRef.current;
    const rt = rtRef.current;
    const cam = rtCameraRef.current;
    const quad = debugQuadRef.current;
    if (!receiver || !rt || !cam) return;

    receiver.updateWorldMatrix(true, false);

    // 1. Read geometry bounds
    const geom = receiver.geometry;
    geom.computeBoundingBox();

    const bb = geom.boundingBox!;
    const geomW = bb.max.x - bb.min.x;
    const geomH = bb.max.y - bb.min.y;

    // 2. Multiply by mesh scale for FINAL world-space size
    const worldW = geomW * receiver.scale.x;
    const worldH = geomH * receiver.scale.y;

    // 3. Convert to pixel dimensions
    const targetW = Math.max(32, Math.round(worldW * PIXELS_PER_WORLD_UNIT));
    const targetH = Math.max(32, Math.round(worldH * PIXELS_PER_WORLD_UNIT));

    // 4. Only resize when needed
    if (rt.width !== targetW || rt.height !== targetH) {
      rt.setSize(targetW, targetH);

      // Camera frustum matches geometry dimensions
      cam.left = -worldW / 2;
      cam.right = worldW / 2;
      cam.top = worldH / 2;
      cam.bottom = -worldH / 2;
      cam.updateProjectionMatrix();

      // Resize debug quad to match area coverage
      if (quad) quad.scale.set(worldW, worldH, 1);
    }
  });

  // -------------------------------------------------------------
  // Render RT every frame
  // -------------------------------------------------------------
  useFrame(() => {
    const rt = rtRef.current;
    const rtScene = rtSceneRef.current;
    const rtCamera = rtCameraRef.current;
    if (!rt || !rtScene || !rtCamera) return;

    const prevRT = gl.getRenderTarget();

    gl.setRenderTarget(rt);
    gl.clearColor();
    gl.render(rtScene, rtCamera);

    gl.setRenderTarget(prevRT);
  });

  // -------------------------------------------------------------
  // Canvas mesh (composited shadow plane)
  // -------------------------------------------------------------
  return (
    <mesh ref={canvasRef}>
      <meshBasicMaterial
        ref={canvasMatRef}
        color="#ffffff"
        opacity={1}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
