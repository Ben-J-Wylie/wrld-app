// src/components/containers/SceneCore/Layers/ShadowCaster.ts
import * as THREE from "three";

/**
 * Parse a CSS border-radius string into 4 corner radii (px).
 */
function parseBorderRadius(
  style: CSSStyleDeclaration,
  width: number,
  height: number
) {
  const raw = style.borderRadius || "0";

  const [horizontal] = raw.split("/");
  const parts = horizontal.trim().split(/\s+/).filter(Boolean);

  const toPx = (v: string): number => {
    if (v.endsWith("%")) {
      const pct = parseFloat(v) / 100;
      return pct * Math.min(width, height);
    }
    if (v.endsWith("px")) return parseFloat(v);
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  let tl = 0,
    tr = 0,
    br = 0,
    bl = 0;

  if (parts.length === 1) {
    tl = tr = br = bl = toPx(parts[0]);
  } else if (parts.length === 2) {
    tl = br = toPx(parts[0]);
    tr = bl = toPx(parts[1]);
  } else if (parts.length === 3) {
    tl = toPx(parts[0]);
    tr = bl = toPx(parts[1]);
    br = toPx(parts[2]);
  } else if (parts.length >= 4) {
    tl = toPx(parts[0]);
    tr = toPx(parts[1]);
    br = toPx(parts[2]);
    bl = toPx(parts[3]);
  }

  return { tl, tr, br, bl };
}

/**
 * Rounded-rect fallback using path commands.
 */
function addRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: { tl: number; tr: number; br: number; bl: number }
) {
  const { tl, tr, br, bl } = radii;
  const maxR = Math.min(w, h) / 2;

  const rTL = Math.min(tl, maxR);
  const rTR = Math.min(tr, maxR);
  const rBR = Math.min(br, maxR);
  const rBL = Math.min(bl, maxR);

  ctx.beginPath();
  ctx.moveTo(x + rTL, y);
  ctx.lineTo(x + w - rTR, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
  ctx.lineTo(x + w, y + h - rBR);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
  ctx.lineTo(x + rBL, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
  ctx.lineTo(x, y + rTL);
  ctx.quadraticCurveTo(x, y, x + rTL, y);
  ctx.closePath();
}

/**
 * Draw silhouette for one element.
 */
function drawElementBoxSilhouette(
  ctx: CanvasRenderingContext2D,
  rootRect: DOMRect,
  el: HTMLElement
) {
  const style = getComputedStyle(el);

  // Filter out invisible nodes
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    parseFloat(style.opacity || "1") <= 0
  )
    return;

  const rect = el.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w <= 0 || h <= 0) return;

  const x = rect.left - rootRect.left;
  const y = rect.top - rootRect.top;

  ctx.save();

  // Clip to canvas bounds
  ctx.beginPath();
  ctx.rect(0, 0, rootRect.width, rootRect.height);
  ctx.clip();

  // Circle detection
  const isCircle = style.borderRadius.trim() === "50%" || Math.abs(w - h) < 0.5;

  if (isCircle) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Rounded rect (pill trough, etc.)
  const radii = parseBorderRadius(style, w, h);
  addRoundedRectPath(ctx, x, y, w, h, radii);
  ctx.fill();

  ctx.restore();
}

/**
 * Build silhouette canvas from nodes explicitly marked with data-shadow-shape.
 */
function createDomSilhouetteCanvas(el: HTMLElement): HTMLCanvasElement | null {
  if (!el.isConnected) return null;

  const rootRect = el.getBoundingClientRect();
  const rootWidth = rootRect.width;
  const rootHeight = rootRect.height;

  if (rootWidth <= 0 || rootHeight <= 0) return null;

  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rootWidth * dpr);
  canvas.height = Math.round(rootHeight * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rootWidth, rootHeight);
  ctx.fillStyle = "white";

  // Only nodes contributing to the silhouette
  const marked = el.querySelectorAll<HTMLElement>("[data-shadow-shape='true']");
  const nodes = marked.length > 0 ? Array.from(marked) : [el];

  for (const node of nodes) {
    drawElementBoxSilhouette(ctx, rootRect, node);
  }

  return canvas;
}

/**
 * Create real-time silhouette alphaMap.
 */
export async function createSilhouetteTexture(
  el: HTMLElement
): Promise<THREE.Texture | null> {
  const canvas = createDomSilhouetteCanvas(el);
  if (!canvas) return null;

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build plane for casting shadows with silhouette alphaMap.
 */
export function createShadowCasterPlane(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1, 1);

  const mat = new THREE.MeshStandardMaterial({
    color: "black",
    transparent: true,
    opacity: 1,
    alphaTest: 0.5,
    depthWrite: false,
  });

  mat.colorWrite = false; // invisible plane

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = false;

  return mesh;
}
