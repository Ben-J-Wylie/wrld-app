import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import BackgroundPlane from "./BackgroundPlane";
import LayerCard from "./LayerCard";
import Lights from "./Lights";

export default function Scene() {
  const { viewport } = useThree();
  const scroll = useScroll();
  const w = viewport.width;
  const h = viewport.height;

  const frontRef = useRef<THREE.Group>(null!);
  const midRef = useRef<THREE.Group>(null!);
  const backRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const t = scroll.offset;
    if (frontRef.current) frontRef.current.position.y = t * h * 0.6;
    if (midRef.current) midRef.current.position.y = t * h * 0.35;
    if (backRef.current) backRef.current.position.y = t * h * 0.15;
  });

  const frontSize: [number, number] = useMemo(
    () => [w * 0.55, h * 0.32],
    [w, h]
  );
  const midSize: [number, number] = useMemo(() => [w * 0.65, h * 0.38], [w, h]);
  const backSize: [number, number] = useMemo(() => [w * 0.8, h * 0.5], [w, h]);

  return (
    <>
      {/* === Global Lights === */}
      <Lights />

      {/* === Background === */}
      <BackgroundPlane width={w} height={h} z={0} />

      {/* === Layers === */}
      <group ref={backRef}>
        <LayerCard depth={-1} size={backSize} color="#171717" />
      </group>

      <group ref={midRef}>
        <LayerCard depth={-2} size={midSize} color="#1d1d1d" />
      </group>

      <group ref={frontRef}>
        <LayerCard depth={-3} size={frontSize} color="#242424" />
      </group>

      {/* === Test UI Chips === */}
      <mesh position={[-w * 0.12, h * 0.04, 1.6]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.14, h * 0.06, 0.02]} />
        <meshStandardMaterial
          color="#ff4444"
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[w * 0.1, -h * 0.02, 1.7]} castShadow receiveShadow>
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
