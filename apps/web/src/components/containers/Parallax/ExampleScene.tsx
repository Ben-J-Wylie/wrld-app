// src/scenes/ExampleScene.tsx
import { ParallaxGroup } from "./ParallaxGroup";
import {
  LayerBackShape,
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";

export default function ExampleScene() {
  return (
    <>
      <ParallaxGroup depth={0}>
        <LayerBackShape />
      </ParallaxGroup>

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
