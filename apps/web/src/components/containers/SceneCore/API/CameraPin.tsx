// @ts-nocheck

<CameraPin
  name="MyCamerPin"
  // --- Non Frustum Anchored Transform ---
  position={[0, 0, 0]}
  rotation={[0, 0, 0]}
  scale={[1, 1, 1]}
  // --- Frustum Anchors ---
  anchorX="center" // "left" | "center" | "right"
  anchorY="top" // "top" | "center" | "bottom"
  anchorZ={200} // distance from camera
  // --- Offsets ---
  offsetX={0}
  offsetY={0}
  // --- Optional Meta ---
  visible={true}
></CameraPin>;
