import { useRef, useEffect } from "react";
import * as THREE from "three";

import { OrbitControls } from "three-stdlib";

import { createSceneCamera } from "./components/containers/SceneCore/Cameras/SceneCamera";
import { createCameraRig } from "./components/containers/SceneCore/Cameras/CameraRig";
import { createScrollController } from "./components/containers/SceneCore/Controllers/ScrollController";
import { createOrbitCamera } from "./components/containers/SceneCore/Cameras/OrbitCamera";

import { initializeBackdrop } from "./components/containers/SceneCore/Layers/Backdrop";
import { createImagePlane } from "./components/containers/SceneCore/Layers/ImagePlane";

import { createAmbientLight } from "./components/containers/SceneCore/Lights/AmbientLight";
import { createDirectionalLight } from "./components/containers/SceneCore/Lights/DirectionalLight";

import { useSceneStore } from "./components/containers/SceneCore/Store/SceneStore";

export default function WrldBasicScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const updateSceneCameraRef = useRef<(() => void) | null>(null);
  const updateSceneCameraInstantRef = useRef<(() => void) | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const scrollControllerRef = useRef<any>(null);
  const cameraRigRef = useRef<any>(null);

  const frameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // -------------------------------------------------------
    // INIT
    // -------------------------------------------------------
    const init = () => {
      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      // ----------------------------------
      // RENDERER
      // ----------------------------------
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.domElement.style.pointerEvents = "auto";
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;

      rendererRef.current = renderer;
      containerRef.current!.appendChild(renderer.domElement);

      // ----------------------------------
      // SCENE
      // ----------------------------------
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202020);
      sceneRef.current = scene;

      // ----------------------------------
      // SCENE CAMERA (Dynamic-FOV Camera)
      // ----------------------------------
      const {
        camera: sceneCamera,
        helper: sceneHelper,
        updateSmooth: updateSceneCameraSmooth,
        updateInstant: updateSceneCameraInstant,
      } = createSceneCamera(renderer);

      scene.add(sceneHelper);

      // Store camera + updaters
      sceneCameraRef.current = sceneCamera;
      updateSceneCameraRef.current = updateSceneCameraSmooth; // smooth (animation)
      updateSceneCameraInstantRef.current = updateSceneCameraInstant; // instant (resizes)

      // ----------------------------------
      // CAMERA RIG
      // ----------------------------------
      const cameraZ = sceneCamera.position.z;
      const cameraRig = createCameraRig(sceneCamera, cameraZ);
      cameraRigRef.current = cameraRig;

      // Keep rig updated with FOV/resizes
      useSceneStore.subscribe(() => {
        cameraRig.onResizeOrFovChange();
      });

      // ----------------------------------
      // SCROLL CONTROLLER (Hybrid)
      // ----------------------------------
      const scroll = createScrollController({ cameraRig });
      scrollControllerRef.current = scroll;

      // Start scroll system using renderer DOM element
      scroll.start(renderer.domElement);

      // ----------------------------------
      // ORBIT CAMERA (Debug Camera)
      // ----------------------------------
      const {
        camera: orbitCamera,
        controls,
        helper: orbitHelper,
      } = createOrbitCamera(renderer, width, height);

      scene.add(orbitHelper);
      orbitCameraRef.current = orbitCamera;
      controlsRef.current = controls;
      controls.enabled = false;

      // start with SceneCamera
      cameraRef.current = sceneCamera;

      // Toggle cameras on “C”
      window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "c") {
          const nextCamera =
            cameraRef.current === sceneCameraRef.current
              ? orbitCameraRef.current
              : sceneCameraRef.current;

          cameraRef.current = nextCamera;

          if (controlsRef.current) {
            // Enable controls ONLY for orbit camera
            controlsRef.current.enabled = nextCamera === orbitCameraRef.current;
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
      const backdrop = initializeBackdrop(scene, {
        mobile: { width: 50, height: 150 },
        tablet: { width: 75, height: 75 },
        desktop: { width: 150, height: 50 },
      });
      backdrop.position.set(0, 0, 0);

      // Backdrop writes sceneWidth/sceneHeight → update camera + rig
      if (updateSceneCameraRef.current) updateSceneCameraRef.current();
      cameraRig.onResizeOrFovChange();

      // ----------------------------------
      // OBJECTS
      // ----------------------------------
      scene.add(
        createImagePlane({
          src: "./banner.png",
          width: 15,
          height: 12,
          position: [-2, 1, 4],
        })
      );

      scene.add(
        createImagePlane({
          src: "/textures/pic1.png",
          width: 15,
          height: 12,
          position: [0, 0, 8],
        })
      );

      scene.add(
        createImagePlane({
          src: "/textures/pic1.png",
          width: 15,
          height: 12,
          position: [2, -1, 12],
        })
      );

      window.addEventListener("resize", onResize);
      // Set initial camera
      cameraRef.current = sceneCamera;
    };

    // -------------------------------------------------------
    // RESIZE
    // -------------------------------------------------------
    const onResize = () => {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      const cameraRig = cameraRigRef.current;

      if (!renderer || !camera) return;

      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      // ⭐ FIX: properly call the instant version
      updateSceneCameraInstantRef.current?.();

      cameraRig?.onResizeOrFovChange();
    };

    // -------------------------------------------------------
    // ANIMATE LOOP
    // -------------------------------------------------------
    const animate = () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const scroll = scrollControllerRef.current;

      if (!renderer || !scene || !camera) return;

      frameIdRef.current = requestAnimationFrame(animate);

      if (camera === sceneCameraRef.current) {
        // Adaptive FOV camera
        if (updateSceneCameraRef.current) updateSceneCameraRef.current();

        // Scroll updates (Hybrid)
        scroll.update(1 / 60);
      } else if (controls) {
        controls.update();
      }

      renderer.render(scene, camera);
    };
    // -------------------------------------------------------
    // START ENGINE
    // -------------------------------------------------------
    init();
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameIdRef.current!);
      window.removeEventListener("resize", onResize);

      if (scrollControllerRef.current) scrollControllerRef.current.stop();
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
