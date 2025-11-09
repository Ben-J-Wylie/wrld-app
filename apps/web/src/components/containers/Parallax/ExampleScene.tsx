// In simple terms:
// - A quick demo to show how to layer multiple groups at different depths.

// Controls:
// - Just assigns different depth values to various shapes.
// - Good reference for building custom scenes.

// src/scenes/ExampleScene.tsx
import { ParallaxGroup } from "./ParallaxGroup";
import { ParallaxConfig } from "./ParallaxConfig";
import {
  LayerBackShape,
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";

export default function ExampleScene() {
  const d = ParallaxConfig.layers.defaultDepth;

  return (
    <>
      <ParallaxGroup depth={d + 0}>
        <LayerBackShape />
      </ParallaxGroup>

      <ParallaxGroup depth={d + 1}>
        <LayerMid2Shape />
      </ParallaxGroup>

      <ParallaxGroup depth={d + 2}>
        <LayerMid1Shape />
      </ParallaxGroup>

      <ParallaxGroup depth={d + 3}>
        <LayerFrontShape />
      </ParallaxGroup>

      <ParallaxGroup depth={d + 3.2}>
        <UiGlassShape />
      </ParallaxGroup>
    </>
  );
}
