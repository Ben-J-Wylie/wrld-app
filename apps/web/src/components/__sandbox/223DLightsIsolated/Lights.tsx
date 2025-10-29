import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SpotLight } from "@react-three/drei";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { ContactShadows } from "@react-three/drei";

/**
 * Lights.tsx
 * -------------------------------------------------------------------
 * Contains multiple light types (Directional, Spot, Point, RectArea)
 * all placed at the same position so you can toggle them on/off to compare.
 * The Directional and Spot lights share the same target (0, 0, 0).
 */
export default function Lights() {
  const dirLight = useRef<THREE.DirectionalLight>(null!);
  const spotLight = useRef<THREE.SpotLight>(null!);
  const pointLight = useRef<THREE.PointLight>(null!);
  const rectLight = useRef<THREE.RectAreaLight>(null!);

  const { viewport, scene } = useThree();
  const { width: w, height: h } = viewport;

  // Create a shared target object for both directional and spot lights
  const target = useRef<THREE.Object3D>(new THREE.Object3D());

  // Initialize RectAreaLight support
  useEffect(() => {
    RectAreaLightUniformsLib.init();
  }, []);

  // Configure shadows for lights that support them
  useEffect(() => {
    if (dirLight.current) {
      dirLight.current.castShadow = true;
      dirLight.current.shadow.mapSize.set(4096, 4096);
      dirLight.current.shadow.radius = 12;
      dirLight.current.shadow.bias = -0.0001;
    }
    if (pointLight.current) {
      pointLight.current.castShadow = true;
      pointLight.current.shadow.mapSize.set(2048, 2048);
      pointLight.current.shadow.bias = -0.0005;
    }

    // === Shared Target Setup ===
    const tgt = target.current;
    tgt.position.set(0, 0, 0);
    scene.add(tgt);

    if (dirLight.current) dirLight.current.target = tgt;
    if (spotLight.current) spotLight.current.target = tgt;

    return () => {
      scene.remove(tgt);
    };
  }, [scene]);

  return (
    <>
      {/* === Ambient Light (always on for basic fill) === */}
      <ambientLight intensity={0.3} color="#ffffff" />

      {/* === Directional Light === */}
      <directionalLight
        ref={dirLight}
        visible={false} // toggle here
        position={[4, 6, 6]}
        intensity={1.8}
        castShadow
        shadow-camera-left={-w}
        shadow-camera-right={w}
        shadow-camera-top={h}
        shadow-camera-bottom={-h}
        shadow-camera-near={0.1}
        shadow-camera-far={15}
      />

      {/* === Spot Light (shares target with directional light) === */}
      <SpotLight
        ref={spotLight}
        visible={true}
        position={[1, 10, 6]}
        angle={1} // 🔹 wider cone = softer, broader light
        penumbra={1.0} // 🔹 0–1 range; 1 = full softness at edge
        intensity={200} // 🔹 reduce from 200, softer tone range
        distance={20}
        color="#ffffff"
        castShadow
        shadow-bias={-0.0002}
        shadow-radius={20} // ✅ with VSMShadowMap, this blurs edges
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
      />

      {/* === Point Light === */}
      <pointLight
        ref={pointLight}
        visible={false}
        castShadow
        position={[4, 6, 6]}
        intensity={20} // high values blow out; this is strong but not nuclear
        distance={25}
        decay={2}
        color="#ffffff"
        shadow-mapSize-width={4096} // higher = smoother, less aliasing
        shadow-mapSize-height={4096}
        shadow-radius={50} // works only with VSMShadowMap
        shadow-bias={-0.0002}
      />

      {/* === RectArea Light === */}
      <rectAreaLight
        ref={rectLight}
        visible={false} // toggle here
        castShadow
        position={[4, 6, 6]}
        width={6}
        height={4}
        intensity={50}
        color="#ffffff"
        lookAt={[0, 0, 0]}
      />

      {/* === Contact Shadows (optional soft ground) === */}
      <ContactShadows
        position={[0, -1, 0]}
        opacity={0.4}
        scale={20}
        blur={0}
        far={20}
      />
    </>
  );
}
