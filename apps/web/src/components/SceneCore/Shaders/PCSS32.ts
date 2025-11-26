import * as THREE from "three";

let pcssPatched = false;

export interface PCSSOptions {
  lightSize?: number;
  searchRadiusScale?: number;
  filterRadiusScale?: number;
}

export function enablePCSS(
  renderer: THREE.WebGLRenderer,
  options: PCSSOptions = {}
) {
  if (pcssPatched) return;

  const {
    lightSize = 1.0,
    searchRadiusScale = 1.0,
    filterRadiusScale = 1.0,
  } = options;

  const chunk = THREE.ShaderChunk;
  const original = chunk.shadowmap_pars_fragment;

  if (!original) {
    console.error("[PCSS] shadowmap_pars_fragment not found");
    return;
  }

  // Locate getShadow()
  const funcMarker = "float getShadow(";
  const funcIndex = original.indexOf(funcMarker);

  if (funcIndex === -1) {
    console.error("[PCSS] getShadow() not found");
    return;
  }

  const braceStart = original.indexOf("{", funcIndex);
  let depth = 0;
  let i = braceStart;
  for (; i < original.length; i++) {
    if (original[i] === "{") depth++;
    if (original[i] === "}") depth--;
    if (depth === 0) {
      i++;
      break;
    }
  }

  const before = original.slice(0, funcIndex);
  const after = original.slice(i);

  // ---------------------------------------------------------------------------
  // 32-tap PCSS + per-frame rotating Poisson kernel
  // ---------------------------------------------------------------------------
  const pcssGetShadow = /* glsl */ `
uniform float uPoissonRotation;

const float PCSS_LIGHT_SIZE   = ${lightSize.toFixed(5)};
const float PCSS_SEARCH_SCALE = ${searchRadiusScale.toFixed(5)};
const float PCSS_FILTER_SCALE = ${filterRadiusScale.toFixed(5)};

// 32-tap Poisson disk
vec2 poisson[32];

void initPoisson() {
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

  poisson[16] = vec2(-0.94558609,  0.76890725);
  poisson[17] = vec2( 0.09418410,  0.92938870);
  poisson[18] = vec2(-0.34495938, -0.29387760);
  poisson[19] = vec2( 0.91588581, -0.45771432);
  poisson[20] = vec2( 0.81544232,  0.87912464);
  poisson[21] = vec2(-0.38277543,  0.27676845);
  poisson[22] = vec2(-0.97484398, -0.75648379);
  poisson[23] = vec2(-0.44323325,  0.97511554);
  poisson[24] = vec2(-0.53742981,  0.47373420);
  poisson[25] = vec2( 0.26496911,  0.41893023);
  poisson[26] = vec2(-0.79197514, -0.19090188);
  poisson[27] = vec2( 0.24188840, -0.99706507);
  poisson[28] = vec2( 0.81409955, -0.91437590);
  poisson[29] = vec2(-0.19984126, -0.78641367);
  poisson[30] = vec2(-0.14383161,  0.14100790);
  poisson[31] = vec2( 0.58321015,  0.21115454);
}

vec2 rotatePoisson(vec2 v) {
  float c = cos(uPoissonRotation);
  float s = sin(uPoissonRotation);
  return mat2(c, -s, s, c) * v;
}

float getShadow(
  sampler2D shadowMap,
  vec2 shadowMapSize,
  float shadowIntensity,
  float shadowBias,
  float shadowRadius,
  vec4 shadowCoord
) {
  initPoisson();

  shadowCoord.xyz /= shadowCoord.w;
  shadowCoord.z += shadowBias;

  bool inFrustum =
    shadowCoord.x >= 0.0 &&
    shadowCoord.x <= 1.0 &&
    shadowCoord.y >= 0.0 &&
    shadowCoord.y <= 1.0 &&
    shadowCoord.z <= 1.0;

  if (!inFrustum) return 1.0;

  float receiverDepth = shadowCoord.z;

  float texel = 1.0 / max(shadowMapSize.x, shadowMapSize.y);
  float radiusBase = shadowRadius * PCSS_LIGHT_SIZE;

  // -----------------------------
  // Blocker search
  // -----------------------------
  float searchRadius = radiusBase * texel * 2.0 * PCSS_SEARCH_SCALE;

  float blockerSum = 0.0;
  float blockerCount = 0.0;

  for (int i = 0; i < 32; i++) {
    vec2 r = rotatePoisson(poisson[i]);
    vec2 uv = shadowCoord.xy + r * searchRadius;

    float depth = unpackRGBAToDepth(texture2D(shadowMap, uv));
    if (depth < receiverDepth) {
      blockerSum += depth;
      blockerCount += 1.0;
    }
  }

  if (blockerCount < 1.0) {
    float hard = texture2DCompare(shadowMap, shadowCoord.xy, receiverDepth);
    return mix(1.0, hard, shadowIntensity);
  }

  float avgBlocker = blockerSum / blockerCount;

  // -----------------------------
  // Penumbra calc
  // -----------------------------
  float penumbra = (receiverDepth - avgBlocker) / max(avgBlocker, 0.0005);
  penumbra = clamp(penumbra, 0.0, 1.0);

  float filterRadius =
    penumbra * radiusBase * texel * 4.0 * PCSS_FILTER_SCALE;

  // -----------------------------
  // PCF filter
  // -----------------------------
  float shadow = 0.0;

  for (int i = 0; i < 32; i++) {
    vec2 r = rotatePoisson(poisson[i]);
    vec2 uv = shadowCoord.xy + r * filterRadius;
    float depth = unpackRGBAToDepth(texture2D(shadowMap, uv));
    shadow += step(receiverDepth, depth);
  }

  shadow /= 32.0;

  return mix(1.0, shadow, shadowIntensity);
}
`;

  chunk.shadowmap_pars_fragment = before + pcssGetShadow + after;

  // Global shadow settings
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  pcssPatched = true;
}
