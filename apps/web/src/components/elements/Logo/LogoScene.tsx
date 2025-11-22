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
      <ImagePlane
        domContent={
          <div
            style={{
              padding: "20px",
              background: "white",
              borderRadius: "12px",
              fontSize: "32px",
              border: "3px solid black",
            }}
          >
            Hello WRLD
          </div>
        }
        domPixelScale={0.01}
        position={[0, 0, 10]}
        z={5}
      />
      <ScreenGroup z={945} anchorX="center" offsetY={-50} anchorY="top">
        <ImagePlane width={1000} height={150} color={theme.colors.background} />
      </ScreenGroup>
      <Group position={[0, 0, 0]}>
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
            mobile: [0, 0, 10],
            tablet: [0, 0, 10],
            desktop: [0, 0, 10],
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
      </Group>
    </Stage>
  );
}
