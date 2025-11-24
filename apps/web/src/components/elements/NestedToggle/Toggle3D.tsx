import React, { useState } from "react";
import * as THREE from "three";

import { ImagePlane } from "../../containers/SceneObjects/Geometry/ImagePlane";
import { Group } from "../../containers/SceneCore/Layers/Group";

import offPng from "./T_Off.png";
import onPng from "./T_On.png";
import cuedPng from "./T_Cued.png";

export type Toggle3DState = "off" | "on" | "cued";

interface Toggle3DProps {
  width?: number;
  height?: number;

  position?: [number, number, number];
  rotation?: [number, number, number];
  z?: number;

  onChange?: (state: Toggle3DState) => void;
  playSound?: (state: Toggle3DState) => void;
}

export function Toggle3D({
  width = 400,
  height = 100,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  z = 0,
  onChange,
  playSound,
}: Toggle3DProps) {
  const [state, setState] = useState<Toggle3DState>("off");

  // Pick correct texture based on state
  const src = state === "on" ? onPng : state === "cued" ? cuedPng : offPng;

  console.log(
    "%c[Toggle3D RENDER]",
    "color:#0ff;font-weight:bold",
    "state:",
    state,
    "src:",
    src
  );

  const handleClick = (e?: PointerEvent, hit?: THREE.Intersection) => {
    console.log(
      "%c[Toggle3D CLICK]",
      "color:#0f0;font-weight:bold",
      "event:",
      e,
      "hit:",
      hit
    );

    let next: Toggle3DState;

    if (state === "off") next = "on";
    else if (state === "on") next = "cued";
    else next = "off";

    console.log(
      "%c[Toggle3D NEXT STATE]",
      "color:#ff0;font-weight:bold",
      "from:",
      state,
      "to:",
      next
    );

    setState(next);
    onChange?.(next);
    playSound?.(next);
  };

  return (
    <Group position={position} rotation={rotation}>
      <ImagePlane
        src={src}
        width={width}
        height={height}
        z={z}
        castShadow={true}
        receiveShadow={true}
        onClick={handleClick}
        onHover={(e, hit) => {
          console.log(
            "%c[Toggle3D HOVER]",
            "color:#f0f;font-weight:bold",
            "hover hit:",
            hit
          );
        }}
      />
    </Group>
  );
}
