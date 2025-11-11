import { useEffect } from "react";
import { useParallaxStore } from "../Parallax/ParallaxStore";
import { BackgroundPlane } from "../Parallax/BackgroundPlane";
import { ParallaxGroup } from "../Parallax/ParallaxGroup";
import {
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";
import "./test.css";
import background from "./32.png";

export default function ExampleScene() {
  const setWorldHeight = useParallaxStore((s) => s.setWorldHeight);

  useEffect(() => {
    // Define total "world" height (in same units as your depth)
    // Here, your furthest visible depth is around 3.2,
    // so worldHeight could reasonably be set to that or a bit larger.
    setWorldHeight(3.2);
  }, [setWorldHeight]);

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
