import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useSceneStore } from "./components/containers/SceneCore/Store/SceneStore";

import { OrbitControls } from "three-stdlib";

// Cameras
import { createSceneCamera } from "./components/containers/SceneCore/Cameras/SceneCamera";
import { createOrbitCamera } from "./components/containers/SceneCore/Cameras/OrbitCamera";

// Objects
import { initializeBackdrop } from "./components/containers/SceneCore/Layers/Backdrop";
import { createSphere } from "./components/containers/SceneCore/Layers/Sphere";
import { createImagePlane } from "./components/containers/SceneCore/Layers/ImagePlane";

// Lights
import { createAmbientLight } from "./components/containers/SceneCore/Lights/AmbientLight";
import { createDirectionalLight } from "./components/containers/SceneCore/Lights/DirectionalLight";

import banner from "./banner.png";

// ...same imports...

export default function WrldBasicScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const updateSceneCameraRef = useRef<(() => void) | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // -------------------------------------------------------
    // INIT
    // -------------------------------------------------------
    const init = () => {
      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.domElement.style.pointerEvents = "auto";
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;

      rendererRef.current = renderer;
      containerRef.current!.appendChild(renderer.domElement);

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202020);
      sceneRef.current = scene;

      // Cameras
      const {
        camera: sceneCamera,
        helper: sceneCameraHelper,
        updateSmooth: updateSceneCamera,
      } = createSceneCamera(renderer);

      scene.add(sceneCamera, sceneCameraHelper);
      sceneCameraRef.current = sceneCamera;
      updateSceneCameraRef.current = updateSceneCamera;

      const {
        camera: orbitCamera,
        controls,
        helper: orbitCameraHelper,
      } = createOrbitCamera(renderer, width, height);

      scene.add(orbitCamera, orbitCameraHelper);
      orbitCameraRef.current = orbitCamera;
      controlsRef.current = controls;

      cameraRef.current = sceneCamera;

      // Toggle cameras on “C”
      window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "c") {
          cameraRef.current =
            cameraRef.current === sceneCameraRef.current
              ? orbitCameraRef.current
              : sceneCameraRef.current;
        }
      });

      // Lights
      scene.add(createAmbientLight());
      scene.add(createDirectionalLight());

      // ----------------------------------
      // BACKDROP (FIXED: call correctly)
      // ----------------------------------
      const backdrop = initializeBackdrop(scene, {
        mobile: { width: 50, height: 100 },
        tablet: { width: 75, height: 75 },
        desktop: { width: 100, height: 50 },
      });
      backdrop.position.set(0, 0, 0);

      // Objects
      scene.add(
        createImagePlane({
          src: "./banner.png",
          width: 4,
          height: 2.5,
          position: [-2, 1, 2],
        })
      );

      scene.add(
        createImagePlane({
          src: "/textures/pic1.png",
          width: 4,
          height: 2.5,
          position: [0, 0, 3],
        })
      );

      scene.add(
        createImagePlane({
          src: "/textures/pic1.png",
          width: 4,
          height: 2.5,
          position: [2, -1, 4],
        })
      );

      window.addEventListener("resize", onResize);
    };

    // -------------------------------------------------------
    // RESIZE
    // -------------------------------------------------------
    const onResize = () => {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!renderer || !camera) return;

      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      // FIX: allow SceneCamera to update dynamic FOV
      if (updateSceneCameraRef.current) {
        updateSceneCameraRef.current();
      }
    }; // 🔥 this brace was missing

    // -------------------------------------------------------
    // ANIMATION LOOP
    // -------------------------------------------------------
    const animate = () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      if (!renderer || !camera || !scene) return;

      frameIdRef.current = requestAnimationFrame(animate);

      if (updateSceneCameraRef.current) {
        updateSceneCameraRef.current();
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
    };

    init();
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameIdRef.current!);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    />
  );
}
