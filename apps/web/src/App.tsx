import { useEffect, useRef } from "react";
import {
  Engine,
  Cameras,
  Controllers,
  Layers,
  SceneConfig,
  useSceneStore,
} from "./components/containers/SceneCore";
import { createDemoScene } from "./components/containers/SceneCore/DemoScene";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // --- Create engine ---
    const engine = new Engine.ThreeEngine(canvasRef.current);

    // --- Attach plugins ---
    Controllers.applyScrollController();
    Cameras.applyFitPerspectiveCamera(engine);
    Cameras.applyCameraRig(engine);

    // --- Add full demo scene ---
    const demo = createDemoScene();
    engine.scene.add(demo);

    engine.start();

    return () => engine.stop();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100vw", height: "100vh", display: "block" }}
    />
  );
}
