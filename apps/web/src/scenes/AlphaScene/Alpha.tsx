// src/pages/Alpha.tsx
import * as Scene from "@/components/containers/SceneCore";
import { AlphaScene } from "@/scenes/AlphaScene/AlphaScene";

export default function Alpha() {
  return (
    <Scene.Stage>
      <Scene.ScrollController />
      <AlphaScene />
    </Scene.Stage>
  );
}
