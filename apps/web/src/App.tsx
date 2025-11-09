import React, { useEffect } from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import FeatureStackDemo from "./components/elements/FeatureStack/FeatureStackDemo";

export default function App() {
  useEffect(() => {
    console.log("✅ FeatureStack demo initialized");
  }, []);

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          <div
            style={{
              position: "relative",
              width: "100vw",
              height: "200vh",
              background:
                "radial-gradient(circle at center, #111 0%, #000 100%)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            {/* sticky center wrapper */}
            <div
              style={{
                position: "sticky",
                top: "50%",
                width: "100%",
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FeatureStackDemo />
            </div>
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
