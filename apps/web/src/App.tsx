// // src/App.tsx
// import React from "react";
// import LogoScene from "./components/elements/Logo/LogoScene";

// export default function App() {
//   return (
//     <div
//       style={{
//         width: "100vw",
//         height: "100vh",
//         overflow: "hidden",
//         margin: 0,
//         padding: 0,
//       }}
//     >
//       <LogoScene />
//     </div>
//   );
// }

// src/App.tsx
// import React from "react";
// import TestScene from "./components/elements/Logo/TestScene";

// export default function App() {
//   return (
//     <div
//       style={{
//         width: "100vw",
//         height: "100vh",
//         overflow: "hidden",
//         margin: 0,
//         padding: 0,
//       }}
//     >
//       <TestScene />
//     </div>
//   );
// }

// @ts-nocheck

import React, { useEffect } from "react";

import { Stage } from "@/components/containers/SceneCore/Stage/Stage";
import { ImagePlane } from "@/components/containers/SceneObjects/Geometry/ImagePlane";

import NestedToggle from "@/components/elements/NestedToggle/NestedToggle";
import { toggleRegistry } from "@/components/elements/NestedToggle/ToggleRegistry";
import { toggleFamilyConfig } from "@/components/elements/NestedToggle/toggleConfig";

export default function App() {
  // Register toggle nodes ONCE
  useEffect(() => {
    Object.values(toggleFamilyConfig).forEach((node) => {
      toggleRegistry.register(node);
    });
  }, []);

  return (
    <Stage
      backdrop={{
        presetSizes: {
          mobile: { width: 750, height: 1920 },
          tablet: { width: 1024, height: 1024 },
          desktop: { width: 1920, height: 1080 },
        },
        position: [0, 0, 0],
      }}
    >
      {/* ---------------------------
       * ROOT TOGGLE (center)
       * --------------------------- */}
      <ImagePlane
        domContent={
          <NestedToggle id="GlobalLive" size={1} style={{ margin: 20 }} />
        }
        domPixelScale={0.01}
        position={[0, 0, 20]}
        z={10}
      />

      {/* ---------------------------
       * CHILDREN (side-by-side)
       * --------------------------- */}
      <ImagePlane
        domContent={<NestedToggle id="child1" size={1} />}
        domPixelScale={0.01}
        position={[-200, -200, 20]}
        z={10}
      />

      <ImagePlane
        domContent={<NestedToggle id="child2" size={1} />}
        domPixelScale={0.01}
        position={[200, -200, 20]}
        z={10}
      />

      {/* ---------------------------
       * GRANDCHILD
       * --------------------------- */}
      <ImagePlane
        domContent={<NestedToggle id="grandchild" size={0.8} />}
        domPixelScale={0.01}
        position={[0, -400, 20]}
        z={10}
      />
    </Stage>
  );
}
