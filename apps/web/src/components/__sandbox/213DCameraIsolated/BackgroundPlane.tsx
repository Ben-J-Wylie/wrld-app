import React from "react";

export default function BackgroundPlane({
  width,
  height,
  z = -2,
  color = "#121212",
}: {
  width: number;
  height: number;
  z?: number;
  color?: string;
}) {
  return (
    <mesh position={[0, 0, z]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.0} />
    </mesh>
  );
}
