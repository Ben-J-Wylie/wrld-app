// @ts-nocheck

import React, { useState } from "react";
import { Camera, Mic, MapPin } from "lucide-react";
import FeatureCard from "./components/elements/FeatureCard/FeatureCard";

export default function App() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const toggle = (name: string) =>
    setActiveFeature((prev) => (prev === name ? null : name));

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "20px",
        flexWrap: "wrap",
        padding: "40px",
        background: "#0e0e0e",
        minHeight: "100vh",
        color: "#fff",
      }}
    >
      <FeatureCard
        label="Camera"
        icon={<Camera />}
        active={activeFeature === "Camera"}
        onClick={() => toggle("Camera")}
        preview={<div>Camera preview placeholder</div>}
      />
      <FeatureCard
        label="Microphone"
        icon={<Mic />}
        active={activeFeature === "Mic"}
        onClick={() => toggle("Mic")}
        preview={<div>Mic visualization here</div>}
      />
      <FeatureCard
        label="Location"
        icon={<MapPin />}
        active={activeFeature === "Location"}
        onClick={() => toggle("Location")}
        preview={<div>Map preview placeholder</div>}
      />
    </div>
  );
}
