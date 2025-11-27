// @ts-nocheck

<Group
  name="MyGroup"
  // --- Responsive Transform (world space) ---
  position={{
    mobile: [0, 0, 0], // Vec3 in world units
    tablet: [0, 0, 0],
    desktop: [0, 0, 0],
  }}
  rotation={{
    mobile: [0, 0, 0], // Vec3 in degrees
    tablet: [0, 0, 0],
    desktop: [0, 0, 0],
  }}
  scale={{
    mobile: [1, 1, 1],
    tablet: [1, 1, 1],
    desktop: [1, 1, 1],
  }}
  // --- Local Anchor (pivot offset) ---
  anchor={[0, 0, 0]} // normalized offset, e.g. [0.5, 0.5, 0]
  // --- Optional Meta ---
  visible={true}
>
  {/* children rendered inside the anchor-adjusted pivot */}
</Group>;
