// @ts-nocheck

import React from "react";
import FeatureFrame from "@/components/feature/FeatureFrame";
import { GakLayer } from "@/components/visuals/Gak/GakLayer";

export default function FeatureDemo() {
  return (
    <FeatureFrame label="WAVEFORM MODULE" depth={0.2}>
      <div style={{ position: "relative", width: "80%", height: "50%" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(90deg,#555 0%,#333 100%)",
            borderRadius: "6px",
          }}
        ></div>
        <GakLayer intensity={0.6} />
      </div>
    </FeatureFrame>
  );
}
