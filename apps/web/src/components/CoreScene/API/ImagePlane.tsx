// @ts-nocheck

<ImagePlane
  name="MyImagePlane"
  // --- Source / Appearance ---
  src="/textures/myImage.png" // OR: texture={preloadedTexture}
  color="#ffffff" // used if no texture or multiply blend
  // --- Responsive Dimensions (world units) ---
  width={{
    mobile: 100,
    tablet: 150,
    desktop: 200,
  }}
  height={{
    mobile: 60,
    tablet: 90,
    desktop: 120,
  }}
  cornerRadius={{
    mobile: 20,
    tablet: 30,
    desktop: 40,
  }}
  // --- Responsive Transform (true 3D world space) ---
  position={{
    mobile: [0, 0, 0], // Vec3 → includes TRUE Z
    tablet: [0, 0, 0],
    desktop: [0, 0, 0],
  }}
  rotation={{
    mobile: [0, 0, 0], // Vec3 in DEGREES
    tablet: [0, 0, 0],
    desktop: [0, 0, 0],
  }}
  scale={{
    mobile: [1, 1, 1],
    tablet: [1, 1, 1],
    desktop: [1, 1, 1],
  }}
  // --- Render Layering ---
  z={10}
  // --- Shadows ---
  castShadow={true}
  receiveShadow={true} // renderOrder only — NOT world-space Z
  // --- Optional Meta ---
  visible={true}
  // --- Optional Interactivity ---
  onClick={(e, hit) => {
    console.log("clicked image plane", hit);
  }}
  onHover={(e, hit) => {
    console.log("hovering image plane", hit);
  }}
/>;
