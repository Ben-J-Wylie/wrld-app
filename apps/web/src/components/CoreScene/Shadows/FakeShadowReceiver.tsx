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

  // This is the duplicate mesh in the main scene that will show the composite shadow
  const canvasRef = useRef<THREE.Mesh>(null!);

  // Offscreen render target + scene + camera
  const rtRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const rtSceneRef = useRef<THREE.Scene | null>(null);
  const rtCameraRef = useRef<THREE.OrthographicCamera | null>(null);

  // Simple debug quad inside the offscreen scene (just to prove it's working)
  const debugQuadRef = useRef<THREE.Mesh | null>(null);

  // Material on the canvas mesh (we'll assign the RT texture as its map)
  const canvasMatRef = useRef<THREE.MeshBasicMaterial>(null!);

  // Create RT / scene / camera once and register receiver (with RT info)
  useEffect(() => {
    // --- Create render target ---
    const rt = new THREE.WebGLRenderTarget(512, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    rt.texture.name = `ReceiverShadowRT_${id}`;

    // --- Create offscreen scene ---
    const rtScene = new THREE.Scene();
    rtScene.background = new THREE.Color(0x000000);

    // --- Ortho camera in "shadow atlas" space (-0.5..0.5) ---
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    cam.position.set(0, 0, 1);
    cam.lookAt(0, 0, 0);
    rtScene.add(cam);

    // --- Add a simple debug quad so we SEE something in the RT ---
    const quadGeom = new THREE.PlaneGeometry(1, 1);
    const quadMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const quad = new THREE.Mesh(quadGeom, quadMat);
    rtScene.add(quad);

    rtRef.current = rt;
    rtSceneRef.current = rtScene;
    rtCameraRef.current = cam;
    debugQuadRef.current = quad;

    // Hook RT texture into the canvas material
    if (canvasMatRef.current) {
      canvasMatRef.current.map = rt.texture;
      canvasMatRef.current.needsUpdate = true;
      canvasMatRef.current.transparent = true;
    }

    // Register receiver with RT info
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

      // Cleanup
      rt.dispose();
      quadGeom.dispose();
      quadMat.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, meshRef, alphaMap, gl, registerReceiver, unregisterReceiver]);

  // Clone the receiver geometry once it exists
  useEffect(() => {
    const receiverMesh = meshRef.current;
    const canvasMesh = canvasRef.current;
    if (!receiverMesh || !canvasMesh) return;

    // Clone geometry (important!)
    canvasMesh.geometry = receiverMesh.geometry.clone();
  }, [meshRef]);

  // Sync transform for the canvas mesh with the receiver mesh
  useFrame(() => {
    const mesh = meshRef.current;
    const canvas = canvasRef.current;
    if (!mesh || !canvas) return;

    mesh.updateWorldMatrix(true, false);

    // Copy world position
    canvas.position.setFromMatrixPosition(mesh.matrixWorld);

    // Copy rotation
    canvas.quaternion.setFromRotationMatrix(mesh.matrixWorld);

    // Copy scale
    canvas.scale.copy(mesh.scale);

    // Slight offset along normal so it sits just above the receiver
    const normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(canvas.quaternion)
      .multiplyScalar(0.002);

    canvas.position.add(normal);
  });

  // Render the offscreen scene into the RT each frame
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
