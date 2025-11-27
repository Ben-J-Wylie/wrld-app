// DebugShaderChunk.ts
import * as THREE from "three";

export function printShadowChunk() {
  console.log(
    "%c---- SHADER CHUNK: shadowmap_pars_fragment ----",
    "font-size:14px; color:#0f0;"
  );
  console.log(THREE.ShaderChunk.shadowmap_pars_fragment);
}
