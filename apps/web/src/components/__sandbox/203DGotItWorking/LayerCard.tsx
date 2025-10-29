// components/LayerCard.tsx
import React, { useMemo } from "react";
import * as THREE from "three";

type Props = {
  depth: number; // logical z-layer (bigger => farther “back” in -Z)
  size: [number, number];
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
};

export default function LayerCard({
  depth,
  size,
  color = "#222",
  position = [0, 0, -depth],
  rotation = [0, 0, 0],
}: Props) {
  const [w, h] = size;

  // Rounded-rect shape for clean UI card silhouette
  const shape = useMemo(() => {
    const r = Math.min(w, h) * 0.08; // corner radius
    const s = new THREE.Shape();
    const hw = w / 2;
    const hh = h / 2;
    s.moveTo(-hw + r, -hh);
    s.lineTo(hw - r, -hh);
    s.quadraticCurveTo(hw, -hh, hw, -hh + r);
    s.lineTo(hw, hh - r);
    s.quadraticCurveTo(hw, hh, hw - r, hh);
    s.lineTo(-hw + r, hh);
    s.quadraticCurveTo(-hw, hh, -hw, hh - r);
    s.lineTo(-hw, -hh + r);
    s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    return s;
  }, [w, h]);

  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
      // Slightly tilt cards if you want more dimensionality:
      // rotation={[THREE.MathUtils.degToRad(-2), 0, rotation[2]]}
    >
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.05}
        envMapIntensity={0.3}
      />
      {/* Subtle rim highlight (inset plane) */}
      <mesh position={[0, 0, 0.001]} receiveShadow={false} castShadow={false}>
        <planeGeometry args={[w * 0.98, h * 0.98]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
      </mesh>
    </mesh>
  );
}
