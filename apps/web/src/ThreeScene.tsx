import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useSceneStore } from "./components/containers/SceneCore/Store/SceneStore";

import { OrbitControls } from "three-stdlib";

// Cameras
import { createSceneCamera } from "./components/containers/SceneCore/Cameras/SceneCamera";
import { createOrbitCamera } from "./components/containers/SceneCore/Cameras/OrbitCamera";

// Objects
import {
  createBackdrop,
  resizeBackdrop,
} from "./components/containers/SceneCore/Layers/Backdrop";
import { createSphere } from "./components/containers/SceneCore/Layers/Sphere";
import { createImagePlane } from "./components/containers/SceneCore/Layers/ImagePlane";

// Lights
import { createAmbientLight } from "./components/containers/SceneCore/Lights/AmbientLight";
import { createDirectionalLight } from "./components/containers/SceneCore/Lights/DirectionalLight";

import banner from "./banner.png";

export default function WrldBasicScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // persistent refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Cameras
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null); // active camera

  // Controls
  const controlsRef = useRef<OrbitControls | null>(null);

  // Animation frame
  const frameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let backdropMesh: THREE.Mesh | null = null;

    // -------------------------------------------------------
    // INIT
    // -------------------------------------------------------
    const init = () => {
      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      // ----------------------------------
      // Renderer
      // ----------------------------------
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.domElement.style.pointerEvents = "auto";
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);

      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;
      renderer.shadowMap.autoUpdate = true;
      renderer.shadowMap.needsUpdate = true;

      rendererRef.current = renderer;
      containerRef.current!.appendChild(renderer.domElement);

      // ----------------------------------
      // Scene
      // ----------------------------------
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202020);
      sceneRef.current = scene;

      // ----------------------------------
      // CAMERAS
      // ----------------------------------

      // Scene Camera (main)
      const { camera: sceneCamera, helper: sceneCameraHelper } =
        createSceneCamera(renderer);
      scene.add(sceneCamera);
      scene.add(sceneCameraHelper);

      sceneCameraRef.current = sceneCamera;

      // Orbit Camera (secondary)
      const {
        camera: orbitCamera,
        controls,
        helper: orbitCameraHelper,
      } = createOrbitCamera(renderer, width, height);

      scene.add(orbitCamera);
      scene.add(orbitCameraHelper);

      orbitCameraRef.current = orbitCamera;
      controlsRef.current = controls;

      // Active camera defaults to the SceneCamera
      cameraRef.current = sceneCamera;

      // ----------------------------------
      // CAMERA SWITCH (press C)
      // ----------------------------------
      window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "c") {
          const current = cameraRef.current;
          const sceneCam = sceneCameraRef.current;
          const orbitCam = orbitCameraRef.current;

          if (!sceneCam || !orbitCam) return;

          if (current === sceneCam) {
            cameraRef.current = orbitCam;
            console.log("Switched to OrbitCamera");
          } else {
            cameraRef.current = sceneCam;
            console.log("Switched to SceneCamera");
          }
        }
      });

      // ----------------------------------
      // LIGHTS
      // ----------------------------------
      scene.add(createAmbientLight());
      scene.add(createDirectionalLight());

      // ----------------------------------
      // BACKDROP
      // ----------------------------------

      // 1. Update the SceneStore with this scene’s dimensions
      useSceneStore.getState().setSceneWidth(60);
      useSceneStore.getState().setSceneHeight(100);

      const store = useSceneStore.getState();

      // 2. Create the initial backdrop using store dimensions
      backdropMesh = createBackdrop({
        width: store.sceneWidth,
        height: store.sceneHeight,
      });
      scene.add(backdropMesh);

      // 3. Subscribe to store changes → resize backdrop
      useSceneStore.subscribe((state, prev) => {
        if (
          state.sceneWidth !== prev.sceneWidth ||
          state.sceneHeight !== prev.sceneHeight
        ) {
          if (backdropMesh) {
            resizeBackdrop(backdropMesh, state.sceneWidth, state.sceneHeight);
          }
        }
      });
      // ----------------------------------
      // OBJECTS
      // ----------------------------------

      const plane1 = createImagePlane({
        src: "./banner.png",
        width: 4,
        height: 2.5,
        position: [-2, 1, 2],
      });
      scene.add(plane1);

      const plane2 = createImagePlane({
        src: "/textures/pic1.png",
        width: 4,
        height: 2.5,
        position: [0, 0, 3],
      });
      scene.add(plane2);

      const plane3 = createImagePlane({
        src: "/textures/pic1.png",
        width: 4,
        height: 2.5,
        position: [2, -1, 4],
      });
      scene.add(plane3);

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
    };

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

      if (controls) controls.update();
      renderer.render(scene, camera);
    };

    init();
    animate();

    return () => cancelAnimationFrame(frameIdRef.current!);
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
