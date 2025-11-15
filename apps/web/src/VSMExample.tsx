import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";

export default function VSMExample() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // persistent refs to avoid React strict-mode double mount issues
const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
const sceneRef = useRef<THREE.Scene | null>(null);
const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
const controlsRef = useRef<OrbitControls | null>(null);
const torusRef = useRef<THREE.Mesh | null>(null);
const dirGroupRef = useRef<THREE.Group | null>(null);
const frameIdRef = useRef<number | null>(null);


  useEffect(() => {
    if (!containerRef.current) return;

    // ----------------------------------------
    // INIT
    // ----------------------------------------
    const init = () => {
      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;
      rendererRef.current = renderer;

      containerRef.current!.appendChild(renderer.domElement);

      // Scene + Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x222244);
      scene.fog = new THREE.Fog(0x222244, 50, 100);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
      camera.position.set(0, 10, 30);
      cameraRef.current = camera;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 2, 0);
      controls.update();
      controlsRef.current = controls;

      // Lights
      scene.add(new THREE.AmbientLight(0x444444));

      const spotLight = new THREE.SpotLight(0xff8888, 400);
      spotLight.angle = Math.PI / 5;
      spotLight.penumbra = 0.3;
      spotLight.position.set(8, 10, 5);
      spotLight.castShadow = true;
      spotLight.shadow.camera.near = 8;
      spotLight.shadow.camera.far = 200;
      spotLight.shadow.mapSize.set(256, 256);
      spotLight.shadow.bias = -0.002;
      spotLight.shadow.radius = 16;
      spotLight.shadow.blurSamples = 12;

      scene.add(spotLight);

      const dirLight = new THREE.DirectionalLight(0x8888ff, 3);
      dirLight.position.set(3, 12, 17);
      dirLight.castShadow = true;

      dirLight.shadow.mapSize.set(512, 512);
      dirLight.shadow.camera.left = -17;
      dirLight.shadow.camera.right = 17;
      dirLight.shadow.camera.top = 17;
      dirLight.shadow.camera.bottom = -17;
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far = 500;
      dirLight.shadow.radius = 12;
      dirLight.shadow.blurSamples = 12;

      const dirGroup = new THREE.Group();
      dirGroup.add(dirLight);
      dirGroupRef.current = dirGroup;
      scene.add(dirGroup);

      // Objects
      const material = new THREE.MeshPhongMaterial({
        color: 0x999999,
        shininess: 0,
        specular: 0x222222,
      });

      const knotGeo = new THREE.TorusKnotGeometry(25, 8, 75, 20);
      const torus = new THREE.Mesh(knotGeo, material);
      torus.scale.multiplyScalar(1 / 18);
      torus.position.y = 3;
      torus.castShadow = true;
      torus.receiveShadow = true;
      torusRef.current = torus;
      scene.add(torus);

      // Pillars
      const cylGeo = new THREE.CylinderGeometry(0.75, 0.75, 7, 32);
      [
        [8, 3.5, 8],
        [8, 3.5, -8],
        [-8, 3.5, 8],
        [-8, 3.5, -8],
      ].forEach(([x, y, z]) => {
        const p = new THREE.Mesh(cylGeo, material);
        p.position.set(x, y, z);
        p.castShadow = true;
        p.receiveShadow = true;
        scene.add(p);
      });

      // Ground
      const groundGeo = new THREE.PlaneGeometry(200, 200);
      const groundMat = new THREE.MeshPhongMaterial({
        color: 0x999999,
        shininess: 0,
        specular: 0x111111,
      });

      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.scale.multiplyScalar(3);
      ground.receiveShadow = true;
      scene.add(ground);

      

      window.addEventListener("resize", onResize);
    };

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

    // ----------------------------------------
    // ANIMATE (safe!)
    // ----------------------------------------
    const animate = () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const torus = torusRef.current;
      const dirGroup = dirGroupRef.current;


      if (!renderer || !camera || !scene) return;

      frameIdRef.current = requestAnimationFrame(animate);

 

      if (torus) {
        torus.rotation.x += 0.01;
        torus.rotation.y += 0.02;
      }

      if (dirGroup) {
        dirGroup.rotation.y += 0.01;
      }

      renderer.render(scene, camera);
    };

    init();
    animate();

    return () => {
      cancelAnimationFrame(frameIdRef.current!);

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



// // src/App.tsx
// import React from "react";
// import VSMExample from "./VSMExample";

// export default function App() {
//   return (
//     <div
//       style={{
//         width: "100vw",
//         height: "100vh",
//         overflow: "hidden",
//         margin: 0,
//         padding: 0,
//       }}
//     >
//       <VSMExample />
//     </div>
//   );
// }