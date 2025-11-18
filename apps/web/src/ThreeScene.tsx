import { useRef, useEffect } from "react";
import * as THREE from "three";

import { OrbitControls } from "three-stdlib";

import { createEngineLoop } from "./components/containers/SceneCore/Engine/EngineLoop";
import { createRenderer } from "./components/containers/SceneCore/Engine/Renderer";

import { createCameraPackage } from "./components/containers/SceneCore/Cameras/CameraPackage";
import { createScrollController } from "./components/containers/SceneCore/Controllers/ScrollController";

import { initializeBackdrop } from "./components/containers/SceneCore/Layers/Backdrop";
import { createImagePlane } from "./components/containers/SceneCore/Layers/ImagePlane";

import { createAmbientLight } from "./components/containers/SceneCore/Lights/AmbientLight";
import { createDirectionalLight } from "./components/containers/SceneCore/Lights/DirectionalLight";

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

  // NEW: engineRef replaces any RAF refs
  const engineRef = useRef<any>(null);

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
      const renderer = createRenderer(width, height);
      rendererRef.current = renderer;
      containerRef.current!.appendChild(renderer.domElement);

      // ----------------------------------
      // SCENE
      // ----------------------------------
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202020);
      sceneRef.current = scene;

      // ----------------------------------
      // CAMERA PACKAGE (scene + orbit + rig)
      // ----------------------------------
      const cams = createCameraPackage(renderer, scene, width, height);

      sceneCameraRef.current = cams.sceneCamera;
      orbitCameraRef.current = cams.orbitCamera;
      cameraRef.current = cams.activeCameraRef.current;

      controlsRef.current = cams.controls;

      updateSceneCameraRef.current = cams.updateSceneCameraSmooth;
      updateSceneCameraInstantRef.current = cams.updateSceneCameraInstant;

      cameraRigRef.current = cams.cameraRig;

      // Camera toggle on "C"
      window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "c") {
          cameraRef.current = cams.cameraSwitcher();
        }
      });

      // ----------------------------------
      // SCROLL CONTROLLER
      // ----------------------------------
      const scroll = createScrollController({
        cameraRig: cameraRigRef.current,
      });
      scrollControllerRef.current = scroll;

      scroll.start(renderer.domElement);

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

      updateSceneCameraRef.current?.();
      cameraRigRef.current?.onResizeOrFovChange();

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

      // ----------------------------------
      // RESIZE
      // ----------------------------------
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

        updateSceneCameraInstantRef.current?.();
        cameraRig?.onResizeOrFovChange();
      };

      window.addEventListener("resize", onResize);

      // ----------------------------------
      // ENGINE LOOP
      // ----------------------------------
      const engine = createEngineLoop({
        renderer,
        scene,

        getCamera: () => cameraRef.current,

        updateSceneCamera: () =>
          cameraRef.current === sceneCameraRef.current
            ? updateSceneCameraRef.current?.()
            : undefined,

        updateOrbitControls: () =>
          cameraRef.current === orbitCameraRef.current
            ? controlsRef.current?.update()
            : undefined,

        updateScroll: (dt) =>
          cameraRef.current === sceneCameraRef.current
            ? scrollControllerRef.current?.update(dt)
            : undefined,
      });

      engine.start();
      engineRef.current = engine;

      // Cleanup local listener inside init()
      return () => {
        window.removeEventListener("resize", onResize);
      };
    };

    // Run init()
    const cleanupInit = init();

    // -------------------------------------------------------
    // GLOBAL CLEANUP
    // -------------------------------------------------------
    return () => {
      cleanupInit?.();

      engineRef.current?.stop();
      scrollControllerRef.current?.stop();
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
