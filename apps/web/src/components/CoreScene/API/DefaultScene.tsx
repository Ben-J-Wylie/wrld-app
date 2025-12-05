// @ts-nocheck

// DefaultScene.tsx
import React from "react";

import { Stage } from "../../CoreScene/Stage";
import { Backdrop } from "../../CoreScene/Layers/Backdrop";
import { CameraPin } from "../../CoreScene/Layers/CameraPin";
import { Group } from "../../CoreScene/Layers/Group";

import { ImagePlane } from "../../CoreScene/Geometry/ImagePlane";

const backdropSizes = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

export function AppScene() {
  return (
    <Stage backdrop={backdropSizes}>
      <CameraPin
        name="MyCamerPin"
        // --- Non Frustum Anchored Transform ---
        // position={[0, 0, 0]}
        // rotation={[0, 0, 0]}
        // scale={[1, 1, 1]}
        // --- Frustum Anchors ---
        anchorX="center" // "left" | "center" | "right"
        anchorY="top" // "top" | "center" | "bottom"
        anchorZ={900} // distance from camera
        // --- Frustum Offsets ---
        offsetX={0}
        offsetY={0}
        // --- Optional Meta ---
        visible={true}
      >
        <ImagePlane
          name="MyImagePlane"
          // --- Source / Appearance ---
          src="/textures/myImage.png" // OR: texture={preloadedTexture}
          color="#ffffff" // used if no texture or multiply blend
          // --- Responsive Dimensions (world units) ---
          width={{
            mobile: 100,
            tablet: 150,
            desktop: 200,
          }}
          height={{
            mobile: 60,
            tablet: 90,
            desktop: 120,
          }}
          cornerRadius={{
            mobile: 20,
            tablet: 30,
            desktop: 40,
          }}
          // --- Responsive Transform (true 3D world space) ---
          position={{
            mobile: [0, 0, 0], // Vec3 → includes TRUE Z
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          rotation={{
            mobile: [0, 0, 0], // Vec3 in DEGREES
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          scale={{
            mobile: [1, 1, 1],
            tablet: [1, 1, 1],
            desktop: [1, 1, 1],
          }}
          // --- Render Layering ---
          z={0}
          // --- Shadows ---
          castShadow={true}
          receiveShadow={true} // renderOrder only — NOT world-space Z
          // --- Optional Meta ---
          visible={true}
          // --- Optional Interactivity ---
          onClick={(e, hit) => {
            console.log("clicked image plane", hit);
          }}
          onHover={(e, hit) => {
            console.log("hovering image plane", hit);
          }}
        />
        ;
      </CameraPin>

      <Group
        name="MyGroup"
        // --- Responsive Transform (world space) ---
        position={{
          mobile: [0, 0, 50], // Vec3 in world units
          tablet: [0, 0, 50],
          desktop: [0, 0, 50],
        }}
        rotation={{
          mobile: [0, 0, 0], // Vec3 in degrees
          tablet: [0, 0, 0],
          desktop: [0, 0, 0],
        }}
        scale={{
          mobile: [1, 1, 1],
          tablet: [1, 1, 1],
          desktop: [1, 1, 1],
        }}
        // --- Local Anchor (pivot offset) ---
        anchor={[0, 0, 0]} // normalized offset, e.g. [0.5, 0.5, 0]
        // --- Optional Meta ---
        visible={true}
      >
        <ImagePlane
          name="MyImagePlane"
          // --- Source / Appearance ---
          src="/textures/myImage.png" // OR: texture={preloadedTexture}
          color="#ffffff" // used if no texture or multiply blend
          // --- Responsive Dimensions (world units) ---
          width={{
            mobile: 100,
            tablet: 150,
            desktop: 200,
          }}
          height={{
            mobile: 60,
            tablet: 90,
            desktop: 120,
          }}
          cornerRadius={{
            mobile: 20,
            tablet: 30,
            desktop: 40,
          }}
          // --- Responsive Transform (true 3D world space) ---
          position={{
            mobile: [0, 0, 0], // Vec3 → includes TRUE Z
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          rotation={{
            mobile: [0, 0, 0], // Vec3 in DEGREES
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          scale={{
            mobile: [1, 1, 1],
            tablet: [1, 1, 1],
            desktop: [1, 1, 1],
          }}
          // --- Render Layering ---
          z={0}
          // --- Shadows ---
          castShadow={true}
          receiveShadow={true} // renderOrder only — NOT world-space Z
          // --- Optional Meta ---
          visible={true}
          // --- Optional Interactivity ---
          onClick={(e, hit) => {
            console.log("clicked image plane", hit);
          }}
          onHover={(e, hit) => {
            console.log("hovering image plane", hit);
          }}
        />
        ;
      </Group>

      <Backdrop />
    </Stage>
  );
}
