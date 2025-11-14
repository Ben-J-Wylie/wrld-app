// src/App.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeEngine } from "@/components/containers/SceneCore/engine";
import { createBackgroundPlane } from "@/components/containers/SceneCore/Layers/BackgroundPlane";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create engine
    const engine = new ThreeEngine(canvasRef.current);

    // Background plane (image or color)
    const bg = createBackgroundPlane({
      // src: background, // <- if you have an imported PNG/JPG
      depth: -4, // sits behind box + ground
    });
    engine.scene.add(bg);

    //
    // TEMP TEST OBJECTS
    //
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "hotpink" })
    );
    box.castShadow = true;
    box.position.set(0, 0.5, 0);
    engine.scene.add(box);

    // Ground plane for shadows
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: "hotpink" })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    engine.scene.add(ground);

    // Start the engine
    engine.start();

    return () => engine.stop();
  }, []);

  // console.log("Scene children:", engine.scene.children);
  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100vw",
        height: "100vh",
        display: "block",
      }}
    />
  );
}
