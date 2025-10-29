import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import BackgroundPlane from "./BackgroundPlane";
import LayerCard from "./LayerCard";

export default function Scene() {
  const dirLight = useRef<THREE.DirectionalLight>(null!);
  const { viewport } = useThree();
  const scroll = useScroll();

  const w = viewport.width;
  const h = viewport.height;

  // Light that comes slightly from the camera side (positive Z)
  // so shadows fall "back" onto deeper layers (more negative Z).
  useEffect(() => {
    if (dirLight.current) {
      const helper = new THREE.CameraHelper(dirLight.current.shadow.camera);
      dirLight.current.parent?.add(helper);
    }
  }, []);

  // Groups for parallax control
  const frontRef = useRef<THREE.Group>(null!);
  const midRef = useRef<THREE.Group>(null!);
  const backRef = useRef<THREE.Group>(null!);

  // Parallax on scroll: keep the scene centered; layers move at different factors.
  useFrame(() => {
    const t = scroll.offset; // 0..1
    // Move layers mostly along Y for a clean UI parallax feeling.
    // Smaller factor for deeper layers.
    if (frontRef.current) frontRef.current.position.y = t * h * 0.6;
    if (midRef.current) midRef.current.position.y = t * h * 0.35;
    if (backRef.current) backRef.current.position.y = t * h * 0.15;
  });

  // Card sizes relative to viewport
  const frontSize: [number, number] = useMemo(
    () => [w * 0.55, h * 0.32],
    [w, h]
  );
  const midSize: [number, number] = useMemo(() => [w * 0.65, h * 0.38], [w, h]);
  const backSize: [number, number] = useMemo(() => [w * 0.8, h * 0.5], [w, h]);

  return (
    <>
      {/* ===== Lights ===== */}
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={dirLight}
        position={[2.5, 3.5, 4]} // positive Z component is key
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-w / 2}
        shadow-camera-right={w / 2}
        shadow-camera-top={h / 2}
        shadow-camera-bottom={-h / 2}
        shadow-camera-near={0.1}
        shadow-camera-far={8}
      />

      {/* ===== Background fills viewport at a deeper Z ===== */}
      <BackgroundPlane width={w} height={h} z={-2} color="#111" />

      {/* ===== Layer stack (centered, flat, with correct shadowing) ===== */}
      {/* Back layer (deepest) */}
      <group ref={backRef}>
        <LayerCard depth={1.6} size={backSize} color="#171717" />
      </group>

      {/* Mid layer */}
      <group ref={midRef}>
        <LayerCard depth={1.0} size={midSize} color="#1d1d1d" />
      </group>

      {/* Front layer */}
      <group ref={frontRef}>
        <LayerCard depth={0.4} size={frontSize} color="#242424" />
      </group>

      {/* A couple of tiny “UI chips” on the front layer to show layered shadows */}
      <mesh position={[-w * 0.12, h * 0.04, -0.4]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.14, h * 0.06, 0.02]} />
        <meshStandardMaterial
          color="#ff4444"
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[w * 0.1, -h * 0.02, -0.4]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.18, h * 0.05, 0.02]} />
        <meshStandardMaterial
          color="#4a78ff"
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>
    </>
  );
}
