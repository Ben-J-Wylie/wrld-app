// src/components/Scene/Lights/DirectionalLight.tsx
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SceneConfig } from "@/components/containers/SceneCore";

/**
 * DirectionalLight
 * ---------------------------------------------------------------------------
 * This component creates a directional light that:
 *   • casts shadows
 *   • uses a custom shadow camera (orthographic box)
 *   • optionally shows debug helpers
 *   • keeps the light.target in the correct position
 *
 * IMPORTANT:
 * All shadow properties MUST be set in JSX (not in useEffect),
 * because Three.js allocates shadow maps when the renderer is created.
 * If castShadow or mapSize is set too late, shadows will never appear.
 */
export function DirectionalLight() {
  // The actual Three.js light instance
  const lightRef = useRef<THREE.DirectionalLight>(null);

  // Helpers (visual debugging)
  const camHelperRef = useRef<THREE.CameraHelper | null>(null);
  const lightHelperRef = useRef<THREE.DirectionalLightHelper | null>(null);

  // Access the scene to attach helpers + target
  const { scene } = useThree();

  // Pull settings from config file
  const { color, position, intensity, target, castShadow, shadow } =
    SceneConfig.lighting.directional;

  const { enabled: debugEnabled } = SceneConfig.debug;

  /* ------------------------------------------------------------------------
   * 1. HANDLE LIGHT TARGET + OPTIONAL HELPERS
   * ------------------------------------------------------------------------
   * Directional lights require a target to define the direction they point.
   * R3F does not automatically update the target's matrix, so we must do it
   * manually in an effect after the light exists.
   */
  useEffect(() => {
    if (!lightRef.current) return;
    const light = lightRef.current;

    /* -- Update the position the light points at -- */
    light.target.position.set(...target);
    light.target.updateMatrixWorld(); // IMPORTANT
    scene.add(light.target);

    /* -- Debug helpers: show the light direction + shadow camera box -- */
    if (debugEnabled) {
      // Yellow direction indicator
      const dirHelper = new THREE.DirectionalLightHelper(light, 0.5, 0xffaa00);
      lightHelperRef.current = dirHelper;
      scene.add(dirHelper);

      // Shadow frustum (blue wireframe) that shows the orthographic camera box
      const camHelper = new THREE.CameraHelper(light.shadow.camera);
      camHelperRef.current = camHelper;
      scene.add(camHelper);
    }

    /* -- Cleanup on unmount -- */
    return () => {
      scene.remove(light.target);

      if (lightHelperRef.current) {
        scene.remove(lightHelperRef.current);
        lightHelperRef.current.dispose();
        lightHelperRef.current = null;
      }

      if (camHelperRef.current) {
        scene.remove(camHelperRef.current);
        camHelperRef.current.dispose();
        camHelperRef.current = null;
      }
    };
  }, [scene, target, debugEnabled]);

  /* ------------------------------------------------------------------------
   * 2. THE LIGHT ITSELF
   * ------------------------------------------------------------------------
   * All shadow-related settings are placed directly on the JSX component.
   * This ensures they exist BEFORE Three.js creates the renderer + shadow map.
   * If they were set later in useEffect, shadows would not work.
   */
  return (
    <directionalLight
      ref={lightRef}
      color={color}
      intensity={intensity}
      position={position}
      castShadow={castShadow}
      /* -- Shadow map resolution (higher = softer, cleaner shadows) -- */
      shadow-mapSize={shadow.mapSize}
      /* -- Shadow acne / peter-panning control -- */
      shadow-bias={shadow.bias}
      shadow-normalBias={shadow.normalBias}
      /* -- Soft edges support (WebGL2 only) -- */
      shadow-radius={shadow.radius}
      /* -- Custom orthographic shadow camera frustum -- */
      shadow-camera-near={shadow.camera.near}
      shadow-camera-far={shadow.camera.far}
      shadow-camera-left={shadow.camera.left}
      shadow-camera-right={shadow.camera.right}
      shadow-camera-top={shadow.camera.top}
      shadow-camera-bottom={shadow.camera.bottom}
    />
  );
}

//            ┌─────────────────────────┐
//            │  R3F mounts the light   │
//            │  <directionalLight />   │
//            └─────────────┬───────────┘
//                          │
//        All shadow settings already exist here
//        (castShadow, mapSize, camera, bias, etc.)
//                          │
//           Three.js renderer allocates shadow map
//                          │
//                          ▼
//  ┌────────────────────────────────────────────┐
//  │ useEffect runs AFTER the light is created  │
//  └─────────────────────────┬──────────────────┘
//                            │
//                            ▼
//              ┌──────────────────────────┐
//              │ Update light.target      │
//              │ • position it correctly  │
//              │ • updateMatrixWorld()    │
//              └─────────────┬────────────┘
//                            │
//                            ▼
//            ┌─────────────────────────────────┐
//            │ (Optional) Add debug helpers    │
//            │ • DirectionalLightHelper        │
//            │ • CameraHelper (shadow frustum) │
//            └──────────────┬──────────────────┘
//                           │
//                           ▼
//            ┌──────────────────────────────────┐
//            │ Scene renders with correct light │
//            │ • shadows work                   │
//            │ • target applied                 │
//            │ • helpers visible (if enabled)   │
//            └──────────────────────────────────┘
