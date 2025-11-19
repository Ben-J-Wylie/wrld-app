// SceneCore/Layers/ImagePlanePrimitive.ts
import * as THREE from "three";
import { ShadowProps } from "@/components/containers/SceneCore/Shadows/ShadowTypes";
import { ShadowSystem } from "@/components/containers/SceneCore/Shadows/ShadowSystem";
import { createShadowUniforms } from "@/components/containers/SceneCore/Shadows/ShadowUniforms";
import shadowChunk from "@/components/containers/SceneCore/Shadows/ShadowApplyChunk.glsl";

export interface ImagePlanePrimitiveOptions extends ShadowProps {
  src?: string;
  color?: string | number;
  shadowSystem?: ShadowSystem;
}

export function createImagePlane(options: ImagePlanePrimitiveOptions) {
  const {
    src,
    color,

    castShadow = false,
    receiveShadow = false,
    shadowRadius = 1,
    shadowSamples = 8,
    shadowFade = 0.25,
    shadowDistanceFactor = 1.0,
    shadowLightSize = 1.0,

    shadowSystem,
  } = options;

  // ---------- Texture ----------
  const textureLoader = new THREE.TextureLoader();
  const texture = src ? textureLoader.load(src) : null;

  const geo = new THREE.PlaneGeometry(1, 1);

  const mat = new THREE.MeshStandardMaterial({
    map: texture ?? null,
    color: texture ? 0xffffff : color ?? 0x888888,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geo, mat);

  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;

  if (receiveShadow && shadowSystem) {
    const uniforms = createShadowUniforms(shadowSystem, {
      shadowRadius,
      shadowSamples,
      shadowFade,
      shadowDistanceFactor,
      shadowLightSize,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms = {
        ...shader.uniforms,
        ...uniforms,
      };

      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        `
        varying vec3 vWorldPosition;
        ${shadowChunk}
        void main() {
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
        `
          float shadowFactor = applyShadow(vWorldPosition);
          gl_FragColor = vec4( outgoingLight * shadowFactor, diffuseColor.a );
        `
      );
    };

    mat.customProgramCacheKey = () => `imageplane-shadow-${mesh.uuid}`;

    mesh.onBeforeRender = () => {
      uniforms.uShadowMatrix.value.copy(shadowSystem.shadowMatrix);
      uniforms.uShadowMap.value = shadowSystem.shadowMap;
    };
  }

  return mesh;
}
