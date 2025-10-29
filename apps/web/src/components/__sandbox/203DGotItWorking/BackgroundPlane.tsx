// components/BackgroundPlane.tsx
import React from "react";

export default function BackgroundPlane({
  width,
  height,
  color = "#121212",
}: {
  width: number;
  height: number;
  color?: string;
}) {
  return (
    <mesh receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.0} />
    </mesh>
  );
}
