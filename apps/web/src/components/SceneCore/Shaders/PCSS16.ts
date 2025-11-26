// src/components/containers/SceneCore/Shaders/PCSS.ts
import * as THREE from "three";

let pcssPatched = false;

// -----------------------------------------------------------------------------
// PCSS options: global knobs for the shader
// -----------------------------------------------------------------------------
export interface PCSSOptions {
  /** Multiplier for effective light size (bigger = softer penumbra) */
  lightSize?: number;
  /** Multiplier for blocker search radius */
  searchRadiusScale?: number;
  /** Multiplier for PCF filter radius */
  filterRadiusScale?: number;
}

export function enablePCSS(
  renderer: THREE.WebGLRenderer,
  options: PCSSOptions = {}
) {
  if (pcssPatched) return; // avoid double patching

  const {
    lightSize = 1.0,
    searchRadiusScale = 1.0,
    filterRadiusScale = 1.0,
  } = options;

  const chunk = THREE.ShaderChunk;
  const original = chunk.shadowmap_pars_fragment;

  if (!original) {
    console.error("[PCSS] shadowmap_pars_fragment not found on ShaderChunk");
    return;
  }

  const funcMarker = "float getShadow(";
  const funcIndex = original.indexOf(funcMarker);

  if (funcIndex === -1) {
    console.error(
      "[PCSS] Could not locate getShadow() in shadowmap_pars_fragment"
    );
    return;
  }

  // Find the opening brace of getShadow
  const braceStart = original.indexOf("{", funcIndex);
  if (braceStart === -1) {
    console.error("[PCSS] Could not find opening brace for getShadow()");
    return;
  }

  // Walk braces to find matching closing brace
  let depth = 0;
  let i = braceStart;
  for (; i < original.length; i++) {
    const c = original[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        i++; // include this closing brace
        break;
      }
    }
  }

  if (depth !== 0) {
    console.error("[PCSS] Brace walk failed while parsing getShadow()");
    return;
  }

  const before = original.slice(0, funcIndex);
  const after = original.slice(i);

  // ------------------------------------------------------------------
  // PCSS getShadow
  //
  // Signature (matches your patched build):
  //   sampler2D shadowMap,
  //   vec2 shadowMapSize,
  //   float shadowIntensity,
  //   float shadowBias,
  //   float shadowRadius,
  //   vec4 shadowCoord
  //
  // NOTE:
  // - We use THREE's `shadowRadius` (per-light, from shadow-radius prop)
  // - And multiply it by global PCSS scalars baked in here.
  // ------------------------------------------------------------------
  const pcssGetShadow = /* glsl */ `
const float PCSS_LIGHT_SIZE      = ${lightSize.toFixed(5)};
const float PCSS_SEARCH_SCALE    = ${searchRadiusScale.toFixed(5)};
const float PCSS_FILTER_SCALE    = ${filterRadiusScale.toFixed(5)};

float getShadow(
  sampler2D shadowMap,
  vec2 shadowMapSize,
  float shadowIntensity,
  float shadowBias,
  float shadowRadius,
  vec4 shadowCoord
) {
  shadowCoord.xyz /= shadowCoord.w;
  shadowCoord.z += shadowBias;

  bool inFrustum =
    shadowCoord.x >= 0.0 &&
    shadowCoord.x <= 1.0 &&
    shadowCoord.y >= 0.0 &&
    shadowCoord.y <= 1.0 &&
    shadowCoord.z <= 1.0;

  if (!inFrustum) {
    return 1.0;
  }

  float receiverDepth = shadowCoord.z;

  // Poisson-disk taps
  vec2 poisson[16];
  poisson[0]  = vec2(-0.94201624, -0.39906216);
  poisson[1]  = vec2( 0.94558609, -0.76890725);
  poisson[2]  = vec2(-0.09418410, -0.92938870);
  poisson[3]  = vec2( 0.34495938,  0.29387760);
  poisson[4]  = vec2(-0.91588581,  0.45771432);
  poisson[5]  = vec2(-0.81544232, -0.87912464);
  poisson[6]  = vec2(-0.38277543,  0.27676845);
  poisson[7]  = vec2( 0.97484398,  0.75648379);
  poisson[8]  = vec2( 0.44323325, -0.97511554);
  poisson[9]  = vec2( 0.53742981, -0.47373420);
  poisson[10] = vec2(-0.26496911, -0.41893023);
  poisson[11] = vec2( 0.79197514,  0.19090188);
  poisson[12] = vec2(-0.24188840,  0.99706507);
  poisson[13] = vec2(-0.81409955,  0.91437590);
  poisson[14] = vec2( 0.19984126,  0.78641367);
  poisson[15] = vec2( 0.14383161, -0.14100790);

  // Convert radius to UV
  float texel = 1.0 / max(shadowMapSize.x, shadowMapSize.y);

  // Base radius comes from THREE's shadowRadius
  float radiusBase = shadowRadius * PCSS_LIGHT_SIZE;

  // -----------------------------
  // Blocker search
  // -----------------------------
  float searchRadius = radiusBase * texel * 2.0 * PCSS_SEARCH_SCALE;

  float blockerSum = 0.0;
  float blockerCount = 0.0;

  for (int i = 0; i < 16; i++) {
    vec2 uv = shadowCoord.xy + poisson[i] * searchRadius;
    float depth = unpackRGBAToDepth(texture2D(shadowMap, uv));
    if (depth < receiverDepth) {
      blockerSum += depth;
      blockerCount += 1.0;
    }
  }

  // No blockers → hard shadow
  if (blockerCount < 1.0) {
    float hard = texture2DCompare(shadowMap, shadowCoord.xy, receiverDepth);
    return mix(1.0, hard, shadowIntensity);
  }

  float avgBlocker = blockerSum / blockerCount;

  // -----------------------------
  // Penumbra size
  // -----------------------------
  float penumbra = (receiverDepth - avgBlocker) / max(avgBlocker, 0.0005);
  penumbra = clamp(penumbra, 0.0, 1.0);

  float filterRadius = penumbra * radiusBase * texel * 4.0 * PCSS_FILTER_SCALE;

  // -----------------------------
  // PCF filter
  // -----------------------------
  float shadow = 0.0;

  for (int i = 0; i < 16; i++) {
    vec2 uv = shadowCoord.xy + poisson[i] * filterRadius;
    float depth = unpackRGBAToDepth(texture2D(shadowMap, uv));
    shadow += step(receiverDepth, depth);
  }

  shadow /= 16.0;

  // Must use shadowIntensity
  return mix(1.0, shadow, shadowIntensity);
}
`;

  chunk.shadowmap_pars_fragment = before + pcssGetShadow + after;

  // Force a compatible shadow map type
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  pcssPatched = true;
}
