import { Stage } from "../../containers/SceneCore/Stage/Stage";
import { ImagePlane } from "../../containers/SceneObjects/Geometry/ImagePlane";
import { useWrldTheme } from "../../containers/SceneCore/Theme/WrldThemeProvider";

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
              fontSize: "20px",
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
    </Stage>
  );
}
