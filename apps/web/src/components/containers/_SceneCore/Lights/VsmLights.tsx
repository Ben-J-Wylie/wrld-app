import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

//
// EXACT VSM LIGHT SETUP FROM THE OFFICIAL TORUS KNOT EXAMPLE
// Adapted cleanly for R3F + your SceneCore architecture
//
export function VsmLights() {
  const { scene } = useThree();

  const dirLightRef = useRef<THREE.DirectionalLight>(null!);
  const dirTargetRef = useRef(new THREE.Object3D());

  const spotLightRef = useRef<THREE.SpotLight>(null!);
  const spotTargetRef = useRef(new THREE.Object3D());

  useEffect(() => {
    if (!scene.children.includes(dirTargetRef.current))
      scene.add(dirTargetRef.current);
    if (!scene.children.includes(spotTargetRef.current))
      scene.add(spotTargetRef.current);

    //
    // DIRECTIONAL LIGHT — Blue key light
    //
    const dirLight = dirLightRef.current;
    const dirTarget = dirTargetRef.current;

    dirLight.color.set(0x8888ff);
    dirLight.intensity = 3; // FIXED
    dirLight.position.set(0, 5, 12); // FIXED (front-lighting vertical plane)
    dirTarget.position.set(0, 0, 0);
    dirLight.target = dirTarget;

    dirLight.castShadow = true;
    dirLight.shadow.bias = -0.0005;

    dirLight.shadow.radius = 4; // FIXED
    (dirLight.shadow as any).blurSamples = 8; // FIXED

    dirLight.shadow.mapSize.set(512, 512);

    const dCam = dirLight.shadow.camera as THREE.OrthographicCamera;
    dCam.near = 1;
    dCam.far = 40;
    dCam.left = -10;
    dCam.right = 10;
    dCam.top = 10;
    dCam.bottom = -10;
    dCam.updateProjectionMatrix();

    //
    // SPOTLIGHT — Warm fill light
    //
    const spot = spotLightRef.current;
    const spotTarget = spotTargetRef.current;

    spot.color.set(0xff8888);
    spot.intensity = 200; // FIX scaled for vertical scene
    spot.angle = Math.PI / 5;
    spot.penumbra = 0.3;
    spot.position.set(5, 8, 14); // FIX real usable spotlight position
    spot.castShadow = true;

    spot.shadow.bias = -0.002;
    spot.shadow.radius = 4; // FIX
    (spot.shadow as any).blurSamples = 8; // FIX

    spot.shadow.mapSize.set(256, 256);
    spot.shadow.camera.near = 5;
    spot.shadow.camera.far = 60;

    spotTarget.position.set(0, 0, 0);
    spot.target = spotTarget;
  }, [scene]);

  return (
    <>
      <directionalLight ref={dirLightRef} castShadow />
      <primitive object={dirTargetRef.current} />

      <spotLight ref={spotLightRef} castShadow />
      <primitive object={spotTargetRef.current} />
    </>
  );
}
