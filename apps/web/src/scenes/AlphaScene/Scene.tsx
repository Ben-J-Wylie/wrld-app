import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

export default function VsmScene() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // ----------------------------------------------------------
    // 1. THREE.JS CORE SETUP
    // ----------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222244);
    scene.fog = new THREE.Fog(0x222244, 50, 100);

    // ----------------------------------------------------------
    // 2. CAMERA
    // ----------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    camera.position.set(0, 10, 30);

    // ----------------------------------------------------------
    // 3. CONTROLS
    // ----------------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.update();

    // ----------------------------------------------------------
    // 4. LIGHTS
    // ----------------------------------------------------------
    scene.add(new THREE.AmbientLight(0x444444));

    // SPOTLIGHT
    const spotLight = new THREE.SpotLight(0xff8888, 400);
    spotLight.castShadow = true;
    spotLight.angle = Math.PI / 5;
    spotLight.penumbra = 0.3;
    spotLight.position.set(8, 10, 5);
    spotLight.shadow.camera.near = 8;
    spotLight.shadow.camera.far = 200;
    spotLight.shadow.mapSize.set(256, 256);
    spotLight.shadow.bias = -0.002;
    spotLight.shadow.radius = 4;
    scene.add(spotLight);

    // DIRECTIONAL LIGHT
    const dirLight = new THREE.DirectionalLight(0x8888ff, 3);
    dirLight.castShadow = true;
    dirLight.position.set(3, 12, 17);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -17;
    dirLight.shadow.camera.right = 17;
    dirLight.shadow.camera.top = 17;
    dirLight.shadow.camera.bottom = -17;
    dirLight.shadow.mapSize.set(512, 512);
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.radius = 4;

    const dirGroup = new THREE.Group();
    dirGroup.add(dirLight);
    scene.add(dirGroup);

    // ----------------------------------------------------------
    // 5. GEOMETRY
    // ----------------------------------------------------------
    const material = new THREE.MeshPhongMaterial({
      color: 0x999999,
      shininess: 0,
      specular: 0x222222,
    });

    // TorusKnot
    const torusKnot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(25, 8, 75, 20),
      material
    );
    torusKnot.scale.setScalar(1 / 18);
    torusKnot.position.y = 3;
    torusKnot.castShadow = true;
    torusKnot.receiveShadow = true;
    scene.add(torusKnot);

    // Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.75, 0.75, 7, 32);
    const positions: [number, number, number][] = [
      [8, 3.5, 8],
      [8, 3.5, -8],
      [-8, 3.5, 8],
      [-8, 3.5, -8],
    ];
    positions.forEach((pos) => {
      const p = new THREE.Mesh(pillarGeo, material);
      p.position.set(...pos);
      p.castShadow = true;
      p.receiveShadow = true;
      scene.add(p);
    });

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshPhongMaterial({
        color: 0x999999,
        shininess: 0,
        specular: 0x111111,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(3, 3, 3);
    ground.castShadow = true;
    ground.receiveShadow = true;
    scene.add(ground);

    // ----------------------------------------------------------
    // 6. GUI FOR SHADOW BLUR
    // ----------------------------------------------------------
    const gui = new GUI();
    const config = {
      spotlightRadius: 4,
      spotlightSamples: 8,
      dirlightRadius: 4,
      dirlightSamples: 8,
    };

    gui
      .add(config, "spotlightRadius", 0, 25)
      .onChange((v) => (spotLight.shadow.radius = v));
    gui
      .add(config, "spotlightSamples", 1, 25, 1)
      .onChange((v) => (spotLight.shadow.blurSamples = v));
    gui
      .add(config, "dirlightRadius", 0, 25)
      .onChange((v) => (dirLight.shadow.radius = v));
    gui
      .add(config, "dirlightSamples", 1, 25, 1)
      .onChange((v) => (dirLight.shadow.blurSamples = v));

    // ----------------------------------------------------------
    // 7. RENDER LOOP
    // ----------------------------------------------------------
    const clock = new THREE.Clock();

    function animate(time: number) {
      const dt = clock.getDelta();

      torusKnot.rotation.x += 0.25 * dt;
      torusKnot.rotation.y += 0.5 * dt;
      torusKnot.rotation.z += 1.0 * dt;

      dirGroup.rotation.y += 0.7 * dt;
      dirLight.position.z = 17 + Math.sin(time * 0.001) * 5;

      renderer.render(scene, camera);
    }

    renderer.setAnimationLoop(animate);
    
    // Cleanup
    return () => {
      gui.destroy();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100vw", height: "100vh", display: "block" }}
    />
  );
}
