import React from "react";

export default function BackgroundPlane({
  width,
  height,
  z = 0,
  color = "#ffffffff",
}: {
  width: number;
  height: number;
  z?: number;
  color?: string;
}) {
  return (
    <mesh position={[0, 0, z]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
    </mesh>
  );
}
