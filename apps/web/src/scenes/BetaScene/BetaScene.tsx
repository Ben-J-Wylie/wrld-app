import { Stage } from "@/components/containers/SceneCore/Stage/Stage";
import { Cube } from "@/components/containers/SceneObjects/Geometry/Cube";
import { Sphere } from "@/components/containers/SceneObjects/Geometry/Sphere";
import { ImagePlane } from "@/components/containers/SceneObjects/Geometry/ImagePlane";
import { Group } from "@/components/containers/SceneCore/Layers/Group";

import banner from "./banner.png";

export default function HomePage() {
  return (
    <Stage
      backdrop={{
        presetSizes: {
          mobile: { width: 50, height: 150 },
          tablet: { width: 75, height: 75 },
          desktop: { width: 150, height: 50 },
        },
        position: [0, 0, 0],
      }}
    >
      {/* <Group position={[5, -10, 0]}>
        <Cube size={[10, 10, 10]} position={[0, 0, 50]} color="orange" />
      </Group>

      <Group position={[-3, 3, 0]}>
        <Sphere radius={10} position={[0, -10, 20]} color="hotpink" />
      </Group> */}

      <Group position={[0, 0, 0.5]}>
        <ImagePlane
          // -------------------------------
          // TEXTURE / COLOR
          // -------------------------------
          src=""
          color="#9e1010ff"
          // -------------------------------
          // RESPONSIVE DIMENSIONS
          // -------------------------------
          width={{
            mobile: 20,
            tablet: 5,
            desktop: 50,
          }}
          height={{
            mobile: 18,
            tablet: 10,
            desktop: 5,
          }}
          // -------------------------------
          // RESPONSIVE POSITION
          // -------------------------------
          position={{
            mobile: [0, -2, 0],
            tablet: [0, -1, 0],
            desktop: [0, 0, 0],
          }}
          // -------------------------------
          // RESPONSIVE ROTATION
          // -------------------------------
          rotation={{
            mobile: [0, 0, 0],
            tablet: [0, 45, 0],
            desktop: [0, 30, 0],
          }}
          // -------------------------------
          // Z-OFFSET (applied AFTER position)
          // -------------------------------
          z={1.5}
          // -------------------------------
          // SHADOW CONTROLS
          // -------------------------------
          castShadow={true} // native mesh.castShadow
          receiveShadow={true} // enables custom shadow pipeline
          shadowRadius={2.5} // PCF disk radius
          shadowSamples={8} // # of poisson taps
          shadowFade={0.25} // exponential falloff
          shadowDistanceFactor={1.2} // scale depth-distance sensitivity
          shadowLightSize={1.0} // penumbra softness factor
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
          // -------------------------------
          // INTERNAL PARENT OVERRIDE
          // (used when nested inside <Group>)
          // -------------------------------
          __parent={null}
        />
      </Group>
    </Stage>
  );
}
