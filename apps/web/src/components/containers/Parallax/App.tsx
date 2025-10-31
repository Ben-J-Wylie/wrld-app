// @ts-nocheck

import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import SceneLayout from "./components/containers/Parallax/SceneLayout";

export default function App() {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",

        overflow: "scroll", // enable vertical scroll
      }}
    >
      <ParallaxLight>
        <ParallaxScene>
          <SceneLayout />
        </ParallaxScene>
      </ParallaxLight>
    </div>
  );
}
