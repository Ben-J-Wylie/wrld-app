import { BackgroundPlane } from "../Parallax/BackgroundPlane";
import { ParallaxGroup } from "../Parallax/ParallaxGroup";
import { ParallaxConfig } from "../Parallax/ParallaxConfig";
import {
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";

export default function ExampleScene() {
  return (
    <>
      <BackgroundPlane height={15} depth={0} color="#111" />

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
