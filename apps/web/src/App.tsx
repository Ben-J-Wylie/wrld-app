// ✅ Pull in everything exported from "@/Scene" under one object called "Scene"
import * as Scene from "@/Scene/index";

console.log("Scene exports:", Scene);

export default function App() {
  return (
    <Scene.Stage>
      {/* 🧭 Normalized scroll input across devices */}
      <Scene.ScrollController />

      {/* 🌈 Main world composition */}
      <Scene.DemoScene />

      {/* 👁 Optional debug PiP overlay */}
      {/* {Scene.SceneConfig.debug.enabled && (
        <Scene.CameraOverlay
          stageScene={null as any}
          stageCamera={null as any}
        />
      )} */}
    </Scene.Stage>
  );
}
