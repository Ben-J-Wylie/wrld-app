import { Stage } from "@/components/containers/SceneCore/Stage/Stage";

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
      // objects={[
      //   {
      //     type: "box",
      //     size: [2, 2, 2],
      //     position: [0, 0, 5],
      //     color: "orange",
      //   },
      //   {
      //     type: "sphere",
      //     radius: 1,
      //     widthSegments: 32,
      //     heightSegments: 32,
      //     position: [-3, 1, 6],
      //     color: "hotpink",
      //   },
      //   {
      //     type: "imagePlane",
      //     src: "/textures/pic1.png",
      //     width: 5,
      //     height: 4,
      //     position: [3, -1, 8],
      //   },
      // ]}
    />
  );
}
