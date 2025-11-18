import { Stage } from "@/components/containers/SceneCore/Stage/Stage";
import { Cube } from "@/components/containers/SceneCore/Layers/Cube";
import { Sphere } from "@/components/containers/SceneCore/Layers/Sphere";
import { ImagePlane } from "@/components/containers/SceneCore/Layers/ImagePlane";
import { Group } from "@/components/containers/SceneCore/Layers/Group";

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
      <Group position={[5, -10, 0]}>
        <Cube size={[10, 10, 10]} position={[0, 0, 50]} color="orange" />
      </Group>

      <Group position={[-3, 3, 0]}>
        <Sphere radius={10} position={[0, -10, 20]} color="hotpink" />
      </Group>

      <Group position={[3, -1, 8]}>
        <ImagePlane src="/textures/pic1.png" width={5} height={4} />
      </Group>
    </Stage>
  );
}
