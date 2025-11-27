// SceneCore/Layers/TextPlanePrimitive.ts
import * as THREE from "three";

export interface TextPlaneOptions {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  background?: string | null;
  padding?: number;

  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function createTextPlane(options: TextPlaneOptions) {
  const {
    text,
    fontSize = 128,
    fontFamily = "sans-serif",
    color = "#ffffff",
    background = null,
    padding = 32,

    castShadow = true,
    receiveShadow = true,
  } = options;

  // --- Canvas --------------------------------------------------
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontSize}px ${fontFamily}`;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.2;

  canvas.width = textWidth + padding * 2;
  canvas.height = textHeight + padding * 2;

  ctx.font = `${fontSize}px ${fontFamily}`;

  // Background (with alpha support)
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw text
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.fillText(text, padding, padding);

  // --- Texture --------------------------------------------------
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  // Convert px → world units (same convention as ImagePlane)
  const worldWidth = canvas.width / 100;
  const worldHeight = canvas.height / 100;

  const geo = new THREE.PlaneGeometry(worldWidth, worldHeight);

  // --- Material (MATCHING ImagePlane) ---------------------------
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff, // same rule: white when texture is present
    transparent: true,
    alphaTest: 0.01, // CRITICAL for clean text edges
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geo, mat);

  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  return mesh;
}
