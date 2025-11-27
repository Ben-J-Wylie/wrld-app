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
uniform float uPoissonSeed;

const float PCSS_LIGHT_SIZE   = ${lightSize.toFixed(5)};
const float PCSS_SEARCH_SCALE = ${searchRadiusScale.toFixed(5)};
const float PCSS_FILTER_SCALE = ${filterRadiusScale.toFixed(5)};

// 16-tap blue-noise Poisson disk
vec2 poisson[16];

void initPoisson() {
  poisson[0] = vec2( 0.535, -0.295 );
  poisson[1] = vec2( -0.706, -0.110 );
  poisson[2] = vec2( 0.063, 0.717 );
  poisson[3] = vec2( -0.525, 0.531 );
  poisson[4] = vec2( 0.387, 0.544 );
  poisson[5] = vec2( -0.089, -0.822 );
  poisson[6] = vec2( 0.741, 0.067 );
  poisson[7] = vec2( -0.812, -0.474 );
  poisson[8] = vec2( 0.246, -0.913 );
  poisson[9] = vec2( -0.397, -0.614 );
  poisson[10] = vec2( 0.874, -0.343 );
  poisson[11] = vec2( -0.132, 0.312 );
  poisson[12] = vec2( 0.561, 0.812 );
  poisson[13] = vec2( -0.276, 0.857 );
  poisson[14] = vec2( 0.202, -0.381 );
  poisson[15] = vec2( -0.671, 0.285 );
}

vec2 rotatePoisson(vec2 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
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
    shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 &&
    shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 &&
    shadowCoord.z <= 1.0;

  if (!inFrustum) return 1.0;

  float receiverDepth = shadowCoord.z;

  float texel = 1.0 / max(shadowMapSize.x, shadowMapSize.y);

  // Multi-scale base radius (better near contact, softer in distance)
  float radiusBase = shadowRadius * PCSS_LIGHT_SIZE;

  // Per-light + per-frame jitter
  float jitter = uPoissonRotation + uPoissonSeed;

  // -----------------------------
  // BLOCKER SEARCH
  // -----------------------------
  float searchRadius =
    radiusBase * texel * 2.0 * PCSS_SEARCH_SCALE;

  float blockerSum = 0.0;
  float blockerCount = 0.0;

  for (int i = 0; i < 16; i++) {
    vec2 r = rotatePoisson(poisson[i], jitter * 0.7);
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

  // Penumbra growth
  float penumbra = (receiverDepth - avgBlocker) /
                   max(avgBlocker, 0.0005);

  penumbra = clamp(penumbra, 0.0, 1.0);

  // Hybrid multi-scale: smoother but preserves contact
  float filterRadius =
    penumbra * radiusBase * texel * 3.5 * PCSS_FILTER_SCALE;

  // -----------------------------
  // PCF FILTER
  // -----------------------------
  float shadow = 0.0;

  for (int i = 0; i < 16; i++) {
    vec2 r = rotatePoisson(poisson[i], jitter * 1.7);
    vec2 uv = shadowCoord.xy + r * filterRadius;

    float depth = unpackRGBAToDepth(texture2D(shadowMap, uv));
    shadow += step(receiverDepth, depth);
  }

  shadow /= 16.0;

  return mix(1.0, shadow, shadowIntensity);
}
`;

  chunk.shadowmap_pars_fragment = before + pcssGetShadow + after;

  // Global shadow settings
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  pcssPatched = true;
}
