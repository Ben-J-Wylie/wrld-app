import React, { useRef, useEffect } from "react";
import * as THREE from "three";

export default function Scene() {
  const dirLight = useRef<THREE.DirectionalLight>(null!);

  useEffect(() => {
    if (dirLight.current) {
      // helpful to visualize the light’s shadow frustum:
      const helper = new THREE.CameraHelper(dirLight.current.shadow.camera);
      dirLight.current.parent?.add(helper);
    }
  }, []);

  return (
    <>
      {/* === LIGHTS === */}
      <ambientLight intensity={0.3} />

      <directionalLight
        ref={dirLight}
        position={[3, 5, 2]} // high and slightly behind camera
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
      />

      {/* === GEOMETRY === */}
      {/* ground plane */}
      <mesh
        rotation-x={-Math.PI / 2} // lie flat on XZ plane
        receiveShadow
        position={[0, 0, 0]}
      >
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* red card hovering above ground */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 0.05]} /> {/* thin box instead of 2D plane */}
        <meshStandardMaterial color="#ff4444" />
      </mesh>
    </>
  );
}
