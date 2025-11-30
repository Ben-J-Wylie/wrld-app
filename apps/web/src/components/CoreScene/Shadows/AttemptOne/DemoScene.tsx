// DemoScene.tsx
import React from "react";

import { Stage } from "../../Stage";
import { Backdrop } from "../../Layers/Backdrop";
import { CameraPin } from "../../Layers/CameraPin";
import { Group } from "../../Layers/Group";
import { ImagePlane } from "../../Geometry/ImagePlane";
import { FakeShadowProvider } from "../Shadows/FakeShadowContext";

console.log("[FILE] DemoScene loaded");

const backdropSizes = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

export function DemoScene() {
  console.log("[RENDER] DemoScene render");
  return (
    <FakeShadowProvider>
      <Stage backdrop={backdropSizes}>
        <CameraPin
          name="MyCameraPin"
          anchorX="center"
          anchorY="top"
          anchorZ={900}
          offsetX={0}
          offsetY={0}
          visible={true}
        >
          <ImagePlane
            name="FloatingImage"
            src="/textures/myImage.png"
            color="#ffffff"
            width={{ mobile: 100, tablet: 150, desktop: 200 }}
            height={{ mobile: 60, tablet: 90, desktop: 120 }}
            cornerRadius={{ mobile: 20, tablet: 30, desktop: 40 }}
            position={{
              mobile: [0, 0, 0],
              tablet: [0, 0, 0],
              desktop: [0, 0, 0],
            }}
            rotation={{
              mobile: [0, 0, 0],
              tablet: [0, 0, 0],
              desktop: [0, 0, 0],
            }}
            scale={{
              mobile: [1, 1, 1],
              tablet: [1, 1, 1],
              desktop: [1, 1, 1],
            }}
            z={0}
            castShadow={true}
            receiveShadow={true}
            castFakeShadow={true}
            receiveFakeShadow={true}
            visible={true}
          />
        </CameraPin>

        <Group
          name="SecondGroup"
          position={{
            mobile: [0, 0, 50],
            tablet: [0, 0, 50],
            desktop: [0, 0, 50],
          }}
          rotation={{
            mobile: [0, 0, 0],
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          scale={{
            mobile: [1, 1, 1],
            tablet: [1, 1, 1],
            desktop: [1, 1, 1],
          }}
          anchor={[0, 0, 0]}
          visible={true}
        >
          <ImagePlane
            name="GroundImage"
            src="/textures/myImage.png"
            color="#ffffff"
            width={{ mobile: 100, tablet: 150, desktop: 200 }}
            height={{ mobile: 60, tablet: 90, desktop: 120 }}
            cornerRadius={{ mobile: 20, tablet: 30, desktop: 40 }}
            position={{
              mobile: [0, 0, 0],
              tablet: [0, 0, 0],
              desktop: [0, 0, 0],
            }}
            rotation={{
              mobile: [0, 0, 0],
              tablet: [0, 0, 0],
              desktop: [0, 0, 0],
            }}
            scale={{
              mobile: [1, 1, 1],
              tablet: [1, 1, 1],
              desktop: [1, 1, 1],
            }}
            z={0}
            castShadow={false}
            receiveShadow={false}
            castFakeShadow={true}
            receiveFakeShadow={true}
            visible={true}
          />
          <ImagePlane
            name="GroundImage"
            src="/textures/myImage.png"
            color="#ffffff"
            width={{ mobile: 100, tablet: 150, desktop: 200 }}
            height={{ mobile: 60, tablet: 90, desktop: 120 }}
            cornerRadius={{ mobile: 20, tablet: 30, desktop: 40 }}
            position={{
              mobile: [0, 10, 50],
              tablet: [0, 10, 50],
              desktop: [0, 10, 50],
            }}
            rotation={{
              mobile: [0, 0, 0],
              tablet: [0, 0, 0],
              desktop: [0, 0, 0],
            }}
            scale={{
              mobile: [1, 1, 1],
              tablet: [1, 1, 1],
              desktop: [1, 1, 1],
            }}
            z={0}
            castShadow={false}
            receiveShadow={false}
            castFakeShadow={true}
            receiveFakeShadow={true}
            visible={true}
          />
        </Group>

        <Backdrop />
      </Stage>
    </FakeShadowProvider>
  );
}
