import { Stage } from "@/components/containers/SceneCore/Stage/Stage";
import { Cube } from "@/components/containers/SceneCore/Layers/Cube";
import { Sphere } from "@/components/containers/SceneCore/Layers/Sphere";
import { ImagePlane } from "@/components/containers/SceneCore/Layers/ImagePlane";
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

      <Group position={[0, 0, 0]}>
        <ImagePlane src={banner} width={30} height={20} position={[0, 20, 8]} />
        <ImagePlane
          src={banner}
          width={30}
          height={20}
          position={[0, 20, 12]}
        />
        <ImagePlane
          src={banner}
          width={30}
          height={20}
          position={[0, 20, 16]}
        />
      </Group>
    </Stage>
  );
}
