import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeEngine } from "@/components/containers/SceneCore/Engine/Engine";

export function VanillaScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const engine = new ThreeEngine(ref.current);

    // test geometry
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: "hotpink" });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    engine.scene.add(mesh);

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: "hotpink" })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    engine.scene.add(ground);

    engine.start();

    return () => engine.stop();
  }, []);

  return <canvas ref={ref} style={{ width: "100%", height: "100vh" }} />;
}
