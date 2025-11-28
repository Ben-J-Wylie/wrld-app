import { Stage } from "@/components/containers/SceneCore/Stage/Stage";
import { TextPlane } from "@/components/containers/SceneObjects/Geometry/TextPlane";
import { ImagePlane } from "@/components/containers/SceneObjects/Geometry/ImagePlane";
import { Group } from "@/components/CoreScene/Layers/Group";

import Image from "./Image.svg";

export default function DefaultScene() {
  return (
    <Stage
      backdrop={{
        presetSizes: {
          mobile: { width: 750, height: 1920 },
          tablet: { width: 1024, height: 1024 },
          desktop: { width: 1920, height: 1080 },
        },
        position: [0, 0, 0],
      }}
    >
      <Group position={[0, 0, 100]}>
        <TextPlane
          /* --------------------------
           *  TEXT SETTINGS
           * -------------------------- */
          text="WRLD"
          fontSize={200}
          fontFamily="Inter"
          color="#ffffff"
          background={null}
          padding={32}
          /* --------------------------
           *  RESPONSIVE SIZING (optional)
           *  If omitted → auto-sizes based on canvas
           * -------------------------- */
          width={{
            mobile: 500,
            tablet: 500,
            desktop: 500,
          }}
          height={{
            mobile: 500,
            tablet: 500,
            desktop: 500,
          }}
          // -------------------------------
          // RESPONSIVE POSITION
          // -------------------------------
          position={{
            mobile: [0, 0, 0],
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          // -------------------------------
          // RESPONSIVE ROTATION
          // -------------------------------
          rotation={{
            mobile: [0, 0, 0],
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          /* Add Z offset (on top of responsive position.z) */
          z={1}
          /* --------------------------
           *  SHADOWS
           * -------------------------- */
          castShadow={true}
          receiveShadow={false}
          /* --------------------------
           *  INTERACTION
           * -------------------------- */
          onClick={(e, hit) => {
            console.log("Text clicked:", hit);
          }}
          onHover={(e, hit) => {
            console.log("Hover:", hit ? "enter" : "leave");
          }}
        />
        <ImagePlane
          // -------------------------------
          // TEXTURE / COLOR
          // -------------------------------
          src={Image}
          color="#ffffff"
          // -------------------------------
          // RESPONSIVE DIMENSIONS
          // -------------------------------
          width={{
            mobile: 500,
            tablet: 500,
            desktop: 500,
          }}
          height={{
            mobile: 500,
            tablet: 500,
            desktop: 500,
          }}
          // -------------------------------
          // RESPONSIVE POSITION
          // -------------------------------
          position={{
            mobile: [0, 0, 0],
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          // -------------------------------
          // RESPONSIVE ROTATION
          // -------------------------------
          rotation={{
            mobile: [0, 0, 0],
            tablet: [0, 0, 0],
            desktop: [0, 0, 0],
          }}
          // -------------------------------
          // Z-OFFSET (applied AFTER position)
          // -------------------------------
          z={0}
          // -------------------------------
          // SHADOW CONTROLS
          // -------------------------------
          castShadow={true} // native mesh.castShadow
          receiveShadow={true} // enables custom shadow pipeline
          // -------------------------------
          // INTERACTION
          // -------------------------------
          onClick={(e, hit) => {
            console.log("ImagePlane clicked", hit);
          }}
          onHover={(e, hit) => {
            if (hit) console.log("hover in");
            else console.log("hover out");
          }}
        />
      </Group>
    </Stage>
  );
}
