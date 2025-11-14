// src/scenes/shapes.tsx
import React from "react";
import * as THREE from "three";
import { ThreeElements } from "@react-three/fiber";

type MeshProps = ThreeElements["mesh"];

function PlaneShape({
  color,
  width = 10,
  height = 6,
  opacity = 1,
  ...rest
}: MeshProps & {
  color: string;
  width?: number;
  height?: number;
  opacity?: number;
}) {
  return (
    <mesh castShadow receiveShadow {...rest}>
      <planeGeometry args={[width, height]} />

      <meshPhongMaterial
        color={color}
        transparent
        opacity={opacity}
        shininess={0} // similar "gloss depth" to roughness≈0.8
        specular={new THREE.Color(0xffffff)} // highlight color
        side={THREE.DoubleSide}
        shadowSide={THREE.FrontSide}
      />
    </mesh>
  );
}

// === Layered placeholders ===

export function LayerBackShape(props: MeshProps) {
  return <PlaneShape color="#224488" width={30} height={20} {...props} />;
}

export function LayerMid2Shape(props: MeshProps) {
  return <PlaneShape color="#336699" width={25} height={15} {...props} />;
}

export function LayerMid1Shape(props: MeshProps) {
  return <PlaneShape color="#4499aa" width={20} height={10} {...props} />;
}

export function LayerFrontShape(props: MeshProps) {
  return <PlaneShape color="#55bbcc" width={15} height={5} {...props} />;
}

export function UiGlassShape(props: MeshProps) {
  return (
    <PlaneShape
      color="#ffffff"
      width={10}
      height={3}
      opacity={0.35}
      {...props}
    />
  );
}
