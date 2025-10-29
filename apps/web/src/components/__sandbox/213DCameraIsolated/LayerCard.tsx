import React, { useMemo } from "react";
import * as THREE from "three";

type Props = {
  depth: number; // layer index: bigger => farther back (more negative Z)
  size: [number, number]; // width, height in world units (viewport-based)
  color?: string;
  center?: [number, number]; // x, y center (defaults to 0,0)
};

export default function LayerCard({
  depth,
  size,
  color = "#222",
  center = [0, 0],
}: Props) {
  const [w, h] = size;
  const [cx, cy] = center;

  // Rounded rectangle path
  const shape = useMemo(() => {
    const r = Math.min(w, h) * 0.08;
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

  // Give the card a hair of thickness so it shades nicely
  const extrude = useMemo<THREE.ExtrudeGeometry>(() => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.01,
      bevelEnabled: false,
      steps: 1,
    });
    geo.computeVertexNormals();
    return geo;
  }, [shape]);

  return (
    <mesh
      position={[cx, cy, -depth]} // larger depth => more negative Z (farther back)
      castShadow
      receiveShadow
    >
      {/* Z is along the "thickness" direction for extrude */}
      <primitive object={extrude} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.05}
        envMapIntensity={0.3}
      />
      {/* Subtle rim highlight as an inset plane on the front face */}
      <mesh position={[0, 0, 0.011]} receiveShadow={false} castShadow={false}>
        <planeGeometry args={[w * 0.98, h * 0.98]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
      </mesh>
    </mesh>
  );
}
