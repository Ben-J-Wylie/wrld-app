import { Stage } from "../../containers/SceneCore/Stage/Stage";
import { TextPlane } from "../../containers/SceneObjects/Geometry/TextPlane";
import { ImagePlane } from "../../containers/SceneObjects/Geometry/ImagePlane";
import { Group } from "../../containers/SceneCore/Layers/Group";
import { ScreenGroup } from "../../containers/SceneCore/Layers/ScreenGroup";
import { useWrldTheme } from "../../containers/SceneCore/Theme/WrldThemeProvider";

import Logo from "./Logo.svg";

export default function LogoElement() {
  const theme = useWrldTheme();
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
      <ScreenGroup z={500} anchorX="right" anchorY="top">
        <ImagePlane />
      </ScreenGroup>
      <Group position={[0, 0, 20]}>
        <TextPlane
          /* --------------------------
           *  TEXT SETTINGS
           * -------------------------- */
          text="WRLD"
          fontSize={200}
          fontFamily="Inter"
          color={theme.colors.text}
          background={null}
          padding={32}
          /* --------------------------
           *  RESPONSIVE SIZING (optional)
           *  If omitted → auto-sizes based on canvas
           * -------------------------- */
          width={{
            mobile: 50,
            tablet: 50,
            desktop: 50,
          }}
          height={{
            mobile: 50,
            tablet: 50,
            desktop: 50,
          }}
          // -------------------------------
          // RESPONSIVE POSITION
          // -------------------------------
          position={{
            mobile: [0, 0, 0],
            tablet: [0, 0, 100],
            desktop: [0, 0, 200],
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
          receiveShadow={true}
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
          src={Logo}
          color="#ffffff"
          // -------------------------------
          // RESPONSIVE DIMENSIONS
          // -------------------------------
          width={{
            mobile: 100,
            tablet: 100,
            desktop: 100,
          }}
          height={{
            mobile: 100,
            tablet: 100,
            desktop: 100,
          }}
          // -------------------------------
          // RESPONSIVE POSITION
          // -------------------------------
          position={{
            mobile: [0, 0, 200],
            tablet: [0, 0, 100],
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
          z={1}
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
