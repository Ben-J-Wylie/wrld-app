// src/components/containers/SceneCore/Shaders/applyPCSSBlueNoise.ts
import * as THREE from "three";

export function applyPCSSBlueNoise(
  material: THREE.Material,
  blueNoise: THREE.Texture
) {
  // Only mesh materials have onBeforeCompile
  if (!("onBeforeCompile" in material)) return;

  const m = material as any;

  const prev = m.onBeforeCompile?.bind(m);

  m.onBeforeCompile = (shader: any) => {
    // Inject blue-noise uniforms
    shader.uniforms.pcssBlueNoise = { value: blueNoise };
    shader.uniforms.pcssBlueNoiseSize = {
      value: new THREE.Vector2(
        (blueNoise.image as HTMLImageElement).width,
        (blueNoise.image as HTMLImageElement).height
      ),
    };

    // Call any previous handler
    if (prev) prev(shader);
  };

  m.needsUpdate = true;
}
