// import { BackgroundPlane } from "../Parallax/BackgroundPlane";
// import { ParallaxGroup } from "../Parallax/ParallaxGroup";
// import { ParallaxConfig } from "../Parallax/ParallaxConfig";
// import {
//   LayerMid2Shape,
//   LayerMid1Shape,
//   LayerFrontShape,
//   UiGlassShape,
// } from "./Shapes";

// export default function ExampleScene() {
//   return (
//     <>
//       <BackgroundPlane height={15} depth={0} color="#6c6c6cff" />

//       <ParallaxGroup depth={1}>
//         <LayerMid2Shape />
//       </ParallaxGroup>

//       <ParallaxGroup depth={2}>
//         <LayerMid1Shape />
//       </ParallaxGroup>

//       <ParallaxGroup depth={3}>
//         <LayerFrontShape />
//       </ParallaxGroup>

//       <ParallaxGroup depth={3.2}>
//         <UiGlassShape />
//       </ParallaxGroup>
//     </>
//   );
// }

// src/scenes/ExampleScene.tsx
import { BackgroundPlane } from "../Parallax/BackgroundPlane";
import { ParallaxGroup } from "../Parallax/ParallaxGroup";
import {
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";

// 🆕 import your background image
import background from "./32.png"; // or .png

export default function ExampleScene() {
  return (
    <>
      {/* 🖼 Background image plane */}
      <BackgroundPlane src={background} height={15} depth={0} />

      <ParallaxGroup depth={1}>
        <LayerMid2Shape />
      </ParallaxGroup>

      <ParallaxGroup depth={2}>
        <LayerMid1Shape />
      </ParallaxGroup>

      <ParallaxGroup depth={3}>
        <LayerFrontShape />
      </ParallaxGroup>

      <ParallaxGroup depth={3.2}>
        <UiGlassShape />
      </ParallaxGroup>
    </>
  );
}
