import { BackgroundPlane } from "../Parallax/BackgroundPlane";
import { ParallaxGroup } from "../Parallax/ParallaxGroup";
import {
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";
import "./test.css";
import background from "./32.png"; // your image

export default function ExampleScene() {
  return (
    <>
      <BackgroundPlane src={background} depth={0} />

      <ParallaxGroup depth={0.1}>
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
