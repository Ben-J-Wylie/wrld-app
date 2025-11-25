// Toggle3D.tsx
import React, { useState, useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

// Import PNGs directly
import T_Off from "./T_Off.png";
import T_Cued from "./T_Cued.png";
import T_On from "./T_On.png";

export type Toggle3DState = "off" | "cued" | "on";

interface Toggle3DProps {
  width?: number;
  height?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  onChange?: (state: Toggle3DState) => void;
}

export function Toggle3D({
  width = 400,
  height = 100,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  onChange,
}: Toggle3DProps) {
  // -----------------------------
  // Load textures once
  // -----------------------------
  const [texOff, texCued, texOn] = useLoader(TextureLoader, [
    T_Off,
    T_Cued,
    T_On,
  ]);

  // Configure texture color space and orientation
  [texOff, texCued, texOn].forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = true;
  });

  // -----------------------------
  // Internal 3-state toggle state
  // -----------------------------
  const [state, setState] = useState<Toggle3DState>("off");

  function nextState(s: Toggle3DState): Toggle3DState {
    if (s === "off") return "cued";
    if (s === "cued") return "on";
    return "off";
  }

  const handleClick = () => {
    const newState = nextState(state);
    setState(newState);
    onChange?.(newState);
  };

  const currentTexture = useMemo(() => {
    switch (state) {
      case "cued":
        return texCued;
      case "on":
        return texOn;
      default:
        return texOff;
    }
  }, [state, texOff, texCued, texOn]);

  return (
    <mesh
      position={position}
      rotation={rotation}
      onPointerDown={handleClick}
      castShadow
      receiveShadow
    >
      <planeGeometry args={[width, height]} />

      <meshStandardMaterial
        // SHADOW-FRIENDLY ALPHA SETUP
        map={currentTexture}
        alphaTest={0.3} // discard low-alpha pixels (cutout)
        transparent={false} // keep in opaque pass → can cast shadows
        depthWrite={true} // needed for shadow map participation
        depthTest={true}
        toneMapped={true}
        side={THREE.DoubleSide} // so it works from both sides if needed
      />
    </mesh>
  );
}
