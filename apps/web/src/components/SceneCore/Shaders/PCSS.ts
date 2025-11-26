// src/components/containers/SceneCore/Shaders/PCSS.ts
import * as THREE from "three";

let pcssPatched = false;

// -----------------------------------------------------------------------------
// GLOBAL PCSS DEFAULTS
// -----------------------------------------------------------------------------
const PCSS_DEFAULTS = {
  lightSize: 1.2,
  searchRadiusScale: 1.0,
  filterRadiusScale: 1.0,
};
export type PCSSOptions = Partial<typeof PCSS_DEFAULTS>;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export function enablePCSS(
  renderer: THREE.WebGLRenderer,
  options: PCSSOptions = {}
) {
  if (pcssPatched) return;
  pcssPatched = true;

  const { lightSize, searchRadiusScale, filterRadiusScale } = {
    ...PCSS_DEFAULTS,
    ...options,
  };

  const chunk = THREE.ShaderChunk;
  const original = chunk.shadowmap_pars_fragment;

  if (!original) {
    console.error("[PCSS] Missing shadowmap_pars_fragment");
    return;
  }

  const funcMarker = "float getShadow(";
  const idx = original.indexOf(funcMarker);
  const braceStart = original.indexOf("{", idx);

  // find end of function
  let depth = 0;
  let i = braceStart;
  for (; i < original.length; i++) {
    if (original[i] === "{") depth++;
    else if (original[i] === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }

  const before = original.slice(0, idx);
  const after = original.slice(i);

  // -----------------------------------------------------------
  // Inject uniforms for blue-noise sampling
  // -----------------------------------------------------------
  // Force-clear program cache so shaders recompile with new chunk
  const props = (renderer as any).properties;
  if (props && props.get) {
    const p = props.get(renderer);
    if (p && p.programs) p.programs.length = 0;
  }

  chunk.shadowmap_pars_fragment =
    before +
    /* glsl */ `
uniform sampler2D pcssBlueNoise;
uniform vec2      pcssBlueNoiseSize;

const float PCSS_LIGHT_SIZE   = ${lightSize.toFixed(5)};
const float PCSS_SEARCH_SCALE = ${searchRadiusScale.toFixed(5)};
const float PCSS_FILTER_SCALE = ${filterRadiusScale.toFixed(5)};

// 16-tap Poisson
vec2 poisson[16];
void initPoisson() {
  poisson[0]  = vec2( 0.535, -0.295 );
  poisson[1]  = vec2( -0.706, -0.110 );
  poisson[2]  = vec2( 0.063,  0.717 );
  poisson[3]  = vec2( -0.525,  0.531 );
  poisson[4]  = vec2( 0.387,  0.544 );
  poisson[5]  = vec2( -0.089, -0.822 );
  poisson[6]  = vec2( 0.741,  0.067 );
  poisson[7]  = vec2( -0.812, -0.474 );
  poisson[8]  = vec2( 0.246, -0.913 );
  poisson[9]  = vec2( -0.397, -0.614 );
  poisson[10] = vec2( 0.874, -0.343 );
  poisson[11] = vec2( -0.132,  0.312 );
  poisson[12] = vec2( 0.561,  0.812 );
  poisson[13] = vec2( -0.276,  0.857 );
  poisson[14] = vec2( 0.202, -0.381 );
  poisson[15] = vec2( -0.671,  0.285 );
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

  // -------------------------
  // Screen-space blue noise
  // -------------------------
  vec2 bnUV = gl_FragCoord.xy / pcssBlueNoiseSize;
  float jitter = texture2D(pcssBlueNoise, bnUV).r;
  float baseAngle = jitter * 6.28318530718; // 2*pi

  shadowCoord.xyz /= shadowCoord.w;
  shadowCoord.z += shadowBias;

  bool inFrustum =
    shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 &&
    shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 &&
    shadowCoord.z <= 1.0;

  if (!inFrustum) return 1.0;

  float receiverDepth = shadowCoord.z;
  float texel = 1.0 / max(shadowMapSize.x, shadowMapSize.y);
  float radiusBase = shadowRadius * PCSS_LIGHT_SIZE;

  float searchRadius = radiusBase * texel * 2.0 * PCSS_SEARCH_SCALE;

  // Blocker search
  float blockerSum = 0.0;
  float blockerCount = 0.0;

  for (int i = 0; i < 16; i++) {
    float angle = baseAngle + float(i) * 0.3926991;
    float c = cos(angle), s = sin(angle);
    vec2 r = mat2(c, -s, s, c) * poisson[i];

    float depth = unpackRGBAToDepth(texture2D(shadowMap,
      shadowCoord.xy + r * searchRadius));

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
  float penumbra = clamp((receiverDepth - avgBlocker) / max(avgBlocker, 0.0005), 0.0, 1.0);

  float filterRadius =
    penumbra * radiusBase * texel * 3.5 * PCSS_FILTER_SCALE;

  float shadow = 0.0;
  for (int i = 0; i < 16; i++) {
    float angle = baseAngle + float(i) * 1.178097;
    float c = cos(angle), s = sin(angle);
    vec2 r = mat2(c, -s, s, c) * poisson[i];

    float depth = unpackRGBAToDepth(texture2D(shadowMap,
      shadowCoord.xy + r * filterRadius));

    shadow += step(receiverDepth, depth);
  }

  shadow /= 16.0;
  return mix(1.0, shadow, shadowIntensity);
}
` +
    after;

  // Set renderer to correct mode
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
